-- ================================================================
-- Migration 20260343_webhook_idempotency.sql
-- ================================================================
-- Deduplication table for Stripe (and other) webhook events.
-- The webhook handler checks this table BEFORE processing an event
-- and inserts a row AFTER successful processing. This makes event
-- handling idempotent — Stripe's automatic retries (which can happen
-- up to ~3 days after the original delivery) won't double-process.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id           TEXT        PRIMARY KEY,            -- the provider's event id (e.g. evt_…)
  provider     TEXT        NOT NULL DEFAULT 'stripe',
  event_type   TEXT        NOT NULL,
  payload_sha  TEXT,                                -- for audit
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider
  ON public.webhook_events(provider, processed_at DESC);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- Service-role only (webhook handler uses admin client). No user RLS.
CREATE POLICY "webhook_events_admin_only" ON public.webhook_events
  FOR ALL USING (false) WITH CHECK (false);
