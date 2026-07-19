import type { SubscriptionTier, TierFeature } from '@/types';
import { TIER_GATES } from '@/types';

// ── Helpers ──────────────────────────────────────────────────
const GB = 1_073_741_824; // bytes per GB

export function canAccess(
  tier: SubscriptionTier | undefined | null,
  feature: TierFeature
): boolean {
  const safeTier = tier ?? 'basic';
  return TIER_GATES[safeTier][feature] as boolean;
}

export function getGate(tier: SubscriptionTier | undefined | null) {
  return TIER_GATES[tier ?? 'basic'];
}

/**
 * Resolve a user's effective tier, respecting subscription expiry.
 * If the subscription has expired (CliQ period_end in the past),
 * fall back to 'basic' so expired users lose premium features.
 */
export function resolveTier(
  tier: SubscriptionTier | undefined | null,
  currentPeriodEnd?: string | null,
): SubscriptionTier {
  if (currentPeriodEnd && new Date(currentPeriodEnd) < new Date()) {
    return 'basic';
  }
  return tier ?? 'basic';
}

// ── Active case limit ────────────────────────────────────────

export interface CaseLimitResult {
  allowed:  boolean;
  current:  number;
  max:      number;
  tier:     SubscriptionTier;
}

/**
 * Check if the user can create another active case.
 */
export async function checkCaseLimit(
  userId: string,
  tier: SubscriptionTier | undefined | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<CaseLimitResult> {
  const safeTier = tier ?? 'basic';
  const max = TIER_GATES[safeTier].max_cases;

  const { count } = await supabase
    .from('cases')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', userId)
    .eq('status', 'active');

  const current = count ?? 0;

  return {
    allowed: current < max,
    current,
    max,
    tier: safeTier,
  };
}

// ── Document count per case ──────────────────────────────────

export interface DocLimitResult {
  allowed:  boolean;
  current:  number;
  max:      number;
  tier:     SubscriptionTier;
}

/**
 * Check if the user can upload more documents to a specific case.
 */
export async function checkDocLimit(
  caseId: string,
  tier: SubscriptionTier | undefined | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  additionalDocs = 1,
): Promise<DocLimitResult> {
  const safeTier = tier ?? 'basic';
  const max = TIER_GATES[safeTier].max_docs;

  const { count } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('case_id', caseId);

  const current = count ?? 0;

  return {
    allowed: (current + additionalDocs) <= max,
    current,
    max,
    tier: safeTier,
  };
}

// ── Storage enforcement ──────────────────────────────────────
// Basic: 1 GB | Pro: 10 GB | Premium: 30 GB
// Uses SUM(documents.file_size) across all client-owned cases.

/**
 * Returns total bytes used by a user across all their cases.
 * Requires a Supabase client with access to the documents table.
 */
export async function getUserStorageUsed(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<number> {
  const { data: cases } = await supabase
    .from('cases')
    .select('id')
    .eq('client_id', userId);

  if (!cases?.length) return 0;

  const caseIds = cases.map((c: { id: string }) => c.id);

  const { data: docs } = await supabase
    .from('documents')
    .select('file_size')
    .in('case_id', caseIds);

  if (!docs?.length) return 0;

  return docs.reduce(
    (sum: number, d: { file_size: number | null }) => sum + (d.file_size ?? 0),
    0
  );
}

export interface StorageCheckResult {
  allowed:     boolean;
  bytes_used:  number;
  bytes_limit: number;
  percentage:  number;
  tier:        SubscriptionTier;
}

/**
 * Checks whether a user is within their storage quota.
 * Pass `additionalBytes` to simulate a pending upload.
 */
export async function checkStorageLimit(
  userId:          string,
  tier:            SubscriptionTier | undefined | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase:        any,
  additionalBytes  = 0
): Promise<StorageCheckResult> {
  const safeTier   = tier ?? 'basic';
  const bytes_limit = TIER_GATES[safeTier].storage_gb * GB;
  const bytes_used  = await getUserStorageUsed(userId, supabase);
  const total       = bytes_used + additionalBytes;
  const percentage  = bytes_limit === 0 ? 100 : Math.round((total / bytes_limit) * 100);

  return {
    allowed:    total <= bytes_limit,
    bytes_used: total,
    bytes_limit,
    percentage: Math.min(percentage, 100),
    tier:       safeTier,
  };
}

// ── File size limits ─────────────────────────────────────────

const MAX_FILE_SIZE_VAULT   = 50 * 1024 * 1024;   // 50 MB for vault uploads
const MAX_FILE_SIZE_AI      = 10 * 1024 * 1024;    // 10 MB for AI analysis

export function checkFileSize(size: number, context: 'vault' | 'ai'): { allowed: boolean; maxBytes: number } {
  const maxBytes = context === 'ai' ? MAX_FILE_SIZE_AI : MAX_FILE_SIZE_VAULT;
  return { allowed: size <= maxBytes, maxBytes };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
