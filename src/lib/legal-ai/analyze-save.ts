import "server-only";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import type { Analysis } from "@/lib/types";

type SaveResult =
  | { ok: true; source: "supabase" }
  | { ok: false; reason: string; code?: string };

/**
 * Persists a Legal-AI analysis row to `document_analyses`.
 *
 * Consolidation note: the old implementation tried Prisma first and
 * fell back to a Supabase REST upsert into Prisma-named tables
 * (`Analysis`, `Document`, `User`). This version writes directly to
 * the consolidated `document_analyses` table (migration 20260342)
 * and the `legal_ai_usage` metering table — Supabase-only, no Prisma.
 *
 * The caller is responsible for passing the authenticated user id
 * (resolved via `getServerSession()` or `supabase.auth.getUser()`).
 */
export async function saveAnalysis(
  analysis: Analysis,
  ctx: {
    userId: string;
    contentExcerpt: string;
    fileName: string;
    citedCorpusIds?: string[];
  },
): Promise<SaveResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, reason: "supabase not configured" };
  }
  const admin = getSupabaseAdmin();
  if (!admin) {
    return { ok: false, reason: "supabase admin client unavailable" };
  }

  const now = new Date().toISOString();

  const payload = {
    id: analysis.id,
    user_id: ctx.userId,
    // document_id / case_id stay null — the Legal-AI module creates
    // a case on demand via the cross-module handoff, not here.
    document_id: null,
    case_id: null,
    file_name: ctx.fileName,
    file_size: null,
    detected_lang: "mixed",
    case_type: analysis.documentType,
    case_title: analysis.documentTitle,
    summary: analysis.summary,
    parties: [] as unknown[],
    key_dates: [] as unknown[],
    obligations: analysis.obligations,
    risks: analysis.risks,
    next_actions: analysis.nextSteps,
    risk_score: analysis.risks[0]?.severity ?? "low",
    // Legal-AI-specific fields (added by migration 20260342)
    rights: analysis.rights,
    legal_sources: analysis.sources,
    lawyer_score: analysis.lawyerScore.toLowerCase(),
    lawyer_reason: analysis.lawyerReason,
    confidence_score: analysis.confidenceScore,
    review_status: analysis.reviewStatus.toLowerCase(),
    cited_corpus_ids: ctx.citedCorpusIds ?? [],
    raw_ai_response: { provider: "gemini" },
    confirmed: false,
    created_at: now,
  };

  const { error } = await admin.from("document_analyses").upsert(payload, { onConflict: "id" });
  if (error) {
    return { ok: false, reason: `analysis upsert: ${error.message}`, code: error.code };
  }

  // ── Meter usage for the month (fair-use cap enforcement) ───────
  const periodStart = now.slice(0, 7) + "-01"; // YYYY-MM-01
  await admin.from("legal_ai_usage").upsert(
    {
      user_id: ctx.userId,
      period_start: periodStart,
      analyses_count: 1,
      last_analysis_at: now,
    },
    { onConflict: "user_id,period_start" },
  );
  // Bump the counter atomically (upsert above ensures a row exists;
  // the RPC increments it in place). RPC may not exist on fresh DBs —
  // non-fatal, the upsert already set a baseline of 1.
  try {
    await admin.rpc("increment_legal_ai_usage", {
      p_user_id: ctx.userId,
      p_period: periodStart,
    });
  } catch {
    // ignore — see comment above
  }

  return { ok: true, source: "supabase" };
}
