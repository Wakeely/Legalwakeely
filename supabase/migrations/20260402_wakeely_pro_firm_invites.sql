-- ================================================================
-- Wakeely Pro — Firm Invites (lets an owner invite lawyers/staff
-- into their firm, mirroring the existing lawyer_invites pattern
-- used for per-case invites)
-- Run AFTER 20260401_wakeely_pro_extension.sql
-- Safe to re-run: IF NOT EXISTS / DROP+CREATE POLICY throughout.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.firm_invites (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id        UUID        NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  created_by     UUID        NOT NULL REFERENCES public.users(id),
  token          TEXT        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invitee_email  TEXT        NOT NULL,
  role_offered   TEXT        NOT NULL DEFAULT 'lawyer' CHECK (role_offered IN ('lawyer','staff')),
  status         TEXT        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','accepted','revoked','expired')),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  accepted_by    UUID        REFERENCES public.users(id),
  accepted_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_firm_invites_firm  ON public.firm_invites(firm_id);
CREATE INDEX IF NOT EXISTS idx_firm_invites_token ON public.firm_invites(token);

ALTER TABLE public.firm_invites ENABLE ROW LEVEL SECURITY;

-- Owner of the firm can manage (create/revoke/list) its invites.
DROP POLICY IF EXISTS "firm_invite_owner_manage" ON public.firm_invites;
CREATE POLICY "firm_invite_owner_manage" ON public.firm_invites
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.firm_members
      WHERE firm_id = firm_invites.firm_id AND user_id = auth.uid() AND role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.firm_members
      WHERE firm_id = firm_invites.firm_id AND user_id = auth.uid() AND role = 'owner'
    )
  );

-- Anyone with the token can look up the invite (same "obscurity via random
-- token" model as lawyer_invites.invite_public_read) — needed so the
-- acceptance page can show invite details before the person logs in.
DROP POLICY IF EXISTS "firm_invite_public_read" ON public.firm_invites;
CREATE POLICY "firm_invite_public_read" ON public.firm_invites
  FOR SELECT USING (true);
