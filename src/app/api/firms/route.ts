import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET — the current lawyer's firm + fellow members, if any
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: membership } = await supabase
    .from('firm_members')
    .select('role, firms(id, name, name_ar, plan, created_at)')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return NextResponse.json({ firm: null, role: null });

  const { data: members } = await supabase
    .from('firm_members')
    .select('user_id, role, users(id, full_name, email)')
    .eq('firm_id', (membership.firms as unknown as { id: string }).id);

  return NextResponse.json({ firm: membership.firms, role: membership.role, members: members ?? [] });
}

// POST — create a firm and make the caller its owner
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // A lawyer can only belong to one firm today — keep it simple.
  const { data: existing } = await supabase
    .from('firm_members')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing) return NextResponse.json({ error: 'You already belong to a firm' }, { status: 409 });

  const { name, name_ar } = await request.json();
  if (!name || !name.trim()) {
    return NextResponse.json({ error: 'A firm name is required' }, { status: 400 });
  }

  const { data: firm, error: firmError } = await supabase
    .from('firms')
    .insert({ name: name.trim(), name_ar: name_ar?.trim() || null })
    .select()
    .single();
  if (firmError || !firm) return NextResponse.json({ error: firmError?.message }, { status: 500 });

  const { error: memberError } = await supabase
    .from('firm_members')
    .insert({ firm_id: firm.id, user_id: user.id, role: 'owner' });
  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });

  return NextResponse.json({ firm }, { status: 201 });
}
