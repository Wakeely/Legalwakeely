'use client';

import { useState, useEffect, useCallback } from 'react';
import { ListChecks, Loader2, Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

type Priority = 'low' | 'medium' | 'high' | 'critical';
type Status = 'pending' | 'completed' | 'missed';

interface Task {
  id: string;
  title: string;
  due_date: string | null;
  type: string;
  status: Status;
  priority: Priority;
  assigned_to: string | null;
  assignee?: { id: string; full_name: string } | null;
}

interface CaseLawyer {
  id: string;
  full_name: string | null;
}

const PRIORITY_STYLE: Record<Priority, string> = {
  low:      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  medium:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  high:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const PRIORITY_LABEL: Record<Priority, { en: string; ar: string }> = {
  low:      { en: 'Low',      ar: 'منخفضة' },
  medium:   { en: 'Medium',   ar: 'متوسطة' },
  high:     { en: 'High',     ar: 'عالية' },
  critical: { en: 'Critical', ar: 'حرجة' },
};

interface TaskManagerProps {
  caseId: string;
  locale: string;
}

export function TaskManager({ caseId, locale }: TaskManagerProps) {
  const isRTL = locale === 'ar';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [lawyers, setLawyers] = useState<CaseLawyer[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [assignedTo, setAssignedTo] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/tasks`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks ?? []);
        setLawyers(data.lawyers ?? []);
      }
    } finally {
      setLoadingList(false);
    }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const createTask = async () => {
    if (!title.trim()) { setError(isRTL ? 'العنوان مطلوب' : 'Title required'); return; }
    setCreating(true);
    setError('');
    try {
      const res = await fetch(`/api/cases/${caseId}/tasks`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          title: title.trim(),
          due_date: dueDate || null,
          priority,
          assigned_to: assignedTo || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setTitle('');
      setDueDate('');
      setPriority('medium');
      setAssignedTo('');
      setShowForm(false);
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  };

  const updateTask = async (taskId: string, patch: Record<string, unknown>) => {
    // optimistic update
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } as Task : t)));
    await fetch(`/api/cases/${caseId}/tasks/${taskId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(patch),
    });
    load();
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(isRTL ? 'ar-AE' : 'en-AE', { day: 'numeric', month: 'short' });

  const pending = tasks.filter((t) => t.status === 'pending');
  const done    = tasks.filter((t) => t.status !== 'pending');

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-[#1A3557]" />
          {isRTL ? 'المهام' : 'Tasks'}
          {pending.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{pending.length}</span>
          )}
        </h3>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#1A3557] hover:bg-accent"
        >
          <Plus className="h-3.5 w-3.5" />
          {isRTL ? 'مهمة جديدة' : 'New task'}
        </button>
      </div>

      {showForm && (
        <div className="mb-4 space-y-2 rounded-xl border border-border p-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isRTL ? 'عنوان المهمة…' : 'Task title…'}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3557]/30"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#1A3557]/30"
              dir="ltr"
            />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="rounded-lg border border-border bg-background px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#1A3557]/30"
            >
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                <option key={p} value={p}>{PRIORITY_LABEL[p][isRTL ? 'ar' : 'en']}</option>
              ))}
            </select>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#1A3557]/30"
            >
              <option value="">{isRTL ? 'غير معيّن' : 'Unassigned'}</option>
              {lawyers.map((l) => (
                <option key={l.id} value={l.id}>{l.full_name ?? l.id}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            onClick={createTask}
            disabled={creating || !title.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#1A3557] py-2 text-xs font-bold text-white hover:bg-[#1e4a7a] disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {isRTL ? 'إضافة' : 'Add task'}
          </button>
        </div>
      )}

      {loadingList ? (
        <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          {isRTL ? 'لا توجد مهام بعد' : 'No tasks yet'}
        </p>
      ) : (
        <div className="space-y-2">
          {[...pending, ...done].map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-xl border border-border p-3">
              <button
                onClick={() => updateTask(t.id, { status: t.status === 'pending' ? 'completed' : 'pending' })}
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition',
                  t.status !== 'pending' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-border'
                )}
              >
                {t.status !== 'pending' && <Check className="h-3 w-3" />}
              </button>

              <div className="min-w-0 flex-1">
                <p className={cn('text-xs font-medium truncate', t.status !== 'pending' && 'line-through text-muted-foreground')}>
                  {t.title}
                </p>
                {t.due_date && (
                  <p className="text-[10px] text-muted-foreground" dir="ltr">{fmtDate(t.due_date)}</p>
                )}
              </div>

              <select
                value={t.priority}
                onChange={(e) => updateTask(t.id, { priority: e.target.value })}
                className={cn('shrink-0 rounded-full border-0 px-2 py-0.5 text-[10px] font-medium', PRIORITY_STYLE[t.priority])}
              >
                {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABEL[p][isRTL ? 'ar' : 'en']}</option>
                ))}
              </select>

              <select
                value={t.assigned_to ?? ''}
                onChange={(e) => updateTask(t.id, { assigned_to: e.target.value || null })}
                className="shrink-0 max-w-[110px] rounded-lg border border-border bg-background px-1.5 py-1 text-[10px] focus:outline-none"
              >
                <option value="">{isRTL ? 'غير معيّن' : 'Unassigned'}</option>
                {lawyers.map((l) => (
                  <option key={l.id} value={l.id}>{l.full_name ?? l.id}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
