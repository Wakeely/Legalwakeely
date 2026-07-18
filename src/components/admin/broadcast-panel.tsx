"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Users, Briefcase, User, Globe, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface Counts {
  lawyers: number;
  clients: number;
  total: number;
}

interface RecentBroadcast {
  id: string;
  title: string;
  body: string | null;
  type: string;
  action_url: string | null;
  created_at: string;
  user_id: string;
}

export function BroadcastPanel({
  counts,
  recentBroadcasts,
}: {
  counts: Counts;
  recentBroadcasts: RecentBroadcast[];
}) {
  const [audience, setAudience] = useState<"single" | "lawyers" | "clients" | "all">("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [actionUrl, setActionUrl] = useState("/notifications");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function send() {
    if (!title.trim() || !body.trim()) {
      setResult({ ok: false, message: "Title and body are required" });
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience, title, body, action_url: actionUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, message: `✅ Sent to ${data.sent_count} user(s)` });
        setTitle("");
        setBody("");
      } else {
        setResult({ ok: false, message: `❌ ${data.error ?? "Failed"}` });
      }
    } catch (e) {
      setResult({ ok: false, message: "Network error" });
    } finally {
      setSending(false);
    }
  }

  const audienceOptions = [
    { value: "all" as const, label: "Everyone", icon: Globe, count: counts.total, color: "bg-blue-50 text-blue-700 border-blue-200" },
    { value: "lawyers" as const, label: "All Lawyers", icon: Briefcase, count: counts.lawyers, color: "bg-teal-50 text-teal-700 border-teal-200" },
    { value: "clients" as const, label: "All Clients", icon: User, count: counts.clients, color: "bg-purple-50 text-purple-700 border-purple-200" },
    { value: "single" as const, label: "Single User", icon: Users, count: 1, color: "bg-amber-50 text-amber-700 border-amber-200" },
  ];

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-black text-foreground">Broadcast Notifications</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Send push notifications to users — they appear instantly in their notifications hub.
        </p>
      </div>

      {/* Audience selector */}
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Select Audience
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {audienceOptions.map((opt) => {
            const Icon = opt.icon;
            const selected = audience === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setAudience(opt.value)}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                  selected ? "border-brand-500 bg-brand-50" : "border-border hover:border-brand-300"
                }`}
              >
                <Icon className={`h-6 w-6 ${selected ? "text-brand-700" : "text-muted-foreground"}`} />
                <span className={`text-sm font-bold ${selected ? "text-brand-700" : "text-foreground"}`}>
                  {opt.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {opt.count} {opt.count === 1 ? "user" : "users"}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Message composer */}
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Message</h2>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. New feature available!"
            maxLength={200}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message here..."
            maxLength={2000}
            rows={4}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Action URL (optional)</label>
          <input
            type="text"
            value={actionUrl}
            onChange={(e) => setActionUrl(e.target.value)}
            placeholder="/notifications"
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
          <p className="mt-1 text-xs text-muted-foreground">Where the user goes when they click the notification</p>
        </div>

        {result && (
          <div
            className={`flex items-center gap-2 rounded-lg p-3 text-sm font-semibold ${
              result.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}
          >
            {result.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {result.message}
          </div>
        )}

        <Button onClick={send} disabled={sending || !title.trim() || !body.trim()} className="w-full">
          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          {sending ? "Sending..." : `Send to ${audienceOptions.find((o) => o.value === audience)?.label}`}
        </Button>
      </Card>

      {/* Recent broadcasts */}
      {recentBroadcasts.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Recent System Notifications ({recentBroadcasts.length})
          </h2>
          <div className="space-y-2">
            {recentBroadcasts.map((n) => (
              <div key={n.id} className="flex items-start justify-between rounded-lg border border-border p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{n.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{n.body}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0" dir="ltr">
                  {new Date(n.created_at).toLocaleDateString("en-AE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
