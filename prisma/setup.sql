-- =====================================================
-- Legal Navigator Pro — Supabase/Postgres manual setup
-- Run this in Supabase SQL Editor after `prisma db push`
-- Adds pgvector extension and embedding column for RAG
-- =====================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Recreate embedding column at 768-dim (matches Google gemini-embedding-001)
-- Drop the old column (and any old index) first to allow re-adding with new dim
DROP INDEX IF EXISTS "LegalCorpus_embedding_idx";
ALTER TABLE "LegalCorpus" DROP COLUMN IF EXISTS embedding;
ALTER TABLE "LegalCorpus" ADD COLUMN embedding vector(768);

-- 3. HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS "LegalCorpus_embedding_idx"
  ON "LegalCorpus"
  USING hnsw (embedding vector_cosine_ops);

-- 3b. Unique index on (lawName, articleNumber) to prevent duplicate ingest
-- NULL articleNumber is treated as a distinct value (Postgres standard behaviour)
CREATE UNIQUE INDEX IF NOT EXISTS "LegalCorpus_law_article_uniq"
  ON "LegalCorpus" ("lawName", "articleNumber");

-- 4. Helper function: similarity search for legal articles
-- Cast parameters to int explicitly so Prisma $queryRaw works (it sends bigint for int)
CREATE OR REPLACE FUNCTION match_legal_corpus(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 8
)
RETURNS TABLE (
  id text,
  "lawName" text,
  "lawType" text,
  "articleNumber" text,
  title text,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    lc.id,
    lc."lawName",
    lc."lawType",
    lc."articleNumber",
    lc.title,
    lc.content,
    1 - (lc.embedding <=> query_embedding) AS similarity
  FROM "LegalCorpus" lc
  WHERE 1 - (lc.embedding <=> query_embedding) > match_threshold
  ORDER BY lc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. Row-Level Security (RLS) — enable and add baseline policies
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Analysis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LawyerProfile" ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
DROP POLICY IF EXISTS "users_read_own" ON "User";
CREATE POLICY "users_read_own" ON "User"
  FOR SELECT USING (auth.uid()::text = id);

-- Users can read lawyer profiles (public)
DROP POLICY IF EXISTS "lawyer_profiles_public_read" ON "LawyerProfile";
CREATE POLICY "lawyer_profiles_public_read" ON "LawyerProfile"
  FOR SELECT USING (verified = true);

-- Users can read their own documents
DROP POLICY IF EXISTS "documents_read_own" ON "Document";
CREATE POLICY "documents_read_own" ON "Document"
  FOR SELECT USING (auth.uid()::text = "userId");

-- Users can insert their own documents
DROP POLICY IF EXISTS "documents_insert_own" ON "Document";
CREATE POLICY "documents_insert_own" ON "Document"
  FOR INSERT WITH CHECK (auth.uid()::text = "userId");

-- Users can read their own analyses
DROP POLICY IF EXISTS "analyses_read_own" ON "Analysis";
CREATE POLICY "analyses_read_own" ON "Analysis"
  FOR SELECT USING (auth.uid()::text = "userId");

-- Lawyers can read leads addressed to them
DROP POLICY IF EXISTS "leads_read_lawyer" ON "Lead";
CREATE POLICY "leads_read_lawyer" ON "Lead"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "LawyerProfile" lp
      WHERE lp.id = "Lead"."lawyerId"
      AND lp."userId" = auth.uid()::text
    )
  );

-- Users can read their own leads
DROP POLICY IF EXISTS "leads_read_user" ON "Lead";
CREATE POLICY "leads_read_user" ON "Lead"
  FOR SELECT USING (auth.uid()::text = "userId");

-- Service role bypasses RLS automatically (used in API routes)
-- Note: SUPABASE_SERVICE_ROLE_KEY should never be exposed to the client.
