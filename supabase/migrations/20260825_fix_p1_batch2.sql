-- ============================================================
-- Fix P1 Batch2 - RLS hardening
-- Addresses SEC-19, SEC-37, SEC-22
-- ============================================================

-- ── FIX SEC-37: document_analyses missing RLS ──
ALTER TABLE public.document_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "document_analyses_owner" ON public.document_analyses;
CREATE POLICY "document_analyses_owner" ON public.document_analyses
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── FIX SEC-19: messages RLS split (prevent client UPDATE/DELETE lawyer messages) ──
DROP POLICY IF EXISTS "messages_participant" ON public.messages;
CREATE POLICY "messages_select_participant" ON public.messages
  FOR SELECT USING (public.is_case_client(case_id) OR public.is_active_lawyer(case_id));
CREATE POLICY "messages_insert_participant" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id AND (public.is_case_client(case_id) OR public.is_active_lawyer(case_id)));
CREATE POLICY "messages_update_own" ON public.messages
  FOR UPDATE USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "messages_delete_own" ON public.messages
  FOR DELETE USING (auth.uid() = sender_id);

-- ── FIX SEC-22: invites/lawyer_invites public readable ──
-- Remove overly permissive FOR SELECT USING (true) if exists, replace with token-only via RPC
-- These policies are in later migrations (20260325, 20260329); drop them here defensively
DROP POLICY IF EXISTS "invites_public_read" ON public.invites;
DROP POLICY IF EXISTS "lawyer_invites_public_read" ON public.lawyer_invites;
DROP POLICY IF EXISTS "invites_select_all" ON public.invites;
DROP POLICY IF EXISTS "lawyer_invites_select_all" ON public.lawyer_invites;
-- No replacement SELECT policy — reads must go through WHERE token = $1 with service_role or dedicated RPC
