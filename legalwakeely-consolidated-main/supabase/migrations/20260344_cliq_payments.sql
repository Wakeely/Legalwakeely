-- ================================================================
-- Migration 20260344_cliq_payments.sql
-- ================================================================
-- CliQ payment system for Jordan market (Stripe is not available).
-- CliQ is Jordan's national mobile payment platform by JoPACC.
--
-- Payment flow:
--   1. User selects a plan → system creates a payment_order with a
--      unique reference code + the merchant's CliQ alias to pay to.
--   2. User pays via their bank app (CliQ transfer) and includes the
--      reference code in the payment note.
--   3. User uploads proof of payment (screenshot) via the billing page.
--   4. Admin verifies the payment in the admin panel → subscription
--      is activated for the paid period.
--   5. If rejected, the user can re-upload or create a new order.
--
-- This is a semi-manual flow (common in markets without card payment
-- infrastructure). Subscriptions are prepaid (pay for N months upfront),
-- not auto-renewing.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.payment_orders (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- What was purchased
  plan_type             TEXT        NOT NULL CHECK (plan_type IN ('basic','pro','premium','legal_ai_addon')),
  billing_period        TEXT        NOT NULL CHECK (billing_period IN ('monthly','quarterly','annual')),
  amount_jod            NUMERIC(10,3) NOT NULL,    -- in JOD (e.g. 29.000)

  -- Payment instructions shown to user
  reference             TEXT        NOT NULL UNIQUE,             -- short code, e.g. "LW-A7B3X9"
  cliq_alias            TEXT        NOT NULL,                     -- merchant alias to pay to
  cliq_alias_name       TEXT,                                      -- merchant display name

  -- Proof of payment (uploaded by user)
  proof_url             TEXT,                                      -- Supabase Storage path to screenshot
  proof_transaction_id  TEXT,                                      -- CliQ transaction ID (if user has it)
  proof_uploaded_at     TIMESTAMPTZ,

  -- Verification (admin action)
  status                TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','proof_uploaded','verified','rejected','expired')),
  verified_by           UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  verified_at           TIMESTAMPTZ,
  rejection_reason      TEXT,

  -- What the verified payment activated
  activated_tier        TEXT,    -- the subscription tier that was set (if plan_type is a base tier)
  activated_legal_ai    BOOLEAN DEFAULT FALSE,  -- true if this payment enabled the legal_ai add-on
  period_end            TIMESTAMPTZ,  -- when the paid period ends

  expires_at            TIMESTAMPTZ NOT NULL,  -- order itself expires if no proof uploaded
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user   ON public.payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON public.payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_ref    ON public.payment_orders(reference);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

-- Owner can read their own orders + upload proof
CREATE POLICY "payment_orders_owner_read" ON public.payment_orders
  FOR SELECT USING (user_id = auth.uid());

-- Owner can insert (create order) and update proof fields only
CREATE POLICY "payment_orders_owner_insert" ON public.payment_orders
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "payment_orders_owner_update" ON public.payment_orders
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins (service role) can read/update all for verification.
-- The admin API route uses createAdminClient which bypasses RLS.

DROP TRIGGER IF EXISTS payment_orders_updated_at ON public.payment_orders;
CREATE TRIGGER payment_orders_updated_at BEFORE UPDATE ON public.payment_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ================================================================
-- Also: add a `payment_method` column to subscriptions so we know
-- whether a subscription was activated via Stripe or CliQ.
-- ================================================================
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cliq'
    CHECK (payment_method IN ('stripe','cliq','manual'));

COMMENT ON COLUMN public.subscriptions.payment_method IS
  'How the subscription was paid: stripe (card), cliq (Jordan mobile payment), or manual (admin override).';
