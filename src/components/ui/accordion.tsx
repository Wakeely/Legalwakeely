"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Accordion({
  items,
  defaultOpen = 0,
}: {
  items: { id: string; title: ReactNode; content: ReactNode; badge?: ReactNode }[];
  defaultOpen?: number;
}) {
  const [open, setOpen] = useState<Set<number>>(
    new Set(defaultOpen >= 0 ? [defaultOpen] : []),
  );

  const toggle = (i: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="divide-y divide-ink-100 rounded-2xl border border-ink-200 bg-white">
      {items.map((item, i) => {
        const isOpen = open.has(i);
        return (
          <div key={item.id}>
            <button
              type="button"
              onClick={() => toggle(i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start transition-colors hover:bg-ink-50/50"
              aria-expanded={isOpen}
            >
              <div className="flex flex-1 items-center gap-3">
                <span className="text-sm font-semibold text-ink-900">
                  {item.title}
                </span>
                {item.badge}
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-ink-500 transition-transform",
                  isOpen && "rotate-180",
                )}
              />
            </button>
            {isOpen && (
              <div className="px-5 pb-5 text-sm leading-7 text-ink-700 animate-fade-in">
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
