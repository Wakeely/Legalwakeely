"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";

export interface SessionUser {
  id: string;
  name: string;
  role: "CITIZEN" | "LAWYER" | "ADMIN";
  phone: string;
  lawyerId?: string;
}

interface SessionContextValue {
  user: SessionUser | null;
  setUser: (u: SessionUser | null) => void;
  signOut: () => void;
  loading: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function mapDbRole(role: string | null | undefined): SessionUser["role"] {
  const r = (role ?? "").toLowerCase();
  if (r === "lawyer") return "LAWYER";
  if (r === "admin") return "ADMIN";
  return "CITIZEN";
}

/**
 * Build a SessionUser from a Supabase auth user, reading the role from
 * `public.users.role` (the DB) rather than `user_metadata.role` alone.
 *
 * Why: `user_metadata.role` can drift from the DB row (e.g. role changed
 * by an admin via `/api/admin/users` PATCH, but auth metadata was never
 * updated). The DB row is the source of truth that the (lawyer) and
 * (admin) layouts check, so the client-side session must agree.
 *
 * Falls back to `user_metadata.role` only if the DB read fails (RLS,
 * network) so the UI doesn't break entirely.
 */
async function buildSessionUser(
  u: {
    id: string;
    email?: string;
    phone?: string;
    user_metadata?: Record<string, unknown>;
  } | null,
): Promise<SessionUser | null> {
  if (!u) return null;

  const md = u.user_metadata ?? {};

  // Source of truth: public.users.role (not auth metadata alone)
  try {
    const supabase = createClient();
    const { data: profile } = await supabase
      .from("users")
      .select("role, full_name, phone")
      .eq("id", u.id)
      .maybeSingle();

    return {
      id: u.id,
      name:
        (profile?.full_name as string) ||
        (md.full_name as string) ||
        (md.name as string) ||
        u.email ||
        "",
      role: mapDbRole(profile?.role as string | null | undefined),
      phone: (profile?.phone as string) || u.phone || (md.phone as string) || "",
      lawyerId: md.lawyer_id as string | undefined,
    };
  } catch {
    // Fallback to metadata if profile read fails (RLS / network).
    // This is best-effort — the server-side layouts and API routes
    // always re-check the DB, so a stale metadata role here can't
    // grant actual access.
    const roleRaw = (md.role as string | undefined)?.toUpperCase();
    const role: SessionUser["role"] =
      roleRaw === "LAWYER" ? "LAWYER" : roleRaw === "ADMIN" ? "ADMIN" : "CITIZEN";
    return {
      id: u.id,
      name: (md.full_name as string) || (md.name as string) || u.email || "",
      role,
      phone: u.phone ?? (md.phone as string) ?? "",
      lawyerId: md.lawyer_id as string | undefined,
    };
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    async function init() {
      try {
        const supabase = createClient();
        const {
          data: { user: u },
        } = await supabase.auth.getUser();

        if (mounted) {
          setUser(await buildSessionUser(u as never));
          setLoading(false);
        }

        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!mounted) return;
          void (async () => {
            try {
              setUser(await buildSessionUser((session?.user as never) ?? null));
              setLoading(false);
            } catch {
              // never crash on auth state change
            }
          })();
        });

        unsubscribe = () => data?.subscription?.unsubscribe?.();
      } catch {
        if (mounted) setLoading(false);
      }
    }

    void init();
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      setUser: () => {}, // no-op for compatibility; Supabase is source of truth
      signOut: async () => {
        try {
          const supabase = createClient();
          await supabase.auth.signOut();
        } catch {
          // ignore
        }
        setUser(null);
      },
      loading,
    }),
    [user, loading],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
