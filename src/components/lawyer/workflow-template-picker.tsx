'use client';

import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Template {
  id: string;
  name: string;
  case_type: string | null;
  steps: { title: string; default_due_offset_days?: number }[];
}

interface Instance {
  id: string;
  template_id: string;
  current_step: number;
  status: string;
}

interface WorkflowTemplatePickerProps {
  caseId: string;
  locale: string;
}

export function WorkflowTemplatePicker({ caseId, locale }: WorkflowTemplatePickerProps) {
  const isRTL = locale === 'ar';

  const [templates, setTemplates] = useState<Template[]>([]);
  const [instance, setInstance]   = useState<Instance | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [applying, setApplying]   = useState<string | null>(null);
  const [error, setError]         = useState('');
  const [tasksCreated, setTasksCreated] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/workflow`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates ?? []);
        setInstance(data.instance ?? null);
      }
    } finally {
      setLoadingList(false);
    }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const apply = async (templateId: string) => {
    setApplying(templateId);
    setError('');
    try {
      const res = await fetch(`/api/cases/${caseId}/workflow`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ template_id: templateId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTasksCreated(data.tasks_created);
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setApplying(null);
    }
  };

  if (loadingList) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 flex justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeTemplate = instance ? templates.find((t) => t.id === instance.template_id) : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-[#1A3557]" />
        {isRTL ? 'قوالب سير العمل' : 'Workflow Checklist'}
      </h3>

      {instance && activeTemplate ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {isRTL ? 'القالب المطبّق:' : 'Applied template:'} <span className="font-medium text-foreground">{activeTemplate.name}</span>
          </p>
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground mb-2">
              {isRTL
                ? `تم إنشاء ${activeTemplate.steps.length} مهمة من هذا القالب — تابعها في قسم المهام أعلاه.`
                : `${activeTemplate.steps.length} tasks were created from this checklist — track them in the Tasks section above.`}
            </p>
            <ul className="space-y-1.5">
              {activeTemplate.steps.map((step, idx) => (
                <li key={idx} className="flex items-center gap-2 text-xs text-foreground">
                  <CheckCircle2 className={cn('h-3.5 w-3.5 shrink-0', idx < instance.current_step ? 'text-emerald-500' : 'text-muted-foreground/40')} />
                  {step.title}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground mb-2">
            {isRTL
              ? 'طبّق قائمة تحقق جاهزة لإنشاء مهام هذه القضية دفعة واحدة.'
              : 'Apply a ready-made checklist to generate this case\'s tasks all at once.'}
          </p>

          {tasksCreated !== null && (
            <p className="text-xs text-emerald-600 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2">
              {isRTL ? `تم إنشاء ${tasksCreated} مهمة` : `${tasksCreated} tasks created`}
            </p>
          )}
          {error && <p className="text-xs text-red-600 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2">{error}</p>}

          {templates.length === 0 ? (
            <p className="text-xs text-muted-foreground">{isRTL ? 'لا توجد قوالب متاحة' : 'No templates available'}</p>
          ) : (
            <ul className="space-y-2">
              {templates.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 rounded-xl border border-border p-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground">{t.steps.length} {isRTL ? 'خطوات' : 'steps'}</p>
                  </div>
                  <button
                    onClick={() => apply(t.id)}
                    disabled={applying === t.id}
                    className="shrink-0 flex items-center gap-1.5 rounded-lg bg-[#1A3557] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#1e4a7a] disabled:opacity-50"
                  >
                    {applying === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    {isRTL ? 'تطبيق' : 'Apply'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
