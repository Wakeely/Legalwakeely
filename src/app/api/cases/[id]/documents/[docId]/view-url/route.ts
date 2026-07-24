import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSignedDownloadUrl } from '@/lib/storage';

// GET — a short-lived signed URL for viewing a document (lawyer-only).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id: case_id, docId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: assignment } = await supabase
    .from('case_lawyers')
    .select('id')
    .eq('case_id', case_id)
    .eq('lawyer_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!assignment) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: doc } = await supabase
    .from('documents')
    .select('id, file_path, file_name, mime_type')
    .eq('id', docId)
    .eq('case_id', case_id)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  const url = await getSignedDownloadUrl(doc.file_path);
  if (!url) return NextResponse.json({ error: 'Could not generate a view URL' }, { status: 500 });

  return NextResponse.json({ url, file_name: doc.file_name, mime_type: doc.mime_type });
}
