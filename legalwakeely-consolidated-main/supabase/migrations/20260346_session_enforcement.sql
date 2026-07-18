-- ================================================================
-- Migration 20260346_session_enforcement.sql
-- ================================================================
-- One-user-per-account enforcement: tracks active sessions per user
-- so we can detect and block account sharing.
--
-- Flow:
--   1. On login: insert a new active_sessions row with the device
--      fingerprint + IP. Mark all PREVIOUS sessions for that user
--      as 'superseded' (force-logout the old device).
--   2. On every protected request: middleware checks if the current
--      session_id is still 'active'. If it's 'superseded', the user
--      is logged out with an "account in use elsewhere" message.
--   3. On logout: mark the session as 'revoked'.
--   4. Admins can view + revoke any user's sessions from the admin
--      panel.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.active_sessions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id          TEXT        NOT NULL UNIQUE,    -- Supabase access token JID or a generated UUID
  status              TEXT        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'superseded', 'revoked', 'expired')),

  -- Device identification
  device_fingerprint  TEXT        NOT NULL,           -- browser fingerprint hash
  device_label        TEXT,                             -- "Chrome on macOS" etc.
  ip_address          INET,                             -- last known IP
  user_agent          TEXT,                             -- raw UA string

  -- Timing
  last_active_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ NOT NULL,             -- when the session token expires
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Conflict tracking
  superseded_by       UUID        REFERENCES public.active_sessions(id) ON DELETE SET NULL,
  superseded_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_user   ON public.active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_status ON public.active_sessions(status);
CREATE INDEX IF NOT EXISTS idx_active_sessions_fp     ON public.active_sessions(user_id, device_fingerprint);

ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

-- Users can read their own sessions (for the /settings/devices page)
CREATE POLICY "active_sessions_owner_read" ON public.active_sessions
  FOR SELECT USING (user_id = auth.uid());

-- Users can update their own sessions (last_active_at heartbeat)
CREATE POLICY "active_sessions_owner_update" ON public.active_sessions
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Users can revoke their own sessions (but NOT insert — inserts go via
-- the service role in the login hook)
CREATE POLICY "active_sessions_owner_delete" ON public.active_sessions
  FOR DELETE USING (user_id = auth.uid());

-- Inserts are service-role only (the login hook uses createAdminClient)
-- No INSERT policy = users can't insert, admin can.

DROP TRIGGER IF EXISTS active_sessions_updated_at ON public.active_sessions;
CREATE TRIGGER active_sessions_updated_at BEFORE UPDATE ON public.active_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ================================================================
-- Suspicious activity log — for usage monitoring
-- ================================================================
CREATE TABLE IF NOT EXISTS public.suspicious_activity (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  activity_type   TEXT        NOT NULL,    -- 'multiple_ips', 'high_volume', 'rapid_logins', 'fingerprint_mismatch'
  severity        TEXT        NOT NULL DEFAULT 'warn' CHECK (severity IN ('info', 'warn', 'critical')),
  details         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  ip_address      INET,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suspicious_user    ON public.suspicious_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_suspicious_created ON public.suspicious_activity(created_at DESC);

ALTER TABLE public.suspicious_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suspicious_activity_owner_read" ON public.suspicious_activity
  FOR SELECT USING (user_id = auth.uid());

-- ================================================================
-- Helper: mark old sessions as superseded when a new login occurs
-- ================================================================
CREATE OR REPLACE FUNCTION public.supersede_user_sessions(
  p_user_id      UUID,
  p_new_session_id TEXT,
  p_fingerprint  TEXT,
  p_ip           INET,
  p_user_agent   TEXT,
  p_device_label TEXT,
  p_expires_at   TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_uuid UUID;
  v_old_count    INTEGER;
BEGIN
  -- Count existing active sessions for this user
  SELECT COUNT(*) INTO v_old_count
  FROM public.active_sessions
  WHERE user_id = p_user_id AND status = 'active';

  -- Mark all previous active sessions as 'superseded'
  UPDATE public.active_sessions
  SET status = 'superseded',
      superseded_at = now()
  WHERE user_id = p_user_id AND status = 'active';

  -- Insert the new session
  INSERT INTO public.active_sessions (
    user_id, session_id, status, device_fingerprint, device_label,
    ip_address, user_agent, expires_at
  )
  VALUES (
    p_user_id, p_new_session_id, 'active', p_fingerprint, p_device_label,
    p_ip, p_user_agent, p_expires_at
  )
  RETURNING id INTO v_session_uuid;

  -- If there were old sessions, log it as suspicious (potential sharing)
  IF v_old_count > 0 THEN
    INSERT INTO public.suspicious_activity (user_id, activity_type, severity, details, ip_address)
    VALUES (
      p_user_id,
      'rapid_logins',
      'warn',
      jsonb_build_object(
        'old_sessions_superseded', v_old_count,
        'new_fingerprint', p_fingerprint,
        'device_label', p_device_label,
        'message', 'Login from new device superseded existing session'
      ),
      p_ip
    );
  END IF;

  RETURN v_session_uuid;
END;
$$;

COMMENT ON FUNCTION public.supersede_user_sessions IS
  'Called on every login. Marks all previous active sessions as superseded and inserts the new session. Logs suspicious activity if old sessions existed.';

-- ================================================================
-- Cleanup: expire old sessions periodically
-- ================================================================
CREATE OR REPLACE FUNCTION public.expire_old_sessions()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH expired AS (
    UPDATE public.active_sessions
    SET status = 'expired'
    WHERE status = 'active' AND expires_at < now()
    RETURNING 1
  )
  SELECT COUNT(*) FROM expired;
$$;

COMMENT ON FUNCTION public.expire_old_sessions IS
  'Mark sessions as expired if their token has expired. Call from a cron job.';
