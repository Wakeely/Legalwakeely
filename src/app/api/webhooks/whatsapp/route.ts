import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import crypto from 'crypto';

export const runtime = 'nodejs';

/* ─────────────────────────────────────────────────────────────────
   WhatsApp Cloud API — Two-Way Bot

   Inbound messages are appended to the Action Log of the
   client's most recent active case. If the message contains
   escalation keywords, a guided flow begins.

   Webhook URL: POST /api/webhooks/whatsapp
   Verify URL:  GET  /api/webhooks/whatsapp
   ───────────────────────────────────────────────────────────────── */

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? 'wakeela_verify_2026';
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

// ── Verify webhook (Meta one-time handshake) ────────────────────
export async function GET(request: Request) {
  const url    = new URL(request.url);
  const mode   = url.searchParams.get('hub.mode');
  const token  = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

// ── Verify Meta signature ───────────────────────────────────────
function verifySignature(body: string, signature: string | null): boolean {
  if (!APP_SECRET || !signature) return !APP_SECRET; // skip if no secret configured
  const expected = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// ── Receive inbound messages ────────────────────────────────────
export async function POST(request: Request) {
  // ── Signature verification ──────────────────────────────────
  const h = await headers();
  const signature = h.get('x-hub-signature-256');

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Cannot read body' }, { status: 400 });
  }

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Meta sends all events — only process message events
  const entry   = (body?.entry as { changes?: unknown[] }[])?.[0];
  const changes = (entry?.changes as { value?: unknown }[])?.[0];
  const value   = changes?.value as Record<string, unknown> | undefined;

  if (!value?.messages) {
    return NextResponse.json({ status: 'ok' });
  }

  const messages = value.messages as Array<{
    id: string; from: string; type: string;
    text?: { body: string }; timestamp: string;
  }>;

  const sb = createAdminClient();

  for (const msg of messages) {
    if (msg.type !== 'text') continue;
    const fromPhone = msg.from;
    const body_text = msg.text?.body?.trim() ?? '';
    const wamid     = msg.id;

    // Idempotency check
    const { data: existing } = await sb
      .from('whatsapp_messages')
      .select('id').eq('wamid', wamid).maybeSingle();
    if (existing) continue;

    // Look up user by phone number (normalised)
    const cleanPhone = fromPhone.replace(/\D/g, '');
    const { data: user } = await sb
      .from('users')
      .select('id, locale, whatsapp_phone')
      .or(`whatsapp_phone.eq.${cleanPhone},whatsapp_phone.eq.+${cleanPhone}`)
      .maybeSingle();

    // Log the raw inbound message
    await sb.from('whatsapp_messages').insert({
      wamid,
      from_phone:  `+${cleanPhone}`,
      to_phone:    process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
      direction:   'inbound',
      message_type: 'text',
      body:        body_text.slice(0, 2000), // limit size
      user_id:     user?.id ?? null,
      raw_payload: body,
    });

    if (!user) {
      await sendWA(`+${cleanPhone}`,
        `👋 Welcome to Legal Wakeely!\nRegister at wakeelai-sigma.vercel.app to link your account.\n\nمرحباً بك في وكيلي القانونى!\nسجّل في wakeelai-sigma.vercel.app لربط حسابك.`
      );
      continue;
    }

    const isAr = user.locale === 'ar';
    await processInboundMessage(sb, user.id, `+${cleanPhone}`, body_text, wamid, isAr);
  }

  return NextResponse.json({ status: 'ok' });
}

/* ─── Message processor ─────────────────────────────────────────── */
async function processInboundMessage(
  sb: ReturnType<typeof createAdminClient>,
  userId: string,
  phone: string,
  text: string,
  wamid: string,
  isAr: boolean,
) {
  const { data: session } = await sb
    .from('whatsapp_sessions')
    .select('*').eq('phone', phone).maybeSingle();

  const state = session?.state ?? 'idle';
  const lower = text.toLowerCase();

  // ── HELP / STATUS commands ────────────────────────────────────
  if (['help', 'مساعدة', 'hi', 'مرحبا', 'hello', 'start', 'ابدأ'].includes(lower)) {
    await sendWA(phone, isAr
      ? `مرحباً بك في وكيلي القانونى 👋\n\nيمكنك:\n• اكتب "قضية" لعرض قضاياك\n• اكتب "تصعيد" للحصول على مساعدة في التصعيد\n• اكتب "حالة" لمعرفة آخر تحديث\n• أي رسالة أخرى ستُضاف كتحديث للسجل.`
      : `Welcome to Legal Wakeely 👋\n\nYou can:\n• Type "cases" to list your cases\n• Type "escalate" for escalation help\n• Type "status" for your latest update\n• Any other message will be appended to your action log.`
    );
    return;
  }

  // ── STATUS command ────────────────────────────────────────────
  if (['status', 'حالة', 'case status'].includes(lower)) {
    const { data: cases } = await sb.from('cases')
      .select('id, title, health_score, updated_at')
      .eq('client_id', userId).eq('status', 'active')
      .order('updated_at', { ascending: false }).limit(3);

    if (!cases?.length) {
      await sendWA(phone, isAr ? 'لا توجد قضايا نشطة.' : 'No active cases found.');
      return;
    }

    const lines = cases.map((c) =>
      `📋 ${c.title}\n   ${isAr ? 'الصحة' : 'Health'}: ${c.health_score}%\n   ${isAr ? 'آخر تحديث' : 'Updated'}: ${new Date(c.updated_at).toLocaleDateString(isAr ? 'ar-AE' : 'en-AE')}`
    ).join('\n\n');

    await sendWA(phone, (isAr ? '📊 قضاياك النشطة:\n\n' : '📊 Your active cases:\n\n') + lines);
    return;
  }

  // ── ESCALATION command ────────────────────────────────────────
  if (['escalate', 'تصعيد', 'escalation', 'شكوى'].includes(lower)) {
    const { data: cases } = await sb.from('cases')
      .select('id, title').eq('client_id', userId).eq('status', 'active')
      .order('updated_at', { ascending: false }).limit(1);

    const caseId = cases?.[0]?.id;
    if (caseId) {
      const link = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://wakeelai-sigma.vercel.app'}/${isAr ? 'ar' : 'en'}/escalation/${caseId}`;
      await sendWA(phone, isAr
        ? `⚖️ لفتح أدوات التصعيد لقضيتك:\n${link}`
        : `⚖️ Open the escalation toolkit for your case:\n${link}`
      );
    } else {
      await sendWA(phone, isAr ? 'لا توجد قضايا نشطة للتصعيد.' : 'No active cases to escalate.');
    }
    return;
  }

  // ── Default: append to most recent active case action log ────
  const { data: activeCases } = await sb
    .from('cases').select('id, title')
    .eq('client_id', userId).eq('status', 'active')
    .order('updated_at', { ascending: false }).limit(1);

  const targetCase = activeCases?.[0];

  if (!targetCase) {
    await sendWA(phone, isAr
      ? 'لا توجد قضايا نشطة. أنشئ قضية أولاً في wakeelai-sigma.vercel.app'
      : 'No active cases. Create one first at wakeelai-sigma.vercel.app'
    );
    return;
  }

  const { data: assignment } = await sb
    .from('case_lawyers').select('lawyer_id')
    .eq('case_id', targetCase.id).eq('status', 'active').maybeSingle();

  if (!assignment) {
    await sb.from('timeline_events').insert({
      case_id:             targetCase.id,
      actor_id:            userId,
      event_type:          'whatsapp_message',
      payload:             { body: text.slice(0, 2000), source: 'whatsapp', wamid },
      is_system_generated: false,
    });
  } else {
    const { data: logEntry } = await sb.from('action_logs').insert({
      case_id:     targetCase.id,
      lawyer_id:   assignment.lawyer_id,
      action_type: 'client_contacted',
      description: `[WhatsApp] ${text.slice(0, 2000)}`,
      action_date: new Date().toISOString().split('T')[0],
    }).select('id').single();

    await sb.from('whatsapp_messages')
      .update({ action_log_id: logEntry?.id, case_id: targetCase.id, processed: true })
      .eq('wamid', wamid);

    await sb.from('timeline_events').insert({
      case_id:             targetCase.id,
      actor_id:            userId,
      event_type:          'action_logged',
      payload:             { description: text.slice(0, 2000), source: 'whatsapp', action_log_id: logEntry?.id },
      is_system_generated: false,
    });
  }

  await sendWA(phone, isAr
    ? `✅ تم تسجيل رسالتك في سجل القضية "${targetCase.title}"\n\nيمكنك متابعة قضيتك في التطبيق.`
    : `✅ Your message has been logged to case "${targetCase.title}"\n\nTrack your case in the app.`
  );

  await sb.from('whatsapp_sessions').upsert({
    user_id:       userId,
    phone,
    state:         'idle',
    case_id:       targetCase.id,
    last_wamid:    wamid,
    last_active_at: new Date().toISOString(),
  }, { onConflict: 'phone' });
}

/* ─── WhatsApp send helper ──────────────────────────────────────── */
async function sendWA(to: string, message: string) {
  const token   = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return;

  const cleanTo = to.replace(/\D/g, '');

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to:   cleanTo,
        type: 'text',
        text: { body: message, preview_url: false },
      }),
    });

    const data = await res.json();

    const sb = createAdminClient();
    try {
      await sb.from('whatsapp_messages').insert({
        wamid:        data.messages?.[0]?.id ?? `out_${Date.now()}`,
        from_phone:   `+${phoneId}`,
        to_phone:     `+${cleanTo}`,
        direction:    'outbound',
        message_type: 'text',
        body:         message.slice(0, 2000),
        processed:    true,
      });
    } catch { /* non-critical */ }

  } catch (err) {
    console.error('[WhatsApp] Send failed:', err);
  }
}
