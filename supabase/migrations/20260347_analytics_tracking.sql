-- ================================================================
-- Migration 20260347_analytics_tracking.sql
-- ================================================================
-- Simple server-side page view tracking. Works without PostHog or
-- any external service — just counts visits in Supabase.
--
-- For richer analytics (funnels, session replay, heatmaps), add a
-- PostHog key to NEXT_PUBLIC_POSTHOG_KEY — the analytics-provider.tsx
-- component will activate automatically.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.page_views (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id      TEXT        NOT NULL,    -- anonymous cookie ID (not user ID)
  user_id         UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  path            TEXT        NOT NULL,
  locale          TEXT,
  referrer        TEXT,
  user_agent      TEXT,
  ip_address      INET,
  country         TEXT,       -- from Cloudflare/Vercel header
  device_type     TEXT        CHECK (device_type IN ('mobile','tablet','desktop','unknown')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_views_created ON public.page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_path    ON public.page_views(path);
CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON public.page_views(visitor_id);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
-- Only admins can read (via service role). No user RLS.
CREATE POLICY "page_views_admin_only" ON public.page_views
  FOR SELECT USING (false);

-- ================================================================
-- Daily aggregates (for fast dashboard queries)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.daily_analytics (
  date            DATE        NOT NULL,
  total_views     INTEGER     NOT NULL DEFAULT 0,
  unique_visitors INTEGER     NOT NULL DEFAULT 0,
  new_signups     INTEGER     NOT NULL DEFAULT 0,
  new_cases       INTEGER     NOT NULL DEFAULT 0,
  analyses_run    INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (date)
);

ALTER TABLE public.daily_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_analytics_admin_only" ON public.daily_analytics
  FOR SELECT USING (false);
