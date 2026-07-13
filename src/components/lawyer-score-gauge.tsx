import { cn } from "@/lib/utils";
import type { LawyerScore } from "@/lib/types";
import { ShieldAlert, ShieldCheck, Shield } from "lucide-react";

export function LawyerScoreGauge({ score }: { score: LawyerScore }) {
  const config = {
    LOW: {
      label: "منخفضة",
      color: "emerald",
      percent: 25,
      icon: ShieldCheck,
      desc: "يمكنك التعامل مع الموضوع بنفسك أو بتسوية ودّية.",
    },
    MEDIUM: {
      label: "متوسطة",
      color: "amber",
      percent: 55,
      icon: Shield,
      desc: "الأفضل استشارة محامٍ قبل اتخاذ أي إجراء.",
    },
    HIGH: {
      label: "عالية",
      color: "rose",
      percent: 85,
      icon: ShieldAlert,
      desc: "يُنصح بشدة باستشارة محامٍ متخصص قبل أي تصرف.",
    },
  }[score];

  const Icon = config.icon;
  const ringColor = {
    emerald: "stroke-emerald-500",
    amber: "stroke-amber-500",
    rose: "stroke-rose-500",
  }[config.color as "emerald" | "amber" | "rose"];

  const bgColor = {
    emerald: "bg-emerald-50 text-emerald-800",
    amber: "bg-amber-50 text-amber-800",
    rose: "bg-rose-50 text-rose-800",
  }[config.color as "emerald" | "amber" | "rose"];

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative h-36 w-36">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            className="stroke-ink-100"
            strokeWidth="10"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            className={cn(ringColor, "transition-all duration-700")}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 42}
            strokeDashoffset={2 * Math.PI * 42 * (1 - config.percent / 100)}
          />
        </svg>
        <div
          className={cn(
            "absolute inset-0 m-auto grid h-20 w-20 place-items-center rounded-full",
            bgColor,
          )}
        >
          <div className="text-center">
            <Icon className="mx-auto h-6 w-6" />
            <div className="mt-1 text-xs font-bold">{config.label}</div>
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm leading-7 text-ink-600">{config.desc}</p>
    </div>
  );
}
