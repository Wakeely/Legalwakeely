import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Build clients lazily so missing env vars during `next build` (data collection)
// don't crash the build. Routes that need the admin client should use
// `getSupabaseAdmin()` which returns null if not configured.
function buildAdmin() {
  if (!supabaseServiceKey || !supabaseUrl) return null;
  try {
    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch {
    return null;
  }
}

let _admin: ReturnType<typeof buildAdmin> | undefined;
export function getSupabaseAdmin() {
  if (_admin === undefined) _admin = buildAdmin();
  return _admin;
}

// For backward compat — null if not configured
export const supabaseAdmin = getSupabaseAdmin();

// Client-side / browser Supabase client (uses anon key, respects RLS)
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      })
    : null;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && supabaseServiceKey,
);
