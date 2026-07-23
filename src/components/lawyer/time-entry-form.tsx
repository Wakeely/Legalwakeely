'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, Loader2, Check, Receipt, Users } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface TimeEntry {
  id: string;
  minutes: number;
  rate_per_hour: number | null;
  description: string;
  is_billable: boolean;
  entry_date: string;
  invoice_item_id: string | null;
}

interface TimeEntryFormProps {
  caseId: string;
  locale: string;
}

export function TimeEntryForm({ caseId, locale }: TimeEntryFormProps) {
  const isRTL = locale === 'ar';
  const today = new Date().toISOString().split('T')[0];

  const [entries, setEntries]         = useState<TimeEntry[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [minutes, setMinutes]       = useState('30');
  const [description, setDesc]      = useState('');
  const [isBillable, setBillable]   = useState(true);
  const [entryDate, setEntryDate]   = useState(today);
  const [loading, setLoading]       = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState('');

  // Invoicing
  const [selected, setSelected]             = useState<Set<string>>(new Set());
  const [matterDescription, setMatterDesc]  = useState('');
  const [generating, setGenerating]         = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState<{ id: string; invoice_number: string } | null>(null);
  const [invoiceError, setInvoiceError]     = useState('');

  const loadEntries = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/time-entries`);
      if (res.ok) setEntries(await res.json());
    } finally {
      setLoadingList(false);
    }
  }, [caseId]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const submit = async () => {
    if (!description.trim()) { setError(isRTL ? 'الوصف مطلوب' : 'Description required'); return; }
    const mins = parseInt(minutes, 10);
    if (!mins || mins <= 0) { setError(isRTL ? 'المدة يجب أن تكون أكبر من صفر' : 'Minutes must be greater than zero'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/cases/${caseId}/time-entries`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ minutes: mins, description: description.trim(), is_billable: isBillable, entry_date: entryDate }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setSaved(true);
      setDesc('');
      setMinutes('30');
      setEntryDate(today);
      setTimeout(() => setSaved(false), 2000);
      loadEntries();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const generateInvoice = async () => {
    if (selected.size === 0) { setInvoiceError(isRTL ? 'اختر إدخالًا واحدًا على الأقل' : 'Select at least one entry'); return; }
    if (!matterDescription.trim()) { setInvoiceError(isRTL ? 'وصف موضوع الفاتورة مطلوب' : 'A matter description is required'); return; }

    setGenerating(true);
    setInvoiceError('');
    try {
      const res = await fetch(`/api/cases/${caseId}/time-entries/generate-invoice`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          time_entry_ids: Array.from(selected),
          matter_description: matterDescription.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGeneratedInvoice(data.invoice);
      setSelected(new Set());
      setMatterDesc('');
      loadEntries();
    } catch (e) {
      setInvoiceError(String(e));
    } finally {
      setGenerating(false);
    }
  };

  const totalMinutesThisCase = entries.reduce((sum, e) => sum + e.minutes, 0);
  const fmtHours = (mins: number) => (mins / 60).toFixed(1);

  const unbilledSelectable = entries.filter((e) => e.is_billable && !e.invoice_item_id);
  const selectedMinutes = entries.filter((e) => selected.has(e.id)).reduce((sum, e) => sum + e.minutes, 0);
  const selectedAmount = entries
    .filter((e) => selected.has(e.id))
    .reduce((sum, e) => sum + (e.minutes / 60) * (e.rate_per_hour ?? 0), 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <Clock className="h-4 w-4 text-[#1A3557]" />
        {isRTL ? 'تسجيل الوقت' : 'Time Tracking'}
        {entries.length > 0 && (
          <span className="ms-auto rounded-full bg-muted px-2 py-0.5 text-[10px]" dir="ltr">
            {fmtHours(totalMinutesThisCase)}h {isRTL ? 'إجمالي' : 'total'}
          </span>
        )}
      </h3>

      <div className="space-y-3 mb-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {isRTL ? 'الدقائق' : 'Minutes'}
            </label>
            <input
              type="number"
              min={1}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3557]/30"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {isRTL ? 'التاريخ' : 'Date'}
            </label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              max={today}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3557]/30"
              dir="ltr"
            />
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
            placeholder={isRTL ? 'ما الذي تم إنجازه…' : 'What did you work on…'}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1A3557]/30"
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={isBillable} onChange={(e) => setBillable(e.target.checked)} />
          {isRTL ? 'قابل للفوترة' : 'Billable'}
        </label>

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
            <><Clock className="h-4 w-4" />{isRTL ? 'تسجيل الوقت' : 'Log Time'}</>
          )}
        </button>
      </div>

      {!loadingList && entries.length > 0 && (
        <div className="space-y-2 border-t border-border pt-4">
          {entries.slice(0, 8).map((e) => {
            const selectable = e.is_billable && !e.invoice_item_id;
            return (
              <div key={e.id} className="flex items-center gap-2 rounded-xl border border-border p-3">
                {selectable ? (
                  <input
                    type="checkbox"
                    checked={selected.has(e.id)}
                    onChange={() => toggleSelected(e.id)}
                    className="shrink-0"
                  />
                ) : (
                  <span className="w-[13px] shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">{e.description}</p>
                  <p className="text-[10px] text-muted-foreground" dir="ltr">
                    {new Date(e.entry_date).toLocaleDateString(isRTL ? 'ar-AE' : 'en-AE', { day: 'numeric', month: 'short' })}
                    {!e.is_billable && ` · ${isRTL ? 'غير قابل للفوترة' : 'non-billable'}`}
                    {e.invoice_item_id && ` · ${isRTL ? 'مفوتر' : 'invoiced'}`}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground" dir="ltr">
                  {fmtHours(e.minutes)}h
                </span>
              </div>
            );
          })}
        </div>
      )}

      {unbilledSelectable.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5 text-[#C89B3C]" />
            {isRTL ? 'إنشاء فاتورة من الوقت المحدد' : 'Generate invoice from selected time'}
          </h4>

          {selected.size > 0 && (
            <p className="text-[11px] text-muted-foreground" dir="ltr">
              {selected.size} {isRTL ? 'عنصر' : 'items'} · {fmtHours(selectedMinutes)}h · {selectedAmount.toFixed(2)} JOD
            </p>
          )}

          <input
            type="text"
            value={matterDescription}
            onChange={(e) => setMatterDesc(e.target.value)}
            placeholder={isRTL ? 'وصف موضوع الفاتورة…' : 'Matter description for the invoice…'}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#1A3557]/30"
          />

          {invoiceError && <p className="text-xs text-red-600">{invoiceError}</p>}

          {generatedInvoice ? (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2">
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                {isRTL ? `تم إنشاء الفاتورة ${generatedInvoice.invoice_number}` : `Invoice ${generatedInvoice.invoice_number} created`}
              </p>
              <Link
                href={`/${locale}/lawyer/invoices`}
                className="shrink-0 text-xs font-semibold text-[#0E7490] hover:underline"
              >
                {isRTL ? 'عرض الفواتير' : 'View invoices'}
              </Link>
            </div>
          ) : (
            <button
              onClick={generateInvoice}
              disabled={generating || selected.size === 0 || !matterDescription.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#C89B3C] py-2 text-xs font-bold text-[#1A3557] hover:brightness-95 disabled:opacity-50"
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Receipt className="h-3.5 w-3.5" />}
              {isRTL ? 'إنشاء الفاتورة' : 'Generate invoice'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
