import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// PATCH — owner revokes a pending invite
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  const { inviteId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: membership } = await supabase
    .from('firm_members')
    .select('firm_id, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || membership.role !== 'owner') {
    return NextResponse.json({ error: 'Only the firm owner can revoke invites' }, { status: 403 });
  }

  const { data: updated, error } = await supabase
    .from('firm_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
    .eq('firm_id', membership.firm_id)
    .eq('status', 'pending')
    .select('id, status')
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: error?.message ?? 'Invite not found or already used' }, { status: 404 });
  }

  return NextResponse.json(updated);
}
