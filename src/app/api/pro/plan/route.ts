import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCallerFirmPlan, getPlanFeatures } from '@/lib/pro/plan-gate';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { plan, firmId } = await getCallerFirmPlan(user.id);
  return NextResponse.json({ plan, firmId, features: getPlanFeatures(plan) });
}
