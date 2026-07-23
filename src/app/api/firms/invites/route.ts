import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET — list this firm's invites (owner only, enforced by RLS too)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: membership } = await supabase
    .from('firm_members')
    .select('firm_id, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'You do not belong to a firm' }, { status: 404 });
  if (membership.role !== 'owner') return NextResponse.json({ invites: [] }); // non-owners just see nothing here

  const { data: invites } = await supabase
    .from('firm_invites')
    .select('id, invitee_email, role_offered, status, expires_at, created_at, token')
    .eq('firm_id', membership.firm_id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ invites: invites ?? [] });
}

// POST — owner invites a lawyer/staff member by email
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: membership } = await supabase
    .from('firm_members')
    .select('firm_id, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'You do not belong to a firm' }, { status: 404 });
  if (membership.role !== 'owner') {
    return NextResponse.json({ error: 'Only the firm owner can send invites' }, { status: 403 });
  }

  const { invitee_email, role_offered } = await request.json();
  if (!invitee_email || !invitee_email.trim()) {
    return NextResponse.json({ error: 'An email address is required' }, { status: 400 });
  }
  const role = role_offered === 'staff' ? 'staff' : 'lawyer';

  const { data: invite, error } = await supabase
    .from('firm_invites')
    .insert({
      firm_id:       membership.firm_id,
      created_by:    user.id,
      invitee_email: invitee_email.trim().toLowerCase(),
      role_offered:  role,
    })
    .select('id, token, invitee_email, role_offered, status, expires_at, created_at')
    .single();

  if (error || !invite) return NextResponse.json({ error: error?.message }, { status: 500 });

  return NextResponse.json({ invite }, { status: 201 });
}
