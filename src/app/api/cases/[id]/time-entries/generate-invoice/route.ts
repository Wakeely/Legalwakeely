import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sanitizeText } from '@/lib/sanitize';

// POST — turn selected unbilled time entries into a draft invoice.
// Reuses the exact same insert shape as POST /api/invoices (same DB
// triggers handle invoice_number generation and totals), so this produces
// a normal invoice indistinguishable from one created by hand — it just
// pre-fills the line items from time tracking instead of manual entry.
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

  const { time_entry_ids, matter_description, tax_rate } = await request.json();
  if (!Array.isArray(time_entry_ids) || time_entry_ids.length === 0) {
    return NextResponse.json({ error: 'time_entry_ids is required' }, { status: 400 });
  }
  if (!matter_description || !matter_description.trim()) {
    return NextResponse.json({ error: 'matter_description is required' }, { status: 400 });
  }

  // Only pull entries that are actually billable and not already invoiced.
  const { data: entries, error: entriesErr } = await supabase
    .from('time_entries')
    .select('id, minutes, rate_per_hour, description, entry_date')
    .eq('case_id', case_id)
    .eq('is_billable', true)
    .is('invoice_item_id', null)
    .in('id', time_entry_ids);

  if (entriesErr) return NextResponse.json({ error: entriesErr.message }, { status: 500 });
  if (!entries || entries.length === 0) {
    return NextResponse.json({ error: 'No eligible unbilled time entries found' }, { status: 400 });
  }

  const { data: caseRow } = await supabase
    .from('cases')
    .select('client_id')
    .eq('id', case_id)
    .maybeSingle();
  if (!caseRow) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

  // Same insert shape as POST /api/invoices — invoice_number and totals
  // are computed by the same DB trigger either way.
  const { data: invoice, error: invoiceErr } = await supabase
    .from('invoices')
    .insert({
      case_id,
      lawyer_id:          user.id,
      client_id:          caseRow.client_id,
      matter_description: sanitizeText(matter_description),
      invoice_date:       new Date().toISOString().split('T')[0],
      tax_rate:           tax_rate ?? 16,
      currency:           'JOD',
      invoice_number:     '', // DB trigger auto-generates
    })
    .select('id, invoice_number')
    .single();

  if (invoiceErr || !invoice) {
    return NextResponse.json({ error: invoiceErr?.message ?? 'Failed to create invoice' }, { status: 500 });
  }

  const itemRows = entries.map((e, idx) => ({
    invoice_id:  invoice.id,
    item_type:   'professional_service',
    item_date:   e.entry_date,
    description: sanitizeText(e.description),
    hours:       Math.round((e.minutes / 60) * 100) / 100,
    rate:        e.rate_per_hour ?? 0,
    sort_order:  idx,
  }));

  const { data: createdItems, error: itemsErr } = await supabase
    .from('invoice_items')
    .insert(itemRows)
    .select('id, sort_order');

  if (itemsErr || !createdItems) {
    return NextResponse.json({ error: itemsErr?.message ?? 'Failed to create invoice line items' }, { status: 500 });
  }

  // Link each time entry to the invoice line item it became, so it won't
  // be offered again next time (is.invoice_item_id null filter above).
  const bySortOrder = new Map(createdItems.map((it) => [it.sort_order, it.id]));
  await Promise.all(
    entries.map((e, idx) =>
      supabase.from('time_entries').update({ invoice_item_id: bySortOrder.get(idx) }).eq('id', e.id)
    )
  );

  return NextResponse.json({ invoice }, { status: 201 });
}
