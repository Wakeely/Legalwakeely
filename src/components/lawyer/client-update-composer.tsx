'use client';

import { useState, useEffect, useCallback } from 'react';
import { Send, Loader2, Check, Users, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComposedUpdate {
  id: string;
  payload: { title: string };
  visibility: 'internal' | 'client_visible';
  created_at: string;
}

interface ClientUpdateComposerProps {
  caseId: string;
  locale: string;
}

export function ClientUpdateComposer({ caseId, locale }: ClientUpdateComposerProps) {
  const isRTL = locale === 'ar';

  const [updates, setUpdates] = useState<ComposedUpdate[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState<'internal' | 'client_visible'>('client_visible');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const loadUpdates = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/updates`);
      if (res.ok) setUpdates(await res.json());
    } finally {
      setLoadingList(false);
    }
  }, [caseId]);

  useEffect(() => { loadUpdates(); }, [loadUpdates]);

  const submit = async () => {
    if (!title.trim()) { setError(isRTL ? 'الرسالة مطلوبة' : 'Message required'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/cases/${caseId}/updates`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title: title.trim(), visibility }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setSaved(true);
      setTitle('');
      setTimeout(() => setSaved(false), 2000);
      loadUpdates();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleString(isRTL ? 'ar-AE' : 'en-AE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
        <Send className="h-4 w-4 text-[#0E7490]" />
        {isRTL ? 'تحديث للعميل' : 'Client Update'}
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        {isRTL
          ? 'اكتب تحديثًا واختر إن كان سيظهر للعميل فورًا أم يبقى ملاحظة داخلية.'
          : 'Write an update and choose whether the client sees it instantly, or keep it as an internal note.'}
      </p>

      <div className="space-y-3">
        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          rows={3}
          placeholder={isRTL ? 'مثال: تم تقديم اللائحة الجوابية اليوم...' : 'e.g. Filed the response brief today...'}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0E7490]/30"
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setVisibility('client_visible')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition',
              visibility === 'client_visible'
                ? 'border-[#0E7490] bg-[#0E7490]/10 text-[#0E7490]'
                : 'border-border text-muted-foreground hover:bg-accent'
            )}
          >
            <Users className="h-3.5 w-3.5" />
            {isRTL ? 'مشاركة مع العميل' : 'Share with client'}
          </button>
          <button
            type="button"
            onClick={() => setVisibility('internal')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition',
              visibility === 'internal'
                ? 'border-[#1A3557] bg-[#1A3557]/10 text-[#1A3557]'
                : 'border-border text-muted-foreground hover:bg-accent'
            )}
          >
            <Lock className="h-3.5 w-3.5" />
            {isRTL ? 'ملاحظة داخلية فقط' : 'Internal note only'}
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-600 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2">{error}</p>
        )}

        <button
          onClick={submit}
          disabled={loading || !title.trim()}
          className={cn(
            'w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition',
            saved
              ? 'bg-emerald-500 text-white'
              : visibility === 'client_visible'
              ? 'bg-[#0E7490] text-white hover:bg-[#0c6079] disabled:opacity-50'
              : 'bg-[#1A3557] text-white hover:bg-[#1e4a7a] disabled:opacity-50'
          )}
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" />{isRTL ? 'جارٍ الإرسال…' : 'Sending…'}</>
          ) : saved ? (
            <><Check className="h-4 w-4" />{isRTL ? 'تم الإرسال!' : 'Sent!'}</>
          ) : visibility === 'client_visible' ? (
            <><Users className="h-4 w-4" />{isRTL ? 'إرسال للعميل الآن' : 'Send to client now'}</>
          ) : (
            <><Lock className="h-4 w-4" />{isRTL ? 'حفظ كملاحظة داخلية' : 'Save internal note'}</>
          )}
        </button>
      </div>

      {!loadingList && updates.length > 0 && (
        <div className="mt-5 space-y-2 border-t border-border pt-4">
          {updates.map((u) => (
            <div key={u.id} className="flex items-start justify-between gap-3 rounded-xl border border-border p-3">
              <div className="min-w-0">
                <p className="text-xs text-foreground">{u.payload?.title}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground" dir="ltr">{fmt(u.created_at)}</p>
              </div>
              <span
                className={cn(
                  'flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                  u.visibility === 'client_visible'
                    ? 'bg-[#0E7490]/10 text-[#0E7490]'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {u.visibility === 'client_visible' ? (
                  <><Users className="h-3 w-3" />{isRTL ? 'مرئي للعميل' : 'Client-visible'}</>
                ) : (
                  <><Lock className="h-3 w-3" />{isRTL ? 'داخلي' : 'Internal'}</>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
