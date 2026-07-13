"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from "lucide-react";

type ToastVariant = "success" | "info" | "warning" | "danger";

interface ToastItem {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
}

let listeners: ((items: ToastItem[]) => void)[] = [];
let items: ToastItem[] = [];

function notify() {
  listeners.forEach((l) => l(items));
}

export function showToast(t: Omit<ToastItem, "id">) {
  const id = Math.random().toString(36).slice(2);
  items = [...items, { ...t, id }];
  notify();
  setTimeout(() => {
    items = items.filter((i) => i.id !== id);
    notify();
  }, 4000);
}

const variantStyle: Record<ToastVariant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  info: "border-brand-200 bg-brand-50 text-brand-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-rose-200 bg-rose-50 text-rose-900",
};

const variantIcon: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
  info: <Info className="h-5 w-5 text-brand-600" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-600" />,
  danger: <XCircle className="h-5 w-5 text-rose-600" />,
};

export function ToastViewport() {
  const [list, setList] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.push(setList);
    return () => {
      listeners = listeners.filter((l) => l !== setList);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-4 sm:top-auto sm:items-end sm:px-6">
      {list.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-white p-4 shadow-lg animate-slide-up",
            variantStyle[t.variant],
          )}
        >
          <div className="mt-0.5">{variantIcon[t.variant]}</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink-900">{t.title}</p>
            {t.description && (
              <p className="mt-0.5 text-xs text-ink-600">{t.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              items = items.filter((i) => i.id !== t.id);
              notify();
            }}
            className="text-ink-400 hover:text-ink-700"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
