import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET — list discovery requests for a case (lawyer-only, no client access)
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

  const { data: requests } = await supabase
    .from('discovery_requests')
    .select('*')
    .eq('case_id', case_id)
    .order('response_due_date', { ascending: true, nullsFirst: false });

  return NextResponse.json(requests ?? []);
}

// POST — assigned lawyer with write permission creates a discovery request
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

  const { request_type, direction, description, served_date, response_due_date } = await request.json();
  if (!request_type || !direction || !description) {
    return NextResponse.json({ error: 'request_type, direction, description required' }, { status: 400 });
  }

  const { data: created, error } = await supabase
    .from('discovery_requests')
    .insert({
      case_id,
      request_type,
      direction,
      description,
      served_date: served_date || null,
      response_due_date: response_due_date || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error || !created) return NextResponse.json({ error: error?.message }, { status: 500 });

  return NextResponse.json(created, { status: 201 });
}
