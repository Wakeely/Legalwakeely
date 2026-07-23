import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET — this case's lawyer-composed updates (both internal and client-visible)
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

  const { data: updates } = await supabase
    .from('timeline_events')
    .select('id, payload, visibility, created_at, actor_id')
    .eq('case_id', case_id)
    .eq('event_type', 'lawyer_update')
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json(updates ?? []);
}

// POST — lawyer with write access composes an update, choosing whether the
// client sees it (visibility = 'client_visible') or it stays internal.
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

  const { title, visibility } = await request.json();
  if (!title || !title.trim()) {
    return NextResponse.json({ error: 'A message is required' }, { status: 400 });
  }
  if (visibility !== 'internal' && visibility !== 'client_visible') {
    return NextResponse.json({ error: 'visibility must be internal or client_visible' }, { status: 400 });
  }

  const { data: created, error } = await supabase
    .from('timeline_events')
    .insert({
      case_id,
      actor_id:            user.id,
      event_type:          'lawyer_update',
      payload:             { title: title.trim() },
      is_system_generated: false,
      visibility,
    })
    .select()
    .single();

  if (error || !created) return NextResponse.json({ error: error?.message }, { status: 500 });

  return NextResponse.json(created, { status: 201 });
}
