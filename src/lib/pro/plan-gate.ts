import { createClient } from '@/lib/supabase/server';

export type ProFeature = 'discovery' | 'time_tracking' | 'workflow_templates';
export type FirmPlan = 'trial' | 'solo' | 'firm' | 'enterprise';

// Matches the tiers in the original Wakeely Pro pricing plan: Solo gets
// core case management + client sync; Firm and above add discovery
// tracking, time & billing, and workflow templates. Trial gets everything
// so a prospective firm can evaluate the full product before buying.
const PLAN_FEATURES: Record<FirmPlan, Record<ProFeature, boolean>> = {
  trial:      { discovery: true,  time_tracking: true,  workflow_templates: true  },
  solo:       { discovery: false, time_tracking: false, workflow_templates: false },
  firm:       { discovery: true,  time_tracking: true,  workflow_templates: true  },
  enterprise: { discovery: true,  time_tracking: true,  workflow_templates: true  },
};

export interface FirmPlanInfo {
  plan: FirmPlan;
  firmId: string | null;
}

/**
 * A lawyer with no firm at all (hasn't created/joined one yet) is treated
 * as 'trial' rather than the most restrictive tier — this is a deliberate
 * choice so existing pilot lawyers using Discovery/Time Tracking before
 * gating existed aren't suddenly locked out just for not having set up a
 * firm yet. Once plans are actually sold, this default can be tightened.
 */
export async function getCallerFirmPlan(userId: string): Promise<FirmPlanInfo> {
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from('firm_members')
    .select('firm_id, firms(plan)')
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) return { plan: 'trial', firmId: null };

  const plan = (membership.firms as unknown as { plan: FirmPlan } | null)?.plan ?? 'trial';
  return { plan, firmId: membership.firm_id };
}

export async function hasFeature(userId: string, feature: ProFeature): Promise<boolean> {
  const { plan } = await getCallerFirmPlan(userId);
  return PLAN_FEATURES[plan][feature];
}

export function getPlanFeatures(plan: FirmPlan): Record<ProFeature, boolean> {
  return PLAN_FEATURES[plan];
}
