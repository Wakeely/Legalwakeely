import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkLegalAiAccess } from './gate';

// checkLegalAiAccess creates its own Supabase client internally rather
// than accepting one as a parameter, so it's mocked at the module level.
vi.mock('server-only', () => ({}));

let mockSubscription: Record<string, unknown> | null = null;
let mockUsage: Record<string, unknown> | null = null;

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      const node: Record<string, unknown> = {
        select: () => node,
        eq: () => node,
        maybeSingle: async () => ({
          data: table === 'subscriptions' ? mockSubscription : mockUsage,
        }),
      };
      return node;
    },
  }),
}));

const future = new Date(Date.now() + 30 * 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();

beforeEach(() => {
  mockSubscription = null;
  mockUsage = null;
});

describe('checkLegalAiAccess', () => {
  it('denies basic tier with no add-on', async () => {
    mockSubscription = { tier: 'basic', legal_ai_enabled: false, status: 'active', current_period_end: future };
    const access = await checkLegalAiAccess('user-1');
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe('no_subscription');
  });

  it('allows pro tier with an active paid add-on, under the cap', async () => {
    mockSubscription = {
      tier: 'pro', legal_ai_enabled: true, status: 'active',
      current_period_end: future, legal_ai_current_period_end: future,
    };
    mockUsage = { analyses_count: 5 };
    const access = await checkLegalAiAccess('user-1');
    expect(access.allowed).toBe(true);
    expect(access.monthlyCap).toBe(25); // pro add-on cap
    expect(access.remaining).toBe(20);
  });

  // This is the exact scenario the July 2026 counter-reset bug broke:
  // usage sitting right at the monthly cap must actually block further
  // analyses, not silently allow them because the counter never grew.
  it('blocks pro tier once usage reaches the monthly cap', async () => {
    mockSubscription = {
      tier: 'pro', legal_ai_enabled: true, status: 'active',
      current_period_end: future, legal_ai_current_period_end: future,
    };
    mockUsage = { analyses_count: 25 };
    const access = await checkLegalAiAccess('user-1');
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe('usage_cap_reached');
    expect(access.remaining).toBe(0);
  });

  it('denies pro tier once the paid add-on period has expired', async () => {
    mockSubscription = {
      tier: 'pro', legal_ai_enabled: true, status: 'active',
      current_period_end: future, legal_ai_current_period_end: past,
    };
    const access = await checkLegalAiAccess('user-1');
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe('no_subscription');
  });

  it('allows premium tier without needing the separate add-on flag', async () => {
    mockSubscription = { tier: 'premium', legal_ai_enabled: false, status: 'active', current_period_end: future };
    mockUsage = { analyses_count: 10 };
    const access = await checkLegalAiAccess('user-1');
    expect(access.allowed).toBe(true);
    expect(access.monthlyCap).toBe(100);
  });

  it('denies an unauthenticated request', async () => {
    const access = await checkLegalAiAccess(undefined);
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe('not_authenticated');
  });
});
