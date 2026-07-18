import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/auth/logout
 *
 * Signs the user out and redirects to the landing page.
 */
export async function GET() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://legalwakeely.com";
  return NextResponse.redirect(new URL("/", appUrl));
}
