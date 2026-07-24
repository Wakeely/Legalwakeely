import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function assertWriteAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  caseId: string,
  userId: string
) {
  const { data: assignment } = await supabase
    .from('case_lawyers')
    .select('id, permissions')
    .eq('case_id', caseId)
    .eq('lawyer_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (!assignment) return { ok: false as const, status: 403, error: 'Not assigned to this case' };
  if (assignment.permissions !== 'write' && assignment.permissions !== 'read_write') {
    return { ok: false as const, status: 403, error: 'Read-only access to this case' };
  }
  return { ok: true as const };
}

// PATCH — move/resize an existing draft box, or change its category
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string; redactionId: string }> }
) {
  const { id: case_id, docId, redactionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await assertWriteAccess(supabase, case_id, user.id);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json();
  const patch: Record<string, unknown> = {};
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    if (typeof body[key] === 'number') patch[key] = body[key];
  }
  if (typeof body.category === 'string') patch.category = body.category;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from('document_redactions')
    .update(patch)
    .eq('id', redactionId)
    .eq('document_id', docId)
    .eq('mode', 'draft') // burned boxes are permanent — never editable
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: error?.message ?? 'Box not found or already burned' }, { status: 404 });
  }
  return NextResponse.json(updated);
}

// DELETE — remove a draft box entirely
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string; redactionId: string }> }
) {
  const { id: case_id, docId, redactionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await assertWriteAccess(supabase, case_id, user.id);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { error } = await supabase
    .from('document_redactions')
    .delete()
    .eq('id', redactionId)
    .eq('document_id', docId)
    .eq('mode', 'draft');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
