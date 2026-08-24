-- ============================================================
-- Fix P0 Critical findings - 2026-08-25 (clean, build-safe)
-- Addresses SEC-02, SEC-03, SEC-04, BUG-06
-- Run in: Supabase Dashboard → SQL Editor → paste → Run
-- ============================================================

-- ── FIX SEC-02: handle_new_auth_user must NOT trust client role ──
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, locale, data_region)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    'client',
    COALESCE(NEW.raw_user_meta_data->>'locale', 'en'),
    COALESCE((NEW.raw_user_meta_data->>'data_region')::data_region, 'eu')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name   = EXCLUDED.full_name,
    locale      = EXCLUDED.locale,
    data_region = EXCLUDED.data_region,
    updated_at  = NOW();
  RETURN NEW;
END; $$;

-- ── FIX SEC-04: users_update_own must not allow role/subscription_tier self-elevation ──
DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.block_privileged_user_update()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role
      OR NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier) THEN
    IF current_setting('role', true) != 'service_role' THEN
      RAISE EXCEPTION 'privileged column update requires service_role';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS users_block_privileged_update ON public.users;
CREATE TRIGGER users_block_privileged_update
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.block_privileged_user_update();

-- ── FIX SEC-03: payment_orders owner-update must not allow self-verify ──
DROP POLICY IF EXISTS "payment_orders_owner_update" ON public.payment_orders;

-- ── FIX BUG-06: Ensure evidence-vault bucket exists ──
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence-vault', 'evidence-vault', false)
ON CONFLICT (id) DO NOTHING;
