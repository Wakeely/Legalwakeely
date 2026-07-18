"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Check, Clock, X, Upload, Loader2, ShieldCheck } from "lucide-react";
import { CLIQ_PLANS, type CliQPlan } from "@/lib/cliq";

interface Subscription {
  tier: string;
  status: string;
  current_period_end: string | null;
  legal_ai_enabled: boolean;
  legal_ai_current_period_end: string | null;
  payment_method: string;
}

interface Order {
  id: string;
  reference: string;
  plan_type: string;
  billing_period: string;
  amount_jod: number;
  status: string;
  proof_url: string | null;
  created_at: string;
  expires_at: string;
  period_end: string | null;
}

export function CliQBilling({
  locale,
  subscription,
  orders,
}: {
  locale: string;
  subscription: Subscription | null;
  orders: Order[];
}) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<"monthly" | "quarterly" | "annual">("monthly");
  const [creating, setCreating] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");

  const isRTL = locale === "ar";

  async function createOrder(planType: string) {
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/cliq/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_type: planType, billing_period: selectedPeriod }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create order");
      setActiveOrder(data.order);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create order");
    } finally {
      setCreating(false);
    }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { tone: string; label: string; labelAr: string }> = {
      pending: { tone: "neutral", label: "Pending", labelAr: "بانتظار الدفع" },
      proof_uploaded: { tone: "warning", label: "Under review", labelAr: "قيد المراجعة" },
      verified: { tone: "success", label: "Verified", labelAr: "مُوثّق" },
      rejected: { tone: "danger", label: "Rejected", labelAr: "مرفوض" },
      expired: { tone: "neutral", label: "Expired", labelAr: "منتهي" },
    };
    const s = map[status] ?? map.pending;
    return (
      <Badge tone={s.tone as never}>
        {isRTL ? s.labelAr : s.label}
      </Badge>
    );
  };

  return (
    <div className="container-page max-w-5xl py-10" dir={isRTL ? "rtl" : "ltr"}>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-ink-900">
          {isRTL ? "الاشتراك والمدفوعات" : "Subscription & Billing"}
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          {isRTL
            ? "ادفع عبر CliQ — نظام المدفوعات الوطني للأردن."
            : "Pay via CliQ — Jordan's national mobile payment system."}
        </p>
      </div>

      {/* Current subscription status */}
      {subscription && (
        <Card className="mb-8 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                {isRTL ? "باقتك الحالية" : "Current plan"}
              </p>
              <p className="text-xl font-bold capitalize text-ink-900">
                {subscription.tier}
              </p>
              {subscription.current_period_end && (
                <p className="text-xs text-ink-500">
                  {isRTL ? "تنتهي في" : "Active until"}:{" "}
                  {new Date(subscription.current_period_end).toLocaleDateString(isRTL ? "ar-JO" : "en-US")}
                </p>
              )}
            </div>
            <div className="text-right">
              {subscription.legal_ai_enabled && (
                <Badge tone="success" className="mb-2">
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  Legal-AI {isRTL ? "مُفعّل" : "active"}
                </Badge>
              )}
              {subscription.legal_ai_current_period_end && (
                <p className="text-xs text-ink-500">
                  Legal-AI {isRTL ? "تنتهي" : "until"}:{" "}
                  {new Date(subscription.legal_ai_current_period_end).toLocaleDateString(isRTL ? "ar-JO" : "en-US")}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Active order (payment instructions) */}
      {activeOrder && (
        <Card className="mb-8 border-teal-200 bg-teal-50 p-6">
          <h2 className="mb-4 text-lg font-bold text-teal-900">
            {isRTL ? "تعليمات الدفع عبر CliQ" : "CliQ Payment Instructions"}
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-teal-200 pb-2">
              <span className="text-teal-700">{isRTL ? "المبلغ" : "Amount"}:</span>
              <span className="font-bold text-teal-900">
                {activeOrder.amount_jod} JOD
              </span>
            </div>
            <div className="flex justify-between border-b border-teal-200 pb-2">
              <span className="text-teal-700">{isRTL ? "التحويل إلى" : "Send to"}:</span>
              <span className="font-mono font-bold text-teal-900">{activeOrder.reference.split("-")[0] === "LW" ? "legalwakeely@cliq" : ""}</span>
            </div>
            <div className="flex justify-between border-b border-teal-200 pb-2">
              <span className="text teal-700">{isRTL ? "رمز المرجع (أدرجه في الملاحظة)" : "Reference code (include in note)"}:</span>
              <span className="font-mono font-bold text-teal-900">{activeOrder.reference}</span>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-white p-3 text-xs text-ink-600">
            {isRTL
              ? "1. افتح تطبيق بنكك ← CliQ ← تحويل. 2. أدخل الاسم المستعار: legalwakeely@cliq. 3. أدخل المبلغ. 4. في الملاحظة، اكتب رمز المرجع. 5. لقطة شاشة للإيصال وارفعها أدناه."
              : "1. Open your bank app → CliQ → Transfer. 2. Enter alias: legalwakeely@cliq. 3. Enter the amount. 4. In the note, write the reference code. 5. Screenshot the receipt and upload it below."}
          </div>
          <ProofUploader orderId={activeOrder.id} isRTL={isRTL} onUploaded={() => setActiveOrder(null)} />
        </Card>
      )}

      {/* Billing period tabs */}
      <div className="mb-8 flex justify-center">
        <div className="inline-flex rounded-full border border-ink-200 bg-ink-50 p-1">
          {(["monthly", "quarterly", "annual"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPeriod(p)}
              className={`rounded-full px-6 py-2.5 text-sm font-bold transition-all duration-200 ${
                selectedPeriod === p
                  ? "bg-white text-ink-900 shadow-sm"
                  : "text-ink-500 hover:text-ink-700"
              }`}
            >
              {isRTL ? (p === "monthly" ? "شهري" : p === "quarterly" ? "ربع سنوي" : "سنوي") : p === "monthly" ? "Monthly" : p === "quarterly" ? "Quarterly" : "Annual"}
              {p === "annual" && (
                <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                  {isRTL ? "وفّر 20%" : "-20%"}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {CLIQ_PLANS.map((plan) => (
          <PlanCard
            key={plan.tier}
            plan={plan}
            period={selectedPeriod}
            isRTL={isRTL}
            isCurrent={subscription?.tier === plan.tier}
            onSelect={() => createOrder(plan.tier)}
            creating={creating}
            isAddon={plan.tier === "legal_ai_addon"}
            addonActive={Boolean(subscription?.legal_ai_enabled)}
          />
        ))}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Order history */}
      {orders.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-500">
            {isRTL ? "سجل الطلبات" : "Order history"}
          </h2>
          <div className="space-y-2">
            {orders.map((order) => (
              <Card key={order.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-mono text-sm font-bold text-ink-900">{order.reference}</p>
                  <p className="text-xs text-ink-500">
                    {order.plan_type} · {order.billing_period} · {order.amount_jod} JOD
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {order.proof_url && !order.proof_url.startsWith("http") && (
                    <a
                      href={order.proof_url}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      {isRTL ? "عرض الإثبات" : "View proof"}
                    </a>
                  )}
                  {statusBadge(order.status)}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanCard({
  plan,
  period,
  isRTL,
  isCurrent,
  isAddon,
  addonActive,
  onSelect,
  creating,
}: {
  plan: CliQPlan;
  period: "monthly" | "quarterly" | "annual";
  isRTL: boolean;
  isCurrent: boolean;
  isAddon: boolean;
  addonActive: boolean;
  onSelect: () => void;
  creating: boolean;
}) {
  const amount = plan.jod[period];
  const features = isRTL ? plan.featuresAr : plan.features;
  const periodLabel = isRTL
    ? period === "monthly" ? "شهرياً" : period === "quarterly" ? "ربع سنوي" : "سنوياً"
    : period === "monthly" ? "/month" : period === "quarterly" ? "/quarter" : "/year";

  // Icon per plan type
  const planIcon =
    plan.tier === "basic" ? "📋" :
    plan.tier === "pro" ? "⚖️" :
    plan.tier === "premium" ? "👑" :
    "✨";

  return (
    <div
      className={`group relative flex flex-col rounded-2xl bg-white p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
        plan.popular
          ? "border-2 border-brand-500 shadow-lg ring-1 ring-brand-200"
          : "border border-ink-200 shadow-sm hover:border-brand-300"
      }`}
    >
      {/* Popular badge */}
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-4 py-1 text-xs font-bold text-white shadow-md">
            ★ {isRTL ? "الأكثر شيوعاً" : "Most Popular"}
          </span>
        </div>
      )}

      {/* Plan icon + title */}
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-ink-50 text-2xl">
          {planIcon}
        </span>
        <div>
          <h3 className="text-xl font-bold text-ink-900">
            {isRTL ? plan.labelAr : plan.label}
          </h3>
          <p className="text-xs text-ink-500">
            {isRTL ? plan.descriptionAr : plan.description}
          </p>
        </div>
      </div>

      {/* Price — large, bold, clear */}
      <div className="mb-6 border-b border-ink-100 pb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-black text-ink-900">{amount}</span>
          <span className="text-lg font-bold text-ink-600">JOD</span>
        </div>
        <p className="mt-1 text-sm text-ink-500">{periodLabel}</p>
      </div>

      {/* Features — checkmarks with breathing room */}
      <ul className="mb-8 flex-1 space-y-3">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-ink-700">
            <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-100">
              <Check className="h-2.5 w-2.5 text-emerald-600" strokeWidth={3} />
            </span>
            <span className="leading-relaxed">{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA button */}
      {isCurrent && !isAddon ? (
        <button
          disabled
          className="w-full rounded-xl border border-ink-200 bg-ink-50 py-3 text-sm font-bold text-ink-500"
        >
          <Check className="mr-1 inline h-4 w-4" />
          {isRTL ? "باقتك الحالية" : "Current Plan"}
        </button>
      ) : isAddon && addonActive ? (
        <button
          disabled
          className="w-full rounded-xl border border-ink-200 bg-ink-50 py-3 text-sm font-bold text-ink-500"
        >
          <Check className="mr-1 inline h-4 w-4" />
          {isRTL ? "مُفعّل" : "Active"}
        </button>
      ) : (
        <button
          onClick={onSelect}
          disabled={creating}
          className={`w-full rounded-xl py-3.5 text-sm font-bold transition-all duration-200 active:scale-95 ${
            plan.popular
              ? "bg-brand-600 text-white hover:bg-brand-700 shadow-md hover:shadow-lg"
              : "border-2 border-ink-900 bg-white text-ink-900 hover:bg-ink-900 hover:text-white"
          } ${creating ? "opacity-60" : "cursor-pointer"}`}
        >
          {creating ? (
            <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />
          ) : (
            <CreditCard className="mr-1 inline h-4 w-4" />
          )}
          {isRTL ? "ابدأ الآن" : "Get Started"}
        </button>
      )}
    </div>
  );
}

function ProofUploader({
  orderId,
  isRTL,
  onUploaded,
}: {
  orderId: string;
  isRTL: boolean;
  onUploaded: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      // Upload to Supabase Storage (documents bucket)
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const fileName = `cliq-proofs/${orderId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(fileName, file);
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(fileName);

      // Record the proof on the order
      const res = await fetch("/api/cliq/upload-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          proof_url: urlData.publicUrl,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "Failed to record proof");
      }
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-4">
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-teal-300 bg-white p-4 text-sm font-semibold text-teal-700 hover:bg-teal-50">
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {uploading
          ? isRTL ? "جاري الرفع..." : "Uploading..."
          : isRTL ? "ارفع لقطة شاشة الإيصال" : "Upload receipt screenshot"}
        <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
      </label>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      <p className="mt-2 text-xs text-ink-500">
        {isRTL
          ? "سيتم مراجعة إثبات الدفع خلال 24 ساعة. ستصلك إشعار عند التفعيل."
          : "Your proof will be reviewed within 24 hours. You'll be notified when activated."}
      </p>
    </div>
  );
}
