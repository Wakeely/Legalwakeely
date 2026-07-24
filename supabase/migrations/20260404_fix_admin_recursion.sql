-- ================================================================
-- Fix: infinite recursion in admin RLS policies
-- ================================================================
-- 20260324_phase4_admin_security.sql created 6 policies that check
-- "is the current user an admin?" by running:
--
--   EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
--
-- Querying public.users from WITHIN a policy triggers users' own RLS —
-- including admin_users_select itself, which runs the exact same
-- subquery again, forever. Postgres detects this and throws
-- "infinite recursion detected in policy for relation users" — which
-- breaks not just admin screens but ANY query that touches users,
-- including ordinary client case creation.
--
-- Fix: move the admin check into a SECURITY DEFINER function. Functions
-- marked SECURITY DEFINER bypass RLS on the tables they query internally,
-- so the recursion never starts — this is the same pattern already used
-- for is_user_case_lawyer / is_active_lawyer / is_case_client elsewhere
-- in this schema, just not applied here originally.
--
-- Not part of Wakeely Pro — this migration only touches the 6 admin
-- policies from 20260324_phase4_admin_security.sql. Safe to re-run.
-- ================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
SECURITY DEFINER SET search_path = public
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "admin_users_select" ON public.users;
CREATE POLICY "admin_users_select" ON public.users
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admin_users_update" ON public.users;
CREATE POLICY "admin_users_update" ON public.users
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "admin_cases_select" ON public.cases;
CREATE POLICY "admin_cases_select" ON public.cases
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admin_subscriptions_select" ON public.subscriptions;
CREATE POLICY "admin_subscriptions_select" ON public.subscriptions
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admin_audit_select" ON public.audit_logs;
CREATE POLICY "admin_audit_select" ON public.audit_logs
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admin_notifications_select" ON public.notifications;
CREATE POLICY "admin_notifications_select" ON public.notifications
  FOR SELECT USING (public.is_admin());
