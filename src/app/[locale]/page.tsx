import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LandingContent from '@/components/landing/landing-content';

/* ─── Main page (server component — handles auth redirect only) ─── */
export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params; // ✅ locale comes from the URL

  // If user is already logged in, send to dashboard
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect(`/${locale}/dashboard`);
  }

  return <LandingContent locale={locale} />;
}
