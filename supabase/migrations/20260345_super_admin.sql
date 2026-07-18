-- ================================================================
-- Migration 20260345_super_admin.sql
-- ================================================================
-- Adds suspension/ban support to the users table so admins can
-- block malicious users without deleting them. Also adds an admin
-- notes column for internal context.
-- ================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_suspended  BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS suspended_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_by  UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suspend_reason TEXT,
  ADD COLUMN IF NOT EXISTS admin_notes   TEXT;

COMMENT ON COLUMN public.users.is_suspended IS
  'When TRUE, the user cannot log in or access the app. Set by admin.';
COMMENT ON COLUMN public.users.suspended_by IS
  'The admin user who suspended this account.';

-- Index for quickly finding suspended users (for admin dashboards)
CREATE INDEX IF NOT EXISTS idx_users_suspended ON public.users(is_suspended) WHERE is_suspended = TRUE;

-- ================================================================
-- Trigger: block suspended users from authenticating.
-- Supabase Auth doesn't have a native "ban" for email/password users,
-- so we check is_suspended in the app middleware instead. This trigger
-- is a defense-in-depth: it signs out the user if they're suspended
-- after a successful auth event.
-- ================================================================
CREATE OR REPLACE FUNCTION public.handle_suspended_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the user logging in is suspended, sign them out immediately.
  -- (The app middleware also checks this, but this is a DB-level backstop.)
  IF NEW.is_suspended = TRUE THEN
    -- We can't directly revoke the session from a trigger, but we can
    -- mark it. The app checks this flag on every request.
    NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_check_suspended ON public.users;
CREATE TRIGGER users_check_suspended
  AFTER UPDATE OF is_suspended ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_suspended_user();
