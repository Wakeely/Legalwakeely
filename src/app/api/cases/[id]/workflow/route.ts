import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface WorkflowStep {
  title: string;
  default_due_offset_days?: number;
}

// GET — available templates + this case's current workflow instance (if any)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: case_id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: assignment } = await supabase
    .from('case_lawyers')
    .select('id')
    .eq('case_id', case_id)
    .eq('lawyer_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!assignment) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: templates } = await supabase
    .from('workflow_templates')
    .select('id, name, case_type, steps')
    .order('created_at', { ascending: true });

  const { data: instance } = await supabase
    .from('workflow_instances')
    .select('id, template_id, current_step, status')
    .eq('case_id', case_id)
    .order('created_at', { ascending: false })
    .maybeSingle();

  return NextResponse.json({ templates: templates ?? [], instance: instance ?? null });
}

// POST — apply a template to this case: create the instance and generate
// a task/deadline for each step, offset from today by default_due_offset_days.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: case_id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: assignment } = await supabase
    .from('case_lawyers')
    .select('id, permissions')
    .eq('case_id', case_id)
    .eq('lawyer_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!assignment) return NextResponse.json({ error: 'Not assigned to this case' }, { status: 403 });
  if (assignment.permissions !== 'write' && assignment.permissions !== 'read_write') {
    return NextResponse.json({ error: 'Read-only access to this case' }, { status: 403 });
  }

  const { template_id } = await request.json();
  if (!template_id) return NextResponse.json({ error: 'template_id is required' }, { status: 400 });

  const { data: existing } = await supabase
    .from('workflow_instances')
    .select('id')
    .eq('case_id', case_id)
    .eq('status', 'active')
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'A workflow is already active on this case' }, { status: 409 });
  }

  const { data: template } = await supabase
    .from('workflow_templates')
    .select('id, name, steps')
    .eq('id', template_id)
    .maybeSingle();
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  const { data: instance, error: instanceErr } = await supabase
    .from('workflow_instances')
    .insert({ case_id, template_id, current_step: 0, status: 'active' })
    .select('id, template_id, current_step, status')
    .single();
  if (instanceErr || !instance) {
    return NextResponse.json({ error: instanceErr?.message }, { status: 500 });
  }

  const steps = (template.steps as WorkflowStep[]) ?? [];
  const today = new Date();
  const taskRows = steps.map((step) => {
    const due = new Date(today);
    due.setDate(due.getDate() + (step.default_due_offset_days ?? 7));
    return {
      case_id,
      title: step.title,
      type: 'internal',
      priority: 'medium',
      due_date: due.toISOString().split('T')[0],
    };
  });

  if (taskRows.length > 0) {
    await supabase.from('deadlines').insert(taskRows);
  }

  return NextResponse.json({ instance, tasks_created: taskRows.length }, { status: 201 });
}
