import { cn } from "@/lib/utils";
import { AlertTriangle, Info, CheckCircle2, XCircle } from "lucide-react";
import type { ReactNode } from "react";

type Variant = "info" | "warning" | "success" | "danger";

const styles: Record<Variant, { wrap: string; icon: string; iconCmp: ReactNode }> = {
  info: {
    wrap: "bg-brand-50 border-brand-200 text-brand-900",
    icon: "text-brand-600",
    iconCmp: <Info className="h-5 w-5" />,
  },
  warning: {
    wrap: "bg-amber-50 border-amber-200 text-amber-900",
    icon: "text-amber-600",
    iconCmp: <AlertTriangle className="h-5 w-5" />,
  },
  success: {
    wrap: "bg-emerald-50 border-emerald-200 text-emerald-900",
    icon: "text-emerald-600",
    iconCmp: <CheckCircle2 className="h-5 w-5" />,
  },
  danger: {
    wrap: "bg-rose-50 border-rose-200 text-rose-900",
    icon: "text-rose-600",
    iconCmp: <XCircle className="h-5 w-5" />,
  },
};

export function Alert({
  variant = "info",
  title,
  children,
  className,
}: {
  variant?: Variant;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const s = styles[variant];
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-4",
        s.wrap,
        className,
      )}
    >
      <div className={cn("mt-0.5 shrink-0", s.icon)}>{s.iconCmp}</div>
      <div className="flex-1 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        <div className={cn("leading-6", title && "mt-1")}>{children}</div>
      </div>
    </div>
  );
}
