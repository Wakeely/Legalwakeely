import { redirect } from 'next/navigation';

export default async function LawyerDashboardRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/lawyer/cases`);
}
