-- Fix: Enable RLS on rate_limit_log (was missing — critical vulnerability)
-- This table stores IP addresses, endpoints, and request counts.
-- Without RLS, any authenticated user can read/tamper with rate-limit data.

ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

-- Only service_role should access rate-limit data (bypasses RLS automatically)
CREATE POLICY "rate_limit_admin_only" ON public.rate_limit_log
  FOR ALL USING (false) WITH CHECK (false);
