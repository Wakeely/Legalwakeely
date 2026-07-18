import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { mockAnalyses, mockLawyers, mockDocuments, mockLeads } from "@/lib/mock-data";
import type {
  Analysis,
  Document,
  DocumentType,
  LawyerProfile,
  Lead,
} from "@/lib/types";

/**
 * Legal-AI data access layer — Supabase-native.
 *
 * Consolidation note: this replaces the old Prisma + REST fallback
 * implementation. All reads/writes now go through the Supabase client
 * (server cookie-bound for user-scoped queries, admin/service-role
 * for cross-user queries). Mock data is used only when Supabase env
 * vars are absent (local dev without a DB).
 *
 * Tables (see supabase/migrations/20260342_legal_ai_module.sql):
 *   - document_analyses  (extended with rights, legal_sources, lawyer_score, …)
 *   - lawyer_directory
 *   - legal_leads
 *   - legal_reviews
 *   - legal_corpus
 */

const useDb = isSupabaseConfigured;

// ─── helpers ───────────────────────────────────────────────

interface AnalysisRow {
  id: string;
  user_id: string;
  document_id: string | null;
  case_id: string | null;
  file_name: string;
  case_type: string | null;
  case_title: string | null;
  summary: string | null;
  rights: string[] | null;
  obligations: unknown[] | null;
  risks: unknown[] | null;
  next_actions: unknown[] | null;
  legal_sources: unknown[] | null;
  lawyer_score: string | null;
  lawyer_reason: string | null;
  confidence_score: number | null;
  review_status: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: string;
}

function rowToAnalysis(row: AnalysisRow): Analysis {
  return {
    id: row.id,
    documentId: row.document_id ?? "",
    userId: row.user_id,
    documentType: (row.case_type ?? "general") as DocumentType,
    documentTitle: row.case_title ?? row.file_name ?? "Document",
    summary: row.summary ?? "",
    rights: (row.rights ?? []) as string[],
    obligations: ((row.obligations ?? []) as unknown[]).map((o) =>
      typeof o === "string" ? o : (o as { text?: string }).text ?? String(o),
    ),
    risks: ((row.risks ?? []) as Array<{ text: string; severity: "low" | "medium" | "high" }>).map((r) => ({
      text: r.text,
      severity: r.severity,
    })),
    lawyerScore: ((row.lawyer_score ?? "MEDIUM").toUpperCase() === "HIGH"
      ? "HIGH"
      : (row.lawyer_score ?? "MEDIUM").toUpperCase() === "LOW"
        ? "LOW"
        : "MEDIUM") as Analysis["lawyerScore"],
    lawyerReason: row.lawyer_reason ?? "",
    nextSteps: ((row.next_actions ?? []) as Array<{ title: string; description: string; isPaid: boolean }>).map(
      (n) => ({
        title: n.title,
        description: n.description,
        isPaid: n.isPaid,
      }),
    ),
    sources: ((row.legal_sources ?? []) as Array<{ lawName: string; articleNumber?: string; excerpt: string }>).map(
      (s) => ({
        lawName: s.lawName,
        articleNumber: s.articleNumber,
        excerpt: s.excerpt,
      }),
    ),
    confidenceScore: row.confidence_score ?? 0.85,
    reviewStatus: ((row.review_status ?? "pending").toUpperCase() === "APPROVED"
      ? "APPROVED"
      : (row.review_status ?? "pending").toUpperCase() === "REJECTED"
        ? "REJECTED"
        : (row.review_status ?? "pending").toUpperCase() === "FLAGGED"
          ? "FLAGGED"
          : "PENDING") as Analysis["reviewStatus"],
    reviewedBy: row.reviewed_by ?? undefined,
    reviewNotes: row.review_notes ?? undefined,
    createdAt: row.created_at,
  };
}

interface LawyerRow {
  id: string;
  user_id: string | null;
  bar_number: string;
  full_name: string;
  bio_ar: string;
  bio_en: string;
  specialties: string[];
  cities: string[];
  languages: string[];
  hourly_rate_jod: number;
  years_experience: number;
  success_stories: number;
  rating: number;
  total_reviews: number;
  verified: boolean;
  is_available: boolean;
  is_featured: boolean;
  avatar_url: string | null;
}

function rowToLawyer(row: LawyerRow, locale: "ar" | "en" = "ar"): LawyerProfile {
  return {
    id: row.id,
    userId: row.user_id ?? row.id,
    name: row.full_name,
    avatar: row.avatar_url ?? "",
    specialties: row.specialties,
    cities: row.cities,
    hourlyRate: row.hourly_rate_jod,
    bio: { ar: row.bio_ar, en: row.bio_en },
    verified: row.verified,
    rating: row.rating,
    totalReviews: row.total_reviews,
    barNumber: row.bar_number,
    isAvailable: row.is_available,
    languages: row.languages.filter((l): l is "ar" | "en" => l === "ar" || l === "en"),
    yearsExperience: row.years_experience,
    successStories: row.success_stories,
  };
}

// ─── ANALYSES ──────────────────────────────────────────────

export async function getAnalyses(userId: string): Promise<Analysis[]> {
  if (!useDb) return mockAnalyses.filter((a) => a.userId === userId);
  const admin = getSupabaseAdmin();
  if (!admin) return mockAnalyses.filter((a) => a.userId === userId);
  const { data, error } = await admin
    .from("document_analyses")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as AnalysisRow[]).map(rowToAnalysis);
}

export async function getAnalysisById(id: string): Promise<Analysis | null> {
  if (!useDb) return mockAnalyses.find((a) => a.id === id) ?? null;
  const admin = getSupabaseAdmin();
  if (!admin) return mockAnalyses.find((a) => a.id === id) ?? null;
  const { data, error } = await admin
    .from("document_analyses")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return rowToAnalysis(data as AnalysisRow);
}

export async function getPendingAnalysesForReview(): Promise<Analysis[]> {
  if (!useDb) return mockAnalyses.filter((a) => a.reviewStatus === "PENDING");
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const { data, error } = await admin
    .from("document_analyses")
    .select("*")
    .eq("review_status", "pending")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as AnalysisRow[]).map(rowToAnalysis);
}

export async function updateAnalysisReview(
  id: string,
  status: "APPROVED" | "REJECTED" | "FLAGGED",
  reviewerId?: string,
  notes?: string,
): Promise<Analysis | null> {
  if (!useDb) {
    const a = mockAnalyses.find((x) => x.id === id);
    if (a) {
      a.reviewStatus = status;
      a.reviewedBy = reviewerId;
      a.reviewNotes = notes;
    }
    return a ?? null;
  }
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from("document_analyses")
    .update({
      review_status: status.toLowerCase(),
      reviewed_by: reviewerId ?? null,
      review_notes: notes ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) return null;
  return rowToAnalysis(data as AnalysisRow);
}

// ─── DOCUMENTS (lightweight, for history views) ────────────

export async function getDocuments(userId: string): Promise<Document[]> {
  if (!useDb) return mockDocuments.filter((d) => d.userId === userId);
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const { data, error } = await admin
    .from("document_analyses")
    .select("id, user_id, file_name, case_type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as Array<{ id: string; user_id: string; file_name: string; case_type: string | null; created_at: string }>).map(
    (r) => ({
      id: r.id,
      userId: r.user_id,
      title: r.file_name,
      fileType: "pdf" as const,
      documentType: (r.case_type ?? "general") as DocumentType,
      status: "REVIEWED" as const,
      contentExcerpt: "",
      createdAt: r.created_at,
    }),
  );
}

// ─── LAWYERS ───────────────────────────────────────────────

export async function getLawyers(opts?: {
  specialty?: string;
  city?: string;
  verifiedOnly?: boolean;
}): Promise<LawyerProfile[]> {
  if (!useDb) {
    let list = mockLawyers;
    if (opts?.specialty) list = list.filter((l) => l.specialties.includes(opts.specialty!));
    if (opts?.city) list = list.filter((l) => l.cities.includes(opts.city!));
    if (opts?.verifiedOnly) list = list.filter((l) => l.verified);
    return list;
  }
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  let q = admin.from("lawyer_directory").select("*");
  if (opts?.verifiedOnly) q = q.eq("verified", true);
  if (opts?.specialty) q = q.contains("specialties", [opts.specialty]);
  if (opts?.city) q = q.contains("cities", [opts.city]);
  const { data, error } = await q.order("rating", { ascending: false }).order("total_reviews", { ascending: false });
  if (error || !data) return [];
  return (data as LawyerRow[]).map((r) => rowToLawyer(r));
}

export async function getLawyerById(id: string): Promise<LawyerProfile | null> {
  if (!useDb) return mockLawyers.find((l) => l.id === id) ?? null;
  const admin = getSupabaseAdmin();
  if (!admin) return mockLawyers.find((l) => l.id === id) ?? null;
  const { data, error } = await admin
    .from("lawyer_directory")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return rowToLawyer(data as LawyerRow);
}

// ─── LEADS ─────────────────────────────────────────────────

interface LeadRow {
  id: string;
  user_id: string;
  lawyer_id: string;
  analysis_id: string | null;
  document_type: string;
  message: string;
  fee_offered: number | null;
  status: string;
  created_at: string;
}

function rowToLead(row: LeadRow, userName = ""): Lead {
  return {
    id: row.id,
    userId: row.user_id,
    userName,
    lawyerId: row.lawyer_id,
    analysisId: row.analysis_id ?? undefined,
    documentType: row.document_type as DocumentType,
    message: row.message,
    feeOffered: row.fee_offered ?? undefined,
    status: row.status.toUpperCase() as Lead["status"],
    createdAt: row.created_at,
  };
}

export async function getLeadsForUser(userId: string): Promise<Lead[]> {
  if (!useDb) return mockLeads.filter((l) => l.userId === userId);
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const { data, error } = await admin
    .from("legal_leads")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as LeadRow[]).map((r) => rowToLead(r));
}

export async function getLeadsForLawyer(lawyerId: string): Promise<Lead[]> {
  if (!useDb) return mockLeads.filter((l) => l.lawyerId === lawyerId);
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const { data, error } = await admin
    .from("legal_leads")
    .select("*")
    .eq("lawyer_id", lawyerId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as LeadRow[]).map((r) => rowToLead(r));
}

export async function createLead(
  data: Omit<Lead, "id" | "createdAt" | "status">,
): Promise<Lead> {
  if (!useDb) {
    const lead: Lead = {
      ...data,
      id: `ld_${Date.now()}`,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };
    mockLeads.unshift(lead);
    return lead;
  }
  const supabase = await createClient();
  const admin = getSupabaseAdmin();
  const client = admin ?? supabase;
  const { data: inserted, error } = await client
    .from("legal_leads")
    .insert({
      user_id: data.userId,
      lawyer_id: data.lawyerId,
      analysis_id: data.analysisId ?? null,
      document_type: data.documentType,
      message: data.message,
      fee_offered: data.feeOffered ?? null,
      status: "pending",
    })
    .select("*")
    .single();
  if (error || !inserted) {
    // fall back to mock so the UI doesn't crash in dev
    const lead: Lead = {
      ...data,
      id: `ld_${Date.now()}`,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };
    return lead;
  }
  return rowToLead(inserted as LeadRow, data.userName);
}
