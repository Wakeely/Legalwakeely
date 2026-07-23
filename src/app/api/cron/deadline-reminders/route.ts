import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime     = 'nodejs';
export const maxDuration = 180;

/**
 * Deadline Reminders Cron — runs daily at 08:00 UTC via Vercel Cron.
 * Fires reminder emails and WhatsApp messages for deadlines whose
 * reminder_days array includes today's days-until count.
 *
 * MVP: outbound only (email + WhatsApp). No two-way bot.
 */
export async function GET(request: Request) {
  // Verify cron secret
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase  = createAdminClient();
  const now       = new Date();
  const todayStr  = now.toISOString().split('T')[0];
  const in30Days  = new Date(now.getTime() + 30 * 86_400_000).toISOString().split('T')[0];

  const sent:   { id: string; email: boolean; wa: boolean }[] = [];
  const errors: { id: string; error: string }[] = [];

  // ── Fetch pending deadlines due within 30 days ────────────
  const { data: deadlines, error: fetchErr } = await supabase
    .from('deadlines')
    .select(`
      id, title, due_date, type, reminder_days, case_id, assigned_to,
      cases!inner(title, client_id,
        users!inner(
          id, email, phone, locale,
          notification_email, notification_whatsapp,
          quiet_hours_start, quiet_hours_end
        )
      )
    `)
    .eq('status', 'pending')
    .gte('due_date', todayStr)
    .lte('due_date', in30Days);

  if (fetchErr) {
    console.error('[reminder-cron] fetch error:', fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  for (const dl of deadlines ?? []) {
    const dueDate  = new Date(dl.due_date);
    const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / 86_400_000);

    // Only fire on configured reminder day
    const reminderDays: number[] = dl.reminder_days ?? [7, 3, 1];
    if (!reminderDays.includes(daysLeft)) continue;

    // Pull nested user
  const caseRow = (dl.cases as unknown as Record<string, unknown>);
    const userRow  = (caseRow.users as Record<string, unknown>);
    const caseTitle = caseRow.title as string;

    if (!userRow) continue;

    const email     = userRow.email     as string;
    const phone     = userRow.phone     as string | null;
    const locale    = (userRow.locale   as string) ?? 'en';
    const notifEmail = userRow.notification_email    as boolean;
    const notifWA    = userRow.notification_whatsapp as boolean;
    const qStart    = (userRow.quiet_hours_start as string) ?? '22:00';
    const qEnd      = (userRow.quiet_hours_end   as string) ?? '07:00';

    // Quiet hours check (UTC)
    const [qhS] = qStart.split(':').map(Number);
    const [qhE] = qEnd.split(':').map(Number);
    const h     = now.getUTCHours();
    const quiet = qhS > qhE ? (h >= qhS || h < qhE) : (h >= qhS && h < qhE);
    if (quiet) continue;

    const result = { id: dl.id, email: false, wa: false };
    const isAr   = locale === 'ar';

    const daysLabel = daysLeft === 0
      ? (isAr ? 'اليوم' : 'today')
      : daysLeft === 1
      ? (isAr ? 'غداً' : 'tomorrow')
      : (isAr ? `بعد ${daysLeft} أيام` : `in ${daysLeft} days`);

    // ── Email via Resend ─────────────────────────────────────
    if (notifEmail && email && process.env.RESEND_API_KEY) {
      const subject = daysLeft === 0
        ? (isAr ? `اليوم: ${dl.title}` : `TODAY: ${dl.title}`)
        : daysLeft === 1
        ? (isAr ? `غداً: ${dl.title}` : `Tomorrow: ${dl.title}`)
        : (isAr ? `موعد بعد ${daysLeft} أيام: ${dl.title}` : `In ${daysLeft} days: ${dl.title}`);

      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization:  `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from:    process.env.RESEND_FROM_EMAIL ?? 'noreply@legalwakeely.com',
            to:      [email],
            subject,
            html:    buildEmail(dl.title, caseTitle, dl.type, daysLeft, daysLabel, locale),
          }),
        });
        if (res.ok) result.email = true;
        else errors.push({ id: dl.id, error: `email: ${await res.text()}` });
      } catch (e) {
        errors.push({ id: dl.id, error: `email_ex: ${String(e)}` });
      }
    }

    // ── WhatsApp + SMS fallback (urgent = today/tomorrow) ────────
    if (phone) {
      const waBody = isAr
        ? `📅 وكيلي القانونى: تذكير بموعد "${dl.title}" في قضية "${caseTitle}" — ${daysLabel}`
        : `📅 Legal Wakeely: Deadline reminder for "${dl.title}" in case "${caseTitle}" — due ${daysLabel}`;
      const smsBody = isAr
        ? `وكيلي القانونى: موعد "${dl.title.slice(0, 40)}" ${daysLabel}`
        : `Legal Wakeely: Deadline "${dl.title.slice(0, 40)}" due ${daysLabel}`;
      const isUrgent = daysLeft <= 1;
      try {
        const { sendWhatsAppWithSMSFallback, sendWhatsApp } = await import('@/lib/notify');
        if (isUrgent) {
          // Today/tomorrow — use fallback chain (WA → SMS if WA fails or disabled)
          await sendWhatsAppWithSMSFallback({
            phone,
            message:               waBody,
            smsMessage:            smsBody,
            notification_whatsapp: notifWA,
          });
          result.wa = true;
        } else if (notifWA) {
          // 3d / 7d reminders — WhatsApp only, no SMS
          const waResult = await sendWhatsApp({ phone, message: waBody });
          result.wa = waResult.ok;
        }
      } catch (e) {
        errors.push({ id: dl.id, error: `wa_sms_ex: ${String(e)}` });
      }
    }

    // ── Log timeline event ────────────────────────────────────
    if (result.email || result.wa) {
      await supabase.from('timeline_events').insert({
        case_id:             dl.case_id,
        actor_id:            '00000000-0000-0000-0000-000000000000',
        event_type:          'deadline_reminder_sent',
        payload: {
          deadline_id:  dl.id,
          title:        dl.title,
          days_until:   daysLeft,
          email_sent:   result.email,
          wa_sent:      result.wa,
          triggered_by: 'cron',
        },
        is_system_generated: true,
      });
    }

    sent.push(result);

    // ── Assigned lawyer reminder (Wakeely Pro) ────────────────
    // Separate from the client reminder above: uses the lawyer's OWN
    // notification prefs, and is logged internal-only so it never shows
    // up in the client's activity feed.
    if (dl.assigned_to) {
      try {
        const { data: lawyer } = await supabase
          .from('users')
          .select('id, email, phone, locale, notification_email, notification_whatsapp, quiet_hours_start, quiet_hours_end')
          .eq('id', dl.assigned_to)
          .maybeSingle();

        if (lawyer) {
          const lQStart = (lawyer.quiet_hours_start as string) ?? '22:00';
          const lQEnd   = (lawyer.quiet_hours_end as string) ?? '07:00';
          const [lqhS]  = lQStart.split(':').map(Number);
          const [lqhE]  = lQEnd.split(':').map(Number);
          const lQuiet  = lqhS > lqhE ? (h >= lqhS || h < lqhE) : (h >= lqhS && h < lqhE);

          if (!lQuiet) {
            const lIsAr = (lawyer.locale ?? 'en') === 'ar';
            let lawyerEmailSent = false;
            let lawyerWaSent    = false;

            if (lawyer.notification_email && lawyer.email && process.env.RESEND_API_KEY) {
              const { sendEmail } = await import('@/lib/notify');
              const subject = lIsAr
                ? `مهمتك: ${dl.title} — ${daysLabel}`
                : `Your task: ${dl.title} — due ${daysLabel}`;
              await sendEmail({
                to:      lawyer.email,
                subject,
                html:    buildLawyerEmail(dl.title, caseTitle, dl.type, daysLeft, daysLabel, lIsAr ? 'ar' : 'en'),
              });
              lawyerEmailSent = true;
            }

            if (lawyer.phone && daysLeft <= 1) {
              const { sendWhatsAppWithSMSFallback } = await import('@/lib/notify');
              const waBody = lIsAr
                ? `📌 وكيلي برو: مهمتك "${dl.title}" في قضية "${caseTitle}" — ${daysLabel}`
                : `📌 Wakeely Pro: Your task "${dl.title}" on case "${caseTitle}" — due ${daysLabel}`;
              await sendWhatsAppWithSMSFallback({
                phone:                 lawyer.phone,
                message:               waBody,
                smsMessage:            waBody.slice(0, 140),
                notification_whatsapp: lawyer.notification_whatsapp,
              });
              lawyerWaSent = true;
            }

            const { createNotification } = await import('@/lib/notify');
            await createNotification({
              user_id:    lawyer.id,
              case_id:    dl.case_id,
              type:       'deadline_reminder',
              title:      lIsAr ? `مهمتك: ${dl.title}` : `Your task: ${dl.title}`,
              body:       lIsAr ? `مستحقة ${daysLabel}` : `Due ${daysLabel}`,
              action_url: `/lawyer/cases/${dl.case_id}`,
            });

            if (lawyerEmailSent || lawyerWaSent) {
              await supabase.from('timeline_events').insert({
                case_id:             dl.case_id,
                actor_id:            '00000000-0000-0000-0000-000000000000',
                event_type:          'lawyer_task_reminder_sent',
                payload: {
                  deadline_id: dl.id,
                  title:       dl.title,
                  days_until:  daysLeft,
                  lawyer_id:   dl.assigned_to,
                  email_sent:  lawyerEmailSent,
                  wa_sent:     lawyerWaSent,
                },
                is_system_generated: true,
                visibility: 'internal',
              });
            }
          }
        }
      } catch (e) {
        errors.push({ id: dl.id, error: `lawyer_reminder_ex: ${String(e)}` });
      }
    }
  }

  console.log(`[reminder-cron] Sent ${sent.length} reminder(s), ${errors.length} error(s)`);
  return NextResponse.json({
    ok:         true,
    sent_count: sent.length,
    sent,
    errors,
  });
}

// ── Lawyer task reminder email (Wakeely Pro) ─────────────────────
function buildLawyerEmail(
  title:      string,
  caseTitle:  string,
  type:       string,
  days:       number,
  daysLabel:  string,
  locale:     string
): string {
  const isAr      = locale === 'ar';
  const dir       = isAr ? 'rtl' : 'ltr';
  const urgentClr = days === 0 ? '#ef4444' : days <= 3 ? '#f97316' : '#1A3557';

  const typeLabels: Record<string, Record<string, string>> = {
    court:      { en: 'Court Hearing',        ar: 'جلسة استماع'  },
    submission: { en: 'Submission Deadline',  ar: 'موعد تقديم'    },
    internal:   { en: 'Internal Task',        ar: 'مهمة داخلية'  },
  };
  const typeText = typeLabels[type]?.[isAr ? 'ar' : 'en'] ?? type;

  const headline = isAr
    ? `مهمتك: <b>${title}</b> — ${daysLabel}`
    : `Your task: <b>${title}</b> is due ${daysLabel}`;
  const caseInfo  = isAr ? `القضية: ${caseTitle}` : `Case: ${caseTitle}`;
  const btn       = isAr ? 'فتح وكيلي برو' : 'Open Wakeely Pro';

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://legalwakeely.com';
  const font   = isAr ? "'IBM Plex Arabic', Arial" : "'Inter', Arial";

  return `<!DOCTYPE html><html dir="${dir}" lang="${locale}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:${font},sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0"
       style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.07)">
  <tr><td style="background:#1A3557;padding:18px 24px">
    <span style="color:#C89B3C;font-size:20px;font-weight:900">WAKEELY PRO</span>
  </td></tr>
  <tr><td style="padding:24px">
    <span style="background:${urgentClr};color:#fff;padding:3px 10px;border-radius:20px;
          font-size:11px;font-weight:700;display:inline-block;margin-bottom:14px">
      ${typeText}
    </span>
    <p style="font-size:15px;color:#111827;margin:0 0 8px">${headline}</p>
    <p style="font-size:13px;color:#6b7280;margin:0 0 20px">${caseInfo}</p>
    <a href="${appUrl}/${locale}/lawyer/cases"
       style="display:inline-block;background:#1A3557;color:#fff;
              padding:10px 24px;border-radius:10px;text-decoration:none;
              font-weight:600;font-size:13px">${btn}</a>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

// ── Email HTML (client-facing) ───────────────────────────────────
function buildEmail(
  title:      string,
  caseTitle:  string,
  type:       string,
  days:       number,
  daysLabel:  string,
  locale:     string
): string {
  const isAr      = locale === 'ar';
  const dir       = isAr ? 'rtl' : 'ltr';
  const urgentClr = days === 0 ? '#ef4444' : days <= 3 ? '#f97316' : '#1A3557';

  const typeLabels: Record<string, Record<string, string>> = {
    court:      { en: 'Court Hearing',        ar: 'جلسة استماع'  },
    submission: { en: 'Submission Deadline',  ar: 'موعد تقديم'    },
    internal:   { en: 'Internal Reminder',    ar: 'تذكير داخلي'  },
  };
  const typeText = typeLabels[type]?.[isAr ? 'ar' : 'en'] ?? type;

  const headline = isAr
    ? `تذكير: <b>${title}</b> — ${daysLabel}`
    : `Reminder: <b>${title}</b> is due ${daysLabel}`;
  const caseInfo  = isAr ? `القضية: ${caseTitle}` : `Case: ${caseTitle}`;
  const typeInfo  = isAr ? `النوع: ${typeText}` : `Type: ${typeText}`;
  const btn       = isAr ? 'فتح وكيلي القانونى' : 'Open Legal Wakeely';
  const disc      = isAr
    ? 'وكيلي القانونى لا تقدم استشارات قانونية. التنبيهات استرشادية فحسب.'
    : 'Legal Wakeely does not provide legal advice. Alerts are informational only.';

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://legalwakeely.com';
  const font   = isAr ? "'IBM Plex Arabic', Arial" : "'Inter', Arial";

  return `<!DOCTYPE html><html dir="${dir}" lang="${locale}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:${font},sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0"
       style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.07)">
  <tr><td style="background:#1A3557;padding:18px 24px">
    <span style="color:#C89B3C;font-size:20px;font-weight:900">LEGAL WAKEELY · وكيلي القانونى</span>
  </td></tr>
  <tr><td style="padding:24px">
    <span style="background:${urgentClr};color:#fff;padding:3px 10px;border-radius:20px;
          font-size:11px;font-weight:700;display:inline-block;margin-bottom:14px">
      ${typeText}
    </span>
    <p style="font-size:15px;color:#111827;margin:0 0 8px">${headline}</p>
    <p style="font-size:13px;color:#6b7280;margin:0 0 4px">${caseInfo}</p>
    <p style="font-size:12px;color:#9ca3af;margin:0 0 20px">${typeInfo}</p>
    <a href="${appUrl}/${locale}/deadlines"
       style="display:inline-block;background:#1A3557;color:#fff;
              padding:10px 24px;border-radius:10px;text-decoration:none;
              font-weight:600;font-size:13px">${btn}</a>
  </td></tr>
  <tr><td style="padding:12px 24px;border-top:1px solid #f0f0f0">
    <p style="font-size:10px;color:#9ca3af;margin:0">${disc}</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}
