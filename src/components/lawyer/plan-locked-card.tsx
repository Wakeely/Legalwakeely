'use client';

import { Lock } from 'lucide-react';

interface PlanLockedCardProps {
  icon: React.ComponentType<{ className?: string }>;
  titleEn: string;
  titleAr: string;
  locale: string;
}

export function PlanLockedCard({ icon: Icon, titleEn, titleAr, locale }: PlanLockedCardProps) {
  const isRTL = locale === 'ar';

  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5">
      <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {isRTL ? titleAr : titleEn}
      </h3>
      <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#C89B3C]/15">
          <Lock className="h-4 w-4 text-[#C89B3C]" />
        </div>
        <p className="text-xs font-medium text-foreground">
          {isRTL ? 'متاح في باقة المكتب فما فوق' : 'Available on the Firm plan and above'}
        </p>
        <p className="text-[11px] text-muted-foreground max-w-[220px]">
          {isRTL
            ? 'تواصل مع فريق وكيلي لترقية باقة مكتبك.'
            : 'Contact the Wakeely team to upgrade your firm\'s plan.'}
        </p>
      </div>
    </div>
  );
}
