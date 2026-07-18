"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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

function mapSupabaseUser(u: {
  id: string;
  email?: string;
  phone?: string;
  user_metadata?: Record<string, unknown>;
} | null): SessionUser | null {
  if (!u) return null;
  const md = u.user_metadata ?? {};
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

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const supabase = createClient();

        // Get current user
        const { data: { user: u } } = await supabase.auth.getUser();
        if (mounted) {
          setUser(mapSupabaseUser(u as never));
          setLoading(false);
        }

        // Listen for auth state changes
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!mounted) return;
          try {
            setUser(mapSupabaseUser((session?.user as never) ?? null));
            setLoading(false);
          } catch {
            // ignore — never crash on auth state change
          }
        });

        return () => {
          data?.subscription?.unsubscribe?.();
        };
      } catch {
        // Supabase env not configured or client creation failed
        if (mounted) setLoading(false);
      }
    }

    const cleanup = init();
    return () => {
      mounted = false;
      cleanup?.then?.((fn) => fn?.());
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

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
