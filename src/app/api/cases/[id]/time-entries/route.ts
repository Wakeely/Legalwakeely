import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET — list this lawyer's own time entries for a case
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: case_id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: entries } = await supabase
    .from('time_entries')
    .select('*')
    .eq('case_id', case_id)
    .eq('lawyer_id', user.id)
    .order('entry_date', { ascending: false });

  return NextResponse.json(entries ?? []);
}

// POST — assigned lawyer logs time against a case
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
    .select('id')
    .eq('case_id', case_id)
    .eq('lawyer_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!assignment) return NextResponse.json({ error: 'Not assigned to this case' }, { status: 403 });

  const { minutes, rate_per_hour, description, is_billable, entry_date } = await request.json();
  if (!minutes || !description) {
    return NextResponse.json({ error: 'minutes and description required' }, { status: 400 });
  }

  const { data: created, error } = await supabase
    .from('time_entries')
    .insert({
      case_id,
      lawyer_id: user.id,
      minutes,
      rate_per_hour: rate_per_hour || null,
      description,
      is_billable: is_billable ?? true,
      entry_date: entry_date || new Date().toISOString().split('T')[0],
    })
    .select()
    .single();

  if (error || !created) return NextResponse.json({ error: error?.message }, { status: 500 });

  return NextResponse.json(created, { status: 201 });
}
