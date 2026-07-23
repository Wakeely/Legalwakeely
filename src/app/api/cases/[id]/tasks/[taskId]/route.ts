import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const { id: case_id, taskId } = await params;
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

  const body = await request.json();
  const patch: Record<string, unknown> = {};
  if ('assigned_to' in body) patch.assigned_to = body.assigned_to || null;
  if ('priority' in body) patch.priority = body.priority;
  if ('status' in body) patch.status = body.status;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from('deadlines')
    .update(patch)
    .eq('id', taskId)
    .eq('case_id', case_id)
    .select('id, title, due_date, type, status, priority, assigned_to')
    .single();

  if (error || !updated) return NextResponse.json({ error: error?.message }, { status: 500 });

  return NextResponse.json(updated);
}
