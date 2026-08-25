-- ============================================================
-- Fix P1 Batch4 - Payments & Invoices
-- ============================================================

-- ── FIX SEC-21: payment_orders arbitrary amount guard ──
-- Ensure amount_jod matches canonical plan price (if plan_type provided)
-- For now, enforce amount_jod > 0 and < 10000, and plan_type in allowed set
CREATE OR REPLACE FUNCTION public.check_payment_amount()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.amount_jod IS NOT NULL AND (NEW.amount_jod <= 0 OR NEW.amount_jod > 10000) THEN
    RAISE EXCEPTION 'amount_jod out of range';
  END IF;
  IF NEW.plan_type IS NOT NULL AND NEW.plan_type NOT IN ('basic','pro','premium','legal_ai_addon') THEN
    RAISE EXCEPTION 'invalid plan_type';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS payment_orders_check_amount ON public.payment_orders;
CREATE TRIGGER payment_orders_check_amount
  BEFORE INSERT OR UPDATE ON public.payment_orders
  FOR EACH ROW EXECUTE FUNCTION public.check_payment_amount();
