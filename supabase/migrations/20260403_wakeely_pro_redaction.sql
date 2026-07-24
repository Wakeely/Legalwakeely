-- ================================================================
-- Wakeely Pro — Document Redaction (Phase 1: draft boxes only)
-- Run AFTER 20260402_wakeely_pro_firm_invites.sql
-- Safe to re-run: IF NOT EXISTS / DROP+CREATE POLICY throughout.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.document_redactions (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID          NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  page_number  INT           NOT NULL CHECK (page_number > 0),
  -- Normalized 0–1 coordinates (fraction of page width/height), NOT pixels —
  -- keeps boxes correct regardless of what zoom level/resolution they were
  -- drawn at vs. later rendered/burned at.
  x            NUMERIC(7,5)  NOT NULL CHECK (x BETWEEN 0 AND 1),
  y            NUMERIC(7,5)  NOT NULL CHECK (y BETWEEN 0 AND 1),
  width        NUMERIC(7,5)  NOT NULL CHECK (width  > 0 AND width  <= 1),
  height       NUMERIC(7,5)  NOT NULL CHECK (height > 0 AND height <= 1),
  mode         TEXT          NOT NULL DEFAULT 'draft' CHECK (mode IN ('draft','burned')),
  category     TEXT          NOT NULL DEFAULT 'manual' CHECK (category IN ('pii','financial','privilege','manual')),
  created_by   UUID          NOT NULL REFERENCES public.users(id),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_redactions_document ON public.document_redactions(document_id);

DROP TRIGGER IF EXISTS document_redactions_updated_at ON public.document_redactions;
CREATE TRIGGER document_redactions_updated_at BEFORE UPDATE ON public.document_redactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Marks a documents row as ITSELF being a burned redaction output (i.e. one
-- created by Phase 3's "burn" action), as opposed to a plain re-upload
-- version. Used starting Phase 3 to compute the [RED-vN] badge by counting
-- how many is_redacted=true rows share the same parent_id lineage — no
-- separate counter column needed.
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS is_redacted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.document_redactions ENABLE ROW LEVEL SECURITY;

-- Redaction boxes are lawyer-only, full stop — they're pre-filing internal
-- work product. No client visibility path at all, unlike documents/timeline.
-- Any active lawyer on the case can view; only write-permission lawyers can
-- create/edit/delete boxes (split into separate policies since a single
-- "FOR ALL" can't apply different rules per operation).
DROP POLICY IF EXISTS "document_redactions_select" ON public.document_redactions;
CREATE POLICY "document_redactions_select" ON public.document_redactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.case_lawyers cl ON cl.case_id = d.case_id
      WHERE d.id = document_redactions.document_id
        AND cl.lawyer_id = auth.uid()
        AND cl.status = 'active'
    )
  );

DROP POLICY IF EXISTS "document_redactions_write" ON public.document_redactions;
CREATE POLICY "document_redactions_write" ON public.document_redactions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.case_lawyers cl ON cl.case_id = d.case_id
      WHERE d.id = document_redactions.document_id
        AND cl.lawyer_id = auth.uid()
        AND cl.status = 'active'
        AND cl.permissions IN ('write','read_write')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.case_lawyers cl ON cl.case_id = d.case_id
      WHERE d.id = document_redactions.document_id
        AND cl.lawyer_id = auth.uid()
        AND cl.status = 'active'
        AND cl.permissions IN ('write','read_write')
    )
  );
