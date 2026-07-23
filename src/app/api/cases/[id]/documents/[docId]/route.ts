import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// PATCH — toggle whether a document is visible to the client
export async function PATCH(
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

  const { is_client_visible } = await request.json();
  if (typeof is_client_visible !== 'boolean') {
    return NextResponse.json({ error: 'is_client_visible must be true or false' }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from('documents')
    .update({ is_client_visible })
    .eq('id', docId)
    .eq('case_id', case_id)
    .select('id, is_client_visible')
    .single();

  if (error || !updated) return NextResponse.json({ error: error?.message }, { status: 500 });

  return NextResponse.json(updated);
}
