import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET: Fetch all redactions for a specific document
export async function GET(
  req: NextRequest,
  { params }: { params: { docId: string } }
) {
  const supabase = await createClient();
  const { docId } = await params;

  const { data, error } = await supabase
    .from('document_redactions')
    .select('*')
    .eq('document_id', docId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST: Save a new draft redaction box
export async function POST(
  req: NextRequest,
  { params }: { params: { docId: string } }
) {
  const supabase = await createClient();
  const { docId } = await params;

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { page_number, x, y, width, height, category = 'manual' } = body;

  // Validate coordinates (must be between 0 and 1)
  if ([x, y, width, height].some(v => typeof v !== 'number' || v < 0 || v > 1)) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('document_redactions')
    .insert({
      document_id: docId,
      page_number,
      x,
      y,
      width,
      height,
      mode: 'draft',
      category,
      created_by: user.id
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
// DELETE: Remove a specific redaction
export async function DELETE(
  req: NextRequest,
  { params }: { params: { docId: string } }
) {
  const supabase = await createClient();
  const { docId } = await params;

  // Get the redaction ID from the URL
  const url = new URL(req.url);
  const redactionId = url.searchParams.get('id');

  if (!redactionId) {
    return NextResponse.json({ error: 'Redaction ID required' }, { status: 400 });
  }

  // Verify the user owns this redaction
  const { data: redaction, error: fetchError } = await supabase
    .from('document_redactions')
    .select('created_by, document_id')
    .eq('id', redactionId)
    .single();

  if (fetchError || !redaction) {
    return NextResponse.json({ error: 'Redaction not found' }, { status: 404 });
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || redaction.created_by !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify the redaction belongs to this document
  if (redaction.document_id !== docId) {
    return NextResponse.json({ error: 'Redaction does not belong to this document' }, { status: 400 });
  }

  const { error } = await supabase
    .from('document_redactions')
    .delete()
    .eq('id', redactionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
