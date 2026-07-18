-- ================================================================
-- Migration 20260342_legal_ai_module.sql
-- ================================================================
-- Consolidates the "Almustahar" document-AI engine into the
-- Wakeela platform as a paid subscription add-on ("Legal-AI module").
--
-- What this migration does:
--   1. Enables the pgvector extension (for RAG embeddings).
--   2. Adds `legal_ai_enabled` + usage counters to `subscriptions`
--      so the module can be gated as a paid add-on.
--   3. Creates `legal_corpus` — the RAG knowledge base of cited
--      Jordanian/MENA legal articles, with a 768-dim embedding column
--      (matches Gemini text-embedding-001 outputDimensionality).
--   4. Creates `lawyer_directory` — verified lawyer profiles
--      (separate from the case-management `users`/`case_lawyers`
--      flow; this is the public discovery/matching directory).
--   5. Creates `legal_leads` — citizen→lawyer hire requests,
--      optionally linked to a `document_analyses` row.
--   6. Creates `legal_reviews` — citizen ratings of lawyers.
--   7. Extends `document_analyses` with the Almustahar-specific
--      fields: rights, legal_sources, lawyer_score, lawyer_reason,
--      confidence_score, review_status.
--   8. Creates `legal_ai_usage` — per-user monthly metering so the
--      add-on can enforce a fair-use cap.
--   9. RLS policies on every new table.
--
-- All new tables use UUID PKs and snake_case to match the existing
-- Wakeela schema conventions (see 001_initial_schema.sql).
-- ================================================================

-- ── 0. pgvector extension (idempotent) ───────────────────────
-- Required for the embedding column on legal_corpus.
-- Supabase supports this; if it is missing on a fresh project,
-- enable it via the dashboard or `CREATE EXTENSION IF NOT EXISTS vector;`
CREATE EXTENSION IF NOT EXISTS vector;

-- ================================================================
-- 1. subscriptions — add Legal-AI add-on gating
-- ================================================================
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS legal_ai_enabled        BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS legal_ai_stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS legal_ai_current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS legal_ai_cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.subscriptions.legal_ai_enabled IS
  'True when the user has purchased the Legal-AI add-on (separate from base tier). Gates /legal-ai/* routes.';

-- ================================================================
-- 2. legal_corpus — RAG knowledge base
-- ================================================================
CREATE TABLE IF NOT EXISTS public.legal_corpus (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  law_name        TEXT        NOT NULL,
  law_type        TEXT        NOT NULL CHECK (law_type IN
                    ('rental','labor','traffic','consumer','family','civil','constitutional','social','commercial')),
  article_number  TEXT,
  title           TEXT,
  content         TEXT        NOT NULL,
  metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- 768-dim matches Gemini text-embedding-001 (see src/lib/legal-ai/gemini.ts).
  embedding       vector(768),
  -- Stable external id (e.g. "rental-civil-553") for re-ingestion idempotency.
  external_id     TEXT        UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_corpus_law_type ON public.legal_corpus(law_type);
CREATE INDEX IF NOT EXISTS idx_legal_corpus_law_name ON public.legal_corpus(law_name);
-- ivfflat index for cosine similarity search. Re-run after seeding a non-trivial corpus.
CREATE INDEX IF NOT EXISTS idx_legal_corpus_embedding
  ON public.legal_corpus USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE public.legal_corpus ENABLE ROW LEVEL SECURITY;
-- The corpus is reference material; readable by any authenticated user.
-- Writes are admin-only (service role bypasses RLS).
CREATE POLICY "legal_corpus_read_authenticated" ON public.legal_corpus
  FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS legal_corpus_updated_at ON public.legal_corpus;
CREATE TRIGGER legal_corpus_updated_at BEFORE UPDATE ON public.legal_corpus
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ================================================================
-- 3. lawyer_directory — public lawyer discovery profiles
-- ================================================================
-- Distinct from `users` (auth/account) and `case_lawyers` (case
-- assignments). This is the public-facing directory the Legal-AI
-- module's "lawyer-needed gauge" links to.
CREATE TABLE IF NOT EXISTS public.lawyer_directory (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  bar_number        TEXT        NOT NULL UNIQUE,
  full_name         TEXT        NOT NULL,
  bio_ar            TEXT        NOT NULL DEFAULT '',
  bio_en            TEXT        NOT NULL DEFAULT '',
  specialties       TEXT[]      NOT NULL DEFAULT '{}',
  cities            TEXT[]      NOT NULL DEFAULT '{}',
  languages         TEXT[]      NOT NULL DEFAULT '{ar}',   -- subset of {'ar','en'}
  hourly_rate_jod   INTEGER     NOT NULL DEFAULT 0,
  years_experience  INTEGER     NOT NULL DEFAULT 0,
  success_stories   INTEGER     NOT NULL DEFAULT 0,
  rating            NUMERIC(2,1) NOT NULL DEFAULT 0,
  total_reviews     INTEGER     NOT NULL DEFAULT 0,
  verified          BOOLEAN     NOT NULL DEFAULT FALSE,
  is_available      BOOLEAN     NOT NULL DEFAULT TRUE,
  is_featured       BOOLEAN     NOT NULL DEFAULT FALSE,
  avatar_url        TEXT,
  subscription_tier TEXT        CHECK (subscription_tier IN ('basic','pro','premium')) DEFAULT 'basic',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lawyer_directory_verified   ON public.lawyer_directory(verified);
CREATE INDEX IF NOT EXISTS idx_lawyer_directory_available  ON public.lawyer_directory(is_available);
CREATE INDEX IF NOT EXISTS idx_lawyer_directory_rating     ON public.lawyer_directory(rating DESC);

ALTER TABLE public.lawyer_directory ENABLE ROW LEVEL SECURITY;
-- Public read of verified lawyers; self-update of own profile; admin full.
CREATE POLICY "lawyer_directory_public_read" ON public.lawyer_directory
  FOR SELECT USING (verified = TRUE);
CREATE POLICY "lawyer_directory_self_update" ON public.lawyer_directory
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "lawyer_directory_self_insert" ON public.lawyer_directory
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS lawyer_directory_updated_at ON public.lawyer_directory;
CREATE TRIGGER lawyer_directory_updated_at BEFORE UPDATE ON public.lawyer_directory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ================================================================
-- 4. legal_leads — citizen → lawyer hire requests
-- ================================================================
CREATE TABLE IF NOT EXISTS public.legal_leads (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lawyer_id       UUID        NOT NULL REFERENCES public.lawyer_directory(id) ON DELETE CASCADE,
  analysis_id     UUID        REFERENCES public.document_analyses(id) ON DELETE SET NULL,
  document_type   TEXT        NOT NULL CHECK (document_type IN
                    ('rental','employment','traffic','consumer','general')),
  message         TEXT        NOT NULL,
  fee_offered     INTEGER,    -- in JOD fils
  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','accepted','rejected','converted')),
  responded_at    TIMESTAMPTZ,
  converted_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_leads_user   ON public.legal_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_legal_leads_lawyer ON public.legal_leads(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_legal_leads_status ON public.legal_leads(status);

ALTER TABLE public.legal_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "legal_leads_owner_rw" ON public.legal_leads
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "legal_leads_lawyer_read" ON public.legal_leads
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.lawyer_directory ld
            WHERE ld.id = legal_leads.lawyer_id AND ld.user_id = auth.uid())
  );

DROP TRIGGER IF EXISTS legal_leads_updated_at ON public.legal_leads;
CREATE TRIGGER legal_leads_updated_at BEFORE UPDATE ON public.legal_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ================================================================
-- 5. legal_reviews — citizen ratings of lawyers
-- ================================================================
CREATE TABLE IF NOT EXISTS public.legal_reviews (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lawyer_id   UUID        NOT NULL REFERENCES public.lawyer_directory(id) ON DELETE CASCADE,
  rating      INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, lawyer_id)
);

CREATE INDEX IF NOT EXISTS idx_legal_reviews_lawyer ON public.legal_reviews(lawyer_id);

ALTER TABLE public.legal_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "legal_reviews_owner_rw" ON public.legal_reviews
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "legal_reviews_public_read" ON public.legal_reviews
  FOR SELECT USING (true);

-- ================================================================
-- 6. document_analyses — extend with Almustahar fields
-- ================================================================
-- Wakeela already created `document_analyses` in 20260331_doc_ai.sql
-- with: summary, parties, key_dates, obligations, risks, next_actions,
-- risk_score. We add the Almustahar-specific outputs so the same table
-- serves both the case-management AI extraction AND the Legal-AI
-- document-understanding module (single source of truth).
ALTER TABLE public.document_analyses
  ADD COLUMN IF NOT EXISTS rights            JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS legal_sources     JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS lawyer_score      TEXT  CHECK (lawyer_score IN ('low','medium','high')),
  ADD COLUMN IF NOT EXISTS lawyer_reason     TEXT,
  ADD COLUMN IF NOT EXISTS confidence_score  NUMERIC(3,2) DEFAULT 0.85,
  ADD COLUMN IF NOT EXISTS review_status     TEXT  NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending','approved','rejected','flagged')),
  ADD COLUMN IF NOT EXISTS reviewed_by       UUID  REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_notes      TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at       TIMESTAMPTZ,
  -- Link to the corpus chunks cited by this analysis (for auditability).
  ADD COLUMN IF NOT EXISTS cited_corpus_ids  UUID[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.document_analyses.rights IS
  'Plain-text list of the user''s rights under the analyzed document (Legal-AI module).';
COMMENT ON COLUMN public.document_analyses.legal_sources IS
  'Array of {lawName, articleNumber?, excerpt} objects cited by the RAG retriever.';

-- ================================================================
-- 7. legal_ai_usage — monthly fair-use metering
-- ================================================================
-- The add-on is gated both by subscription AND by a monthly analysis
-- cap to prevent abuse / runaway Gemini costs.
CREATE TABLE IF NOT EXISTS public.legal_ai_usage (
  user_id           UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period_start      DATE        NOT NULL,                    -- first day of the month
  analyses_count    INTEGER     NOT NULL DEFAULT 0,
  pages_processed   INTEGER     NOT NULL DEFAULT 0,
  last_analysis_at  TIMESTAMPTZ,
  PRIMARY KEY (user_id, period_start)
);

ALTER TABLE public.legal_ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "legal_ai_usage_owner_read" ON public.legal_ai_usage
  FOR SELECT USING (user_id = auth.uid());

-- ================================================================
-- 8. subscription_tier enum — no change (basic/pro/premium stays).
--    The Legal-AI add-on is an ORTHOGONAL boolean on subscriptions,
--    so it can be sold on top of any base tier. This is the key
--    commercial flexibility the consolidation asked for.
-- ================================================================

-- Done. Seed the corpus next via `npm run legal-ai:seed-corpus`.

-- ================================================================
-- 9. RPCs used by the Legal-AI engine (src/lib/legal-ai/*)
-- ================================================================

-- ── match_legal_corpus: pgvector cosine similarity search ─────
-- Called by src/lib/legal-ai/gemini.ts → matchLegalCorpus().
-- Falls back to a keyword scan in app code if this RPC is absent.
CREATE OR REPLACE FUNCTION public.match_legal_corpus(
  query_embedding vector(768),
  match_count     INTEGER DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  id              UUID,
  law_name        TEXT,
  law_type        TEXT,
  article_number  TEXT,
  title           TEXT,
  content         TEXT,
  similarity      FLOAT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id,
    law_name,
    law_type,
    article_number,
    title,
    content,
    1 - (embedding <=> query_embedding) AS similarity
  FROM public.legal_corpus
  WHERE embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

COMMENT ON FUNCTION public.match_legal_corpus IS
  'Cosine-similarity RAG retriever over legal_corpus. Used by the Legal-AI document analysis engine. SECURITY DEFINER so authenticated users can search without direct table UPDATE rights on the embedding column.';

-- ── increment_legal_ai_usage: atomic monthly counter bump ────
-- Called by src/lib/legal-ai/analyze-save.ts after each analysis.
CREATE OR REPLACE FUNCTION public.increment_legal_ai_usage(
  p_user_id UUID,
  p_period  DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.legal_ai_usage (user_id, period_start, analyses_count, pages_processed, last_analysis_at)
  VALUES (p_user_id, p_period, 1, 0, NOW())
  ON CONFLICT (user_id, period_start)
  DO UPDATE SET
    analyses_count   = legal_ai_usage.analyses_count + 1,
    last_analysis_at = NOW();
END;
$$;

COMMENT ON FUNCTION public.increment_legal_ai_usage IS
  'Atomic increment of the monthly Legal-AI analysis counter. Used for fair-use enforcement on the paid add-on.';

