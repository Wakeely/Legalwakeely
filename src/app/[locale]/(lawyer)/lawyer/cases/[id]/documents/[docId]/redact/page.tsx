import { notFound, redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { DocumentRedactionCanvas } from '@/components/lawyer/redaction/document-redaction-canvas';

export default async function DocumentRedactPage({
  params,
}: {
  params: Promise<{ locale: string; id: string; docId: string }>;
}) {
  const { id, docId } = await params;
  const locale = await getLocale();
  const isRTL  = locale === 'ar';
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  // Same assignment gate as the case detail page.
  const { data: assignment } = await supabase
    .from('case_lawyers')
    .select('id')
    .eq('case_id', id)
    .eq('lawyer_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!assignment) notFound();

  const { data: doc } = await supabase
    .from('documents')
    .select('id, file_name, mime_type')
    .eq('id', docId)
    .eq('case_id', id)
    .maybeSingle();
  if (!doc) notFound();

  if (doc.mime_type && doc.mime_type !== 'application/pdf' && !doc.file_name.toLowerCase().endsWith('.pdf')) {
    // Redaction only makes sense for PDFs today.
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link
        href={`/${locale}/lawyer/cases/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <BackIcon className="h-4 w-4" />
        {isRTL ? 'العودة إلى القضية' : 'Back to case'}
      </Link>

      <DocumentRedactionCanvas
        caseId={id}
        documentId={docId}
        fileName={doc.file_name}
        locale={locale}
      />
    </div>
  );
}
