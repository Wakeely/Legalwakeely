import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET — all deadlines/tasks for a case (with assignee), plus the list of
// lawyers on this case who can be assigned to one.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: case_id } = await params;
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

  const [{ data: tasks }, { data: lawyers }] = await Promise.all([
    supabase
      .from('deadlines')
      .select('id, title, due_date, type, status, priority, assigned_to, assignee:assigned_to(id, full_name)')
      .eq('case_id', case_id)
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('case_lawyers')
      .select('lawyer_id, users!case_lawyers_lawyer_id_fkey(id, full_name)')
      .eq('case_id', case_id)
      .eq('status', 'active'),
  ]);

  type LawyerRow = { lawyer_id: string; users: { id: string; full_name: string | null } | null };
  const assignableLawyers = ((lawyers ?? []) as unknown as LawyerRow[]).map((l) => ({
    id: l.lawyer_id,
    full_name: l.users?.full_name ?? null,
  }));

  return NextResponse.json({ tasks: tasks ?? [], lawyers: assignableLawyers });
}

// POST — assigned lawyer with write permission creates a new task
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: case_id } = await params;
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

  const { title, due_date, priority, assigned_to, type } = await request.json();
  if (!title || !title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const { data: created, error } = await supabase
    .from('deadlines')
    .insert({
      case_id,
      title: title.trim(),
      due_date: due_date || null,
      type: type || 'internal',
      priority: priority || 'medium',
      assigned_to: assigned_to || null,
    })
    .select('id, title, due_date, type, status, priority, assigned_to')
    .single();

  if (error || !created) return NextResponse.json({ error: error?.message }, { status: 500 });

  return NextResponse.json(created, { status: 201 });
}
