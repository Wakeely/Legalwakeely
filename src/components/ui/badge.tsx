import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const toneStyles: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-700 ring-ink-200",
  info: "bg-brand-50 text-brand-700 ring-brand-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function Badge({
  tone = "neutral",
  className,
  icon,
  children,
}: {
  tone?: Tone;
  className?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
        toneStyles[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
