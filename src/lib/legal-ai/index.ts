/**
 * Legal-AI module — public surface.
 *
 * Re-exports the Supabase-native engine + data layer so callers
 * don't need to know the internal file layout.
 */

export {
  generateAnalysis,
  matchLegalCorpus,
  generateEmbedding,
  isGeminiConfigured,
  type CorpusMatch,
} from "./gemini";

export {
  getAnalyses,
  getAnalysisById,
  getPendingAnalysesForReview,
  updateAnalysisReview,
  getDocuments,
  getLawyers,
  getLawyerById,
  getLeadsForUser,
  getLeadsForLawyer,
  createLead,
} from "./data";

export { saveAnalysis } from "./analyze-save";
export { extractPdfText, extractImageText, type ExtractResult } from "./pdf-client";
