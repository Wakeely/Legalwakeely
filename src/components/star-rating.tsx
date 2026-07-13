import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({
  value,
  max = 5,
  size = "sm",
  className,
  showValue = false,
}: {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  showValue?: boolean;
}) {
  const sizes = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-5 w-5" };
  return (
    <div className={cn("inline-flex items-center gap-0.5", className)}>
      {Array.from({ length: max }).map((_, i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className="relative">
            <Star className={cn(sizes[size], "text-ink-200")} />
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <Star
                className={cn(sizes[size], "fill-amber-400 text-amber-400")}
              />
            </span>
          </span>
        );
      })}
      {showValue && (
        <span className="ms-1 text-sm font-semibold text-ink-700">
          {value.toFixed(1)}
        </span>
      )}
    </div>
  );
}
