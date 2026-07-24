'use client';

import { useState, useEffect } from 'react';

interface PlanFeatures {
  discovery: boolean;
  time_tracking: boolean;
  workflow_templates: boolean;
}

interface UsePlanFeaturesResult {
  loading: boolean;
  features: PlanFeatures | null;
  plan: string | null;
}

export function usePlanFeatures(): UsePlanFeaturesResult {
  const [loading, setLoading]   = useState(true);
  const [features, setFeatures] = useState<PlanFeatures | null>(null);
  const [plan, setPlan]         = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/pro/plan')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setFeatures(data.features);
        setPlan(data.plan);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { loading, features, plan };
}
