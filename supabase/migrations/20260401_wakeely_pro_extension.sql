-- ================================================================
-- Wakeely Pro — Extension Migration (matches real LegalWakeely schema)
-- Run AFTER 20260348_fix_rate_limit_log_rls.sql
-- ================================================================
-- This does NOT create a parallel case-management system. It extends
-- your existing public.cases / case_lawyers / documents / deadlines /
-- timeline_events tables, and adds only what's genuinely new: firms
-- (multi-lawyer practices), discovery tracking, time entries, and
-- workflow templates.
--
-- Safe to re-run: every CREATE is IF NOT EXISTS, every ALTER TABLE
-- ADD COLUMN is IF NOT EXISTS, every policy is DROP + CREATE.
-- ================================================================

-- ── 1. Firms (genuinely new — solo lawyers today have no firm concept) ──
CREATE TABLE IF NOT EXISTS public.firms (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL,
  name_ar             TEXT,
  plan                TEXT        NOT NULL DEFAULT 'trial'
                          CHECK (plan IN ('trial','solo','firm','enterprise')),
  billing_customer_id TEXT, -- Stripe customer id, mirrors pattern in invoices/subscriptions
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS firms_updated_at ON public.firms;
CREATE TRIGGER firms_updated_at BEFORE UPDATE ON public.firms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.firm_members (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id    UUID        NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL CHECK (role IN ('owner','lawyer','staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (firm_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_firm_members_user ON public.firm_members(user_id);

-- Tag which firm a case_lawyers engagement belongs to (nullable — existing
-- solo lawyer engagements are unaffected and stay NULL).
ALTER TABLE public.case_lawyers ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.firms(id);
CREATE INDEX IF NOT EXISTS idx_case_lawyers_firm ON public.case_lawyers(firm_id);

-- ── 2. Extend deadlines to double as tasks (no new pro_tasks table) ──
-- Existing `deadlines` already has: case_id, title, description, due_date,
-- type (court/submission/internal), status (pending/completed/missed).
-- We add an owner and a priority so it can carry a lawyer's day-to-day
-- task list, not just court deadlines. due_date becomes optional since a
-- plain task ("draft motion") may not have a hard date yet.
ALTER TABLE public.deadlines ALTER COLUMN due_date DROP NOT NULL;
ALTER TABLE public.deadlines ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.users(id);
ALTER TABLE public.deadlines ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium'
  CHECK (priority IN ('low','medium','high','critical'));

CREATE INDEX IF NOT EXISTS idx_deadlines_assigned_to ON public.deadlines(assigned_to);

-- ── 3. Extend documents with category + client visibility ──
-- Defaults preserve today's behavior: every existing document stays
-- category='general' and is_client_visible=true, so nothing already
-- uploaded disappears from a client's view after this migration runs.
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general'
  CHECK (category IN ('pleading','evidence','correspondence','contract','discovery','court_order','invoice','general'));
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS is_client_visible BOOLEAN NOT NULL DEFAULT true;

-- ── 4. Extend timeline_events with visibility (the real client-sync bridge) ──
-- timeline_events already is the activity feed both sides read from — we
-- don't need a new bridge table, just a way for a lawyer to post something
-- that's internal-only. Existing rows default to 'client_visible' so past
-- history and today's client-facing behavior don't change.
ALTER TABLE public.timeline_events ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'client_visible'
  CHECK (visibility IN ('internal','client_visible'));

-- ── 5. Discovery tracking (genuinely new, lawyer-only, complex litigation) ──
CREATE TABLE IF NOT EXISTS public.discovery_requests (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id             UUID        NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  request_type        TEXT        NOT NULL CHECK (request_type IN
                          ('interrogatory','document_request','deposition','admission','subpoena','expert_disclosure')),
  direction           TEXT        NOT NULL CHECK (direction IN ('incoming','outgoing')),
  description         TEXT        NOT NULL,
  served_date         DATE,
  response_due_date   DATE,
  status              TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','in_progress','responded','objected','overdue')),
  linked_document_id  UUID        REFERENCES public.documents(id),
  created_by          UUID        NOT NULL REFERENCES public.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS discovery_requests_updated_at ON public.discovery_requests;
CREATE TRIGGER discovery_requests_updated_at BEFORE UPDATE ON public.discovery_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_discovery_requests_case ON public.discovery_requests(case_id);

-- ── 6. Time entries (genuinely new — feeds your EXISTING invoice_items later) ──
-- Not creating a new invoice table: you already have `invoices` /
-- `invoice_items` (20260336_invoice_system.sql). time_entries links to
-- invoice_items only once a phase-2 billing UI generates one from it.
CREATE TABLE IF NOT EXISTS public.time_entries (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id          UUID        NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  lawyer_id        UUID        NOT NULL REFERENCES public.users(id),
  minutes          INT         NOT NULL CHECK (minutes > 0),
  rate_per_hour    NUMERIC(10,2),
  description      TEXT        NOT NULL,
  is_billable      BOOLEAN     NOT NULL DEFAULT true,
  entry_date       DATE        NOT NULL DEFAULT current_date,
  invoice_item_id  UUID        REFERENCES public.invoice_items(id), -- ⚠️ CHECK THIS: set once invoice_items schema is confirmed compatible
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_case ON public.time_entries(case_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_lawyer ON public.time_entries(lawyer_id);

-- ── 7. Workflow templates (genuinely new — matter checklists) ──
CREATE TABLE IF NOT EXISTS public.workflow_templates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     UUID        REFERENCES public.firms(id) ON DELETE CASCADE, -- NULL = system default
  name        TEXT        NOT NULL,
  case_type   case_type,  -- reuses your existing case_type enum
  steps       JSONB       NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_instances (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id       UUID        NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  template_id   UUID        REFERENCES public.workflow_templates(id),
  current_step  INT         NOT NULL DEFAULT 0,
  status        TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','abandoned')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_instances_case ON public.workflow_instances(case_id);

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE public.firms                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firm_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_instances   ENABLE ROW LEVEL SECURITY;

-- Helper: is this user a member of a given firm?
CREATE OR REPLACE FUNCTION public.is_firm_member(p_firm_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER SET search_path = public
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.firm_members
    WHERE firm_id = p_firm_id AND user_id = auth.uid()
  );
$$;

-- Helper: is this user an active lawyer on a case WITH write permission?
CREATE OR REPLACE FUNCTION public.is_active_lawyer_write(p_case_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER SET search_path = public
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.case_lawyers
    WHERE case_id     = p_case_id
      AND lawyer_id   = auth.uid()
      AND status      = 'active'
      AND permissions IN ('write','read_write')
  );
$$;

-- ── FIRMS ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "firms_select" ON public.firms;
DROP POLICY IF EXISTS "firms_update" ON public.firms;

CREATE POLICY "firms_select" ON public.firms
  FOR SELECT USING (public.is_firm_member(id));

CREATE POLICY "firms_update" ON public.firms
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.firm_members WHERE firm_id = id AND user_id = auth.uid() AND role = 'owner')
  );

-- ── FIRM_MEMBERS ─────────────────────────────────────────────
DROP POLICY IF EXISTS "firm_members_select" ON public.firm_members;

CREATE POLICY "firm_members_select" ON public.firm_members
  FOR SELECT USING (public.is_firm_member(firm_id));

-- ── DEADLINES — add lawyer write, on top of existing client-all + lawyer-select ──
-- Existing "deadlines_client_all" and "deadlines_lawyer_select" from
-- 002_rls_policies.sql are left untouched. This ADDS write access for a
-- lawyer with write permission — today lawyers can only read deadlines.
DROP POLICY IF EXISTS "deadlines_lawyer_write" ON public.deadlines;

CREATE POLICY "deadlines_lawyer_write" ON public.deadlines
  FOR ALL
  USING (public.is_active_lawyer_write(case_id))
  WITH CHECK (public.is_active_lawyer_write(case_id));

-- ── DOCUMENTS — client SELECT now respects is_client_visible ──
-- "docs_insert" is untouched. "docs_select" is replaced so a client only
-- sees is_client_visible = true documents, while lawyers keep seeing all
-- (including internal work-product marked is_client_visible = false).
DROP POLICY IF EXISTS "docs_select" ON public.documents;

CREATE POLICY "docs_select" ON public.documents
  FOR SELECT USING (
    (public.is_case_client(case_id) AND is_client_visible = true)
    OR public.is_active_lawyer(case_id)
  );

-- ── TIMELINE_EVENTS — client SELECT now respects visibility ──
-- "timeline_insert" is untouched (still gated by write permission).
-- "timeline_select_client" is replaced so clients only see
-- visibility = 'client_visible' rows; lawyers still see everything.
DROP POLICY IF EXISTS "timeline_select_client" ON public.timeline_events;

CREATE POLICY "timeline_select_client" ON public.timeline_events
  FOR SELECT USING (public.is_case_client(case_id) AND visibility = 'client_visible');

-- ── DISCOVERY_REQUESTS — lawyer-only, no client access (internal case prep) ──
DROP POLICY IF EXISTS "discovery_lawyer_select" ON public.discovery_requests;
DROP POLICY IF EXISTS "discovery_lawyer_write"  ON public.discovery_requests;

CREATE POLICY "discovery_lawyer_select" ON public.discovery_requests
  FOR SELECT USING (public.is_active_lawyer(case_id));

CREATE POLICY "discovery_lawyer_write" ON public.discovery_requests
  FOR ALL
  USING (public.is_active_lawyer_write(case_id))
  WITH CHECK (public.is_active_lawyer_write(case_id));

-- ── TIME_ENTRIES — lawyer-own-entries only ──
DROP POLICY IF EXISTS "time_entries_own" ON public.time_entries;

CREATE POLICY "time_entries_own" ON public.time_entries
  FOR ALL
  USING (lawyer_id = auth.uid())
  WITH CHECK (lawyer_id = auth.uid());

-- ── WORKFLOW_TEMPLATES / INSTANCES — lawyer-only ──
DROP POLICY IF EXISTS "workflow_templates_select" ON public.workflow_templates;
CREATE POLICY "workflow_templates_select" ON public.workflow_templates
  FOR SELECT USING (firm_id IS NULL OR public.is_firm_member(firm_id));

DROP POLICY IF EXISTS "workflow_instances_lawyer" ON public.workflow_instances;
CREATE POLICY "workflow_instances_lawyer" ON public.workflow_instances
  FOR ALL
  USING (public.is_active_lawyer(case_id))
  WITH CHECK (public.is_active_lawyer_write(case_id));

-- ================================================================
-- Seed: default workflow template (idempotent)
-- ================================================================
INSERT INTO public.workflow_templates (firm_id, name, case_type, steps)
SELECT NULL, 'New Litigation Intake', 'commercial',
  '[
    {"title":"Conflict check", "default_due_offset_days":1},
    {"title":"Engagement letter signed", "default_due_offset_days":3},
    {"title":"Case file opened & documents requested", "default_due_offset_days":5},
    {"title":"Initial pleading drafted", "default_due_offset_days":14},
    {"title":"Filing", "default_due_offset_days":21}
  ]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.workflow_templates WHERE firm_id IS NULL AND name = 'New Litigation Intake'
);
