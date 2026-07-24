import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const VALID_CATEGORIES = ['pii', 'financial', 'privilege', 'manual'];

// GET — list all redaction boxes (draft + burned) for a document
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

  const { data: boxes, error } = await supabase
    .from('document_redactions')
    .select('*')
    .eq('document_id', docId)
    .order('page_number', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(boxes ?? []);
}

// POST — draw a new draft redaction box
export async function POST(
  request: Request,
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

  const { page_number, x, y, width, height, category } = await request.json();

  if (
    !Number.isInteger(page_number) || page_number < 1 ||
    typeof x !== 'number' || typeof y !== 'number' ||
    typeof width !== 'number' || typeof height !== 'number' ||
    x < 0 || x > 1 || y < 0 || y > 1 || width <= 0 || width > 1 || height <= 0 || height > 1
  ) {
    return NextResponse.json({ error: 'Invalid box coordinates' }, { status: 400 });
  }
  const finalCategory = VALID_CATEGORIES.includes(category) ? category : 'manual';

  const { data: created, error } = await supabase
    .from('document_redactions')
    .insert({
      document_id: docId,
      page_number,
      x, y, width, height,
      category: finalCategory,
      created_by: user.id,
    })
    .select()
    .single();

  if (error || !created) return NextResponse.json({ error: error?.message }, { status: 500 });
  return NextResponse.json(created, { status: 201 });
}
