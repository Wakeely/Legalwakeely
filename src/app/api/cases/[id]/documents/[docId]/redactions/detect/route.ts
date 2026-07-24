import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { downloadDocument } from '@/lib/storage';
import { extractPdfTextWithPositions, boundingBoxForRange } from '@/lib/redaction/pdf-text-extract-server';
import { REDACTION_PATTERNS } from '@/lib/redaction/patterns';

// POST — scan the document's text for known PII/financial patterns and
// create draft redaction boxes for every match. v1 is regex-based (see
// patterns.ts for exactly which formats and the caveats on each) —
// designed so a real detection backend (e.g. Almustahar) can be swapped
// in later behind this same endpoint without changing the UI.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id: case_id, docId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: assignment } = await supabase
    .from('case_lawyers')
    .select('id, permissions')
    .eq('case_id', case_id)
    .eq('lawyer_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!assignment) return NextResponse.json({ error: 'Not assigned to this case' }, { status: 403 });
  if (assignment.permissions !== 'write' && assignment.permissions !== 'read_write') {
    return NextResponse.json({ error: 'Read-only access to this case' }, { status: 403 });
  }

  const { data: doc } = await supabase
    .from('documents')
    .select('id, file_path')
    .eq('id', docId)
    .eq('case_id', case_id)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  const fileBuffer = await downloadDocument(doc.file_path);
  if (!fileBuffer) {
    return NextResponse.json({ error: 'Could not read the document for scanning' }, { status: 500 });
  }

  let pages;
  try {
    pages = await extractPdfTextWithPositions(fileBuffer);
  } catch {
    return NextResponse.json({ error: 'Could not extract text — the file may be a scanned image without a text layer' }, { status: 422 });
  }

  const newRows: Array<{
    document_id: string;
    page_number: number;
    x: number; y: number; width: number; height: number;
    category: string;
    created_by: string;
  }> = [];

  for (const page of pages) {
    for (const pattern of REDACTION_PATTERNS) {
      // Reset lastIndex per page since the same RegExp object (with the
      // 'g' flag) is reused across pages/patterns via matchAll below.
      const matches = page.text.matchAll(pattern.regex);
      for (const match of matches) {
        if (match.index === undefined) continue;
        const box = boundingBoxForRange(page, match.index, match.index + match[0].length);
        if (!box) continue;

        newRows.push({
          document_id: docId,
          page_number: page.pageNumber,
          x: box.x, y: box.y, width: box.width, height: box.height,
          category: pattern.category,
          created_by: user.id,
        });
      }
    }
  }

  if (newRows.length === 0) {
    return NextResponse.json({ created: 0, boxes: [] });
  }

  const { data: created, error } = await supabase
    .from('document_redactions')
    .insert(newRows)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ created: created?.length ?? 0, boxes: created ?? [] });
}
