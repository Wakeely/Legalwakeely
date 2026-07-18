"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, ExternalLink, Loader2, Clock } from "lucide-react";

interface PendingOrder {
  id: string;
  reference: string;
  user_id: string;
  user_name: string;
  user_email: string;
  plan_type: string;
  billing_period: string;
  amount_jod: number;
  proof_url: string | null;
  proof_transaction_id: string | null;
  proof_uploaded_at: string;
  created_at: string;
  expires_at: string;
}

interface RecentOrder {
  id: string;
  reference: string;
  user_id: string;
  user_name: string;
  user_email: string;
  plan_type: string;
  billing_period: string;
  amount_jod: number;
  status: string;
  verified_at: string | null;
  rejection_reason: string | null;
  period_end: string | null;
  created_at: string;
}

const PLAN_LABELS: Record<string, string> = {
  basic: "Basic",
  pro: "Pro",
  premium: "Premium",
  legal_ai_addon: "Legal-AI Add-on",
};

export function CliQVerificationPanel({
  pendingOrders,
  recentOrders,
}: {
  pendingOrders: PendingOrder[];
  recentOrders: RecentOrder[];
}) {
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Record<string, "verified" | "rejected">>({});

  async function verify(orderId: string) {
    setProcessing(orderId);
    try {
      const res = await fetch(`/api/admin/cliq/${orderId}/verify`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "Verification failed");
      }
      setResult((r) => ({ ...r, [orderId]: "verified" }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setProcessing(null);
    }
  }

  async function reject(orderId: string) {
    const reason = rejectReason[orderId]?.trim();
    if (!reason) {
      alert("Please enter a rejection reason");
      return;
    }
    setRejecting(orderId);
    try {
      const res = await fetch(`/api/admin/cliq/${orderId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "Rejection failed");
      }
      setResult((r) => ({ ...r, [orderId]: "rejected" }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Rejection failed");
    } finally {
      setRejecting(null);
    }
  }

  return (
    <div className="container-page max-w-5xl py-10">
      <h1 className="mb-1 text-2xl font-extrabold text-ink-900">CliQ Payment Verification</h1>
      <p className="mb-8 text-sm text-ink-600">
        Review and verify pending CliQ payments. Users are notified automatically.
      </p>

      {/* Pending */}
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-500">
        Awaiting verification ({pendingOrders.length})
      </h2>

      {pendingOrders.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-500">
          No pending payments. When users upload CliQ proof, they'll appear here.
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingOrders.map((order) => (
            <Card key={order.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold text-ink-900">{order.reference}</span>
                    {result[order.id] === "verified" && (
                      <Badge tone="success">
                        <Check className="mr-1 h-3 w-3" /> Verified
                      </Badge>
                    )}
                    {result[order.id] === "rejected" && (
                      <Badge tone="danger">
                        <X className="mr-1 h-3 w-3" /> Rejected
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-ink-700">
                    <span className="font-semibold">{order.user_name}</span> ({order.user_email})
                  </p>
                  <p className="text-sm text-ink-600">
                    {PLAN_LABELS[order.plan_type] ?? order.plan_type} · {order.billing_period} ·{" "}
                    <span className="font-bold text-ink-900">{order.amount_jod} JOD</span>
                  </p>
                  <p className="text-xs text-ink-400">
                    Uploaded: {new Date(order.proof_uploaded_at).toLocaleString()}
                  </p>
                  {order.proof_transaction_id && (
                    <p className="text-xs text-ink-400">
                      CliQ TXN: <span className="font-mono">{order.proof_transaction_id}</span>
                    </p>
                  )}
                </div>

                {order.proof_url && (
                  <a
                    href={order.proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-lg border border-ink-300 px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View proof
                  </a>
                )}
              </div>

              {result[order.id] !== "verified" && result[order.id] !== "rejected" && (
                <div className="mt-4 border-t border-ink-100 pt-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <Button
                      onClick={() => verify(order.id)}
                      disabled={processing === order.id}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {processing === order.id ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-1 h-4 w-4" />
                      )}
                      Verify &amp; Activate
                    </Button>
                    <input
                      type="text"
                      placeholder="Rejection reason (required to reject)"
                      value={rejectReason[order.id] ?? ""}
                      onChange={(e) =>
                        setRejectReason((r) => ({ ...r, [order.id]: e.target.value }))
                      }
                      className="flex-1 rounded-lg border border-ink-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                    />
                    <Button
                      variant="danger"
                      onClick={() => reject(order.id)}
                      disabled={rejecting === order.id}
                    >
                      {rejecting === order.id ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <X className="mr-1 h-4 w-4" />
                      )}
                      Reject
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Recent */}
      {recentOrders.length > 0 && (
        <>
          <h2 className="mb-4 mt-10 text-sm font-bold uppercase tracking-wide text-ink-500">
            Recently processed ({recentOrders.length})
          </h2>
          <div className="space-y-2">
            {recentOrders.map((order) => (
              <Card key={order.id} className="flex items-center justify-between p-4">
                <div>
                  <span className="font-mono text-sm font-bold text-ink-900">{order.reference}</span>
                  <span className="ml-2 text-sm text-ink-600">
                    {order.user_name} · {PLAN_LABELS[order.plan_type] ?? order.plan_type} · {order.amount_jod} JOD
                  </span>
                  {order.rejection_reason && (
                    <p className="mt-1 text-xs text-rose-600">{order.rejection_reason}</p>
                  )}
                  {order.period_end && (
                    <p className="mt-1 text-xs text-emerald-600">
                      Active until: {new Date(order.period_end).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Badge tone={order.status === "verified" ? "success" : "danger"}>
                  {order.status}
                </Badge>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
