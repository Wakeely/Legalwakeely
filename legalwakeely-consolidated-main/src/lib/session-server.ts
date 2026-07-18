import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ServerSessionUser {
  id: string;
  name: string;
  role: "CITIZEN" | "LAWYER" | "ADMIN";
  phone: string;
  lawyerId?: string;
}

/**
 * Returns the current authenticated user, mapped to the SessionUser
 * shape the Legal-AI module expects. Reads from Supabase auth (cookie
 * session), NOT from a custom cookie — this is the consolidation fix.
 */
export async function getServerSession(): Promise<ServerSessionUser | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const md = (user.user_metadata ?? {}) as Record<string, unknown>;
    const roleRaw = (md.role as string | undefined)?.toUpperCase();
    const role: ServerSessionUser["role"] =
      roleRaw === "LAWYER" ? "LAWYER" : roleRaw === "ADMIN" ? "ADMIN" : "CITIZEN";
    return {
      id: user.id,
      name: (md.full_name as string) || (md.name as string) || user.email || "",
      role,
      phone: user.phone ?? (md.phone as string) ?? "",
      lawyerId: md.lawyer_id as string | undefined,
    };
  } catch {
    return null;
  }
}
