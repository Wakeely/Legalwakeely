'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileSearch, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type RequestType = 'interrogatory' | 'document_request' | 'deposition' | 'admission' | 'subpoena' | 'expert_disclosure';
type Direction = 'incoming' | 'outgoing';

interface DiscoveryRequest {
  id: string;
  request_type: RequestType;
  direction: Direction;
  description: string;
  served_date: string | null;
  response_due_date: string | null;
  status: string;
  created_at: string;
}

const REQUEST_TYPES: { value: RequestType; en: string; ar: string }[] = [
  { value: 'interrogatory',      en: 'Interrogatory',       ar: 'استجواب خطي'     },
  { value: 'document_request',   en: 'Document Request',    ar: 'طلب مستندات'     },
  { value: 'deposition',         en: 'Deposition',          ar: 'إفادة شهود'      },
  { value: 'admission',          en: 'Admission',           ar: 'طلب إقرار'       },
  { value: 'subpoena',           en: 'Subpoena',            ar: 'أمر استدعاء'     },
  { value: 'expert_disclosure',  en: 'Expert Disclosure',   ar: 'إفصاح خبير'      },
];

interface DiscoveryTrackerProps {
  caseId: string;
  locale: string;
}

export function DiscoveryTracker({ caseId, locale }: DiscoveryTrackerProps) {
  const isRTL = locale === 'ar';

  const [requests, setRequests] = useState<DiscoveryRequest[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [requestType, setRequestType] = useState<RequestType>('document_request');
  const [direction, setDirection]     = useState<Direction>('outgoing');
  const [description, setDesc]        = useState('');
  const [responseDue, setResponseDue] = useState('');
  const [loading, setLoading]         = useState(false);
  const [saved, setSaved]             = useState(false);
  const [error, setError]             = useState('');

  const loadRequests = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/discovery`);
      if (res.ok) setRequests(await res.json());
    } finally {
      setLoadingList(false);
    }
  }, [caseId]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const submit = async () => {
    if (!description.trim()) { setError(isRTL ? 'الوصف مطلوب' : 'Description required'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/cases/${caseId}/discovery`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          request_type: requestType,
          direction,
          description: description.trim(),
          response_due_date: responseDue || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setSaved(true);
      setDesc('');
      setResponseDue('');
      setTimeout(() => setSaved(false), 2000);
      loadRequests();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(isRTL ? 'ar-AE' : 'en-AE', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <FileSearch className="h-4 w-4 text-[#1A3557]" />
        {isRTL ? 'الاكتشاف (Discovery)' : 'Discovery Tracking'}
        {requests.length > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{requests.length}</span>
        )}
      </h3>

      <div className="space-y-3 mb-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {isRTL ? 'نوع الطلب' : 'Request Type'}
            </label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as RequestType)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3557]/30"
            >
              {REQUEST_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{isRTL ? t.ar : t.en}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {isRTL ? 'الاتجاه' : 'Direction'}
            </label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as Direction)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3557]/30"
            >
              <option value="outgoing">{isRTL ? 'صادر منّا' : 'Served by us'}</option>
              <option value="incoming">{isRTL ? 'وارد إلينا' : 'Served on us'}</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            {isRTL ? 'الوصف' : 'Description'}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
            placeholder={isRTL ? 'تفاصيل الطلب…' : 'Describe the request…'}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1A3557]/30"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            {isRTL ? 'موعد الاستحقاق' : 'Response Due'}
          </label>
          <input
            type="date"
            value={responseDue}
            onChange={(e) => setResponseDue(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3557]/30"
            dir="ltr"
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2">{error}</p>
        )}

        <button
          onClick={submit}
          disabled={loading || !description.trim()}
          className={cn(
            'w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition',
            saved ? 'bg-emerald-500 text-white' : 'bg-[#1A3557] text-white hover:bg-[#1e4a7a] disabled:opacity-50'
          )}
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" />{isRTL ? 'جارٍ الحفظ…' : 'Saving…'}</>
          ) : saved ? (
            <><Check className="h-4 w-4" />{isRTL ? 'تم الحفظ!' : 'Saved!'}</>
          ) : (
            <><FileSearch className="h-4 w-4" />{isRTL ? 'إضافة طلب' : 'Add Request'}</>
          )}
        </button>
      </div>

      {!loadingList && requests.length > 0 && (
        <div className="space-y-2 border-t border-border pt-4">
          {requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-border p-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{r.description}</p>
                <p className="text-[10px] text-muted-foreground">
                  {REQUEST_TYPES.find((t) => t.value === r.request_type)?.[isRTL ? 'ar' : 'en']}
                  {r.response_due_date && ` · ${fmtDate(r.response_due_date)}`}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
