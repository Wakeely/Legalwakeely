import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { Shield, Building2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

function StatusCard({
  type, locale,
}: {
  type: 'not_found' | 'used' | 'expired' | 'self_invite' | 'already_in_firm';
  locale: string;
}) {
  const isRTL = locale === 'ar';
  const cfg = {
    not_found:   { icon: AlertCircle,   color: 'text-red-500',     bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      title: isRTL ? 'الدعوة غير موجودة'       : 'Invite Not Found',
      desc:  isRTL ? 'هذا الرابط غير صالح أو منتهي الصلاحية.' : 'This invite link is invalid or has expired.' },
    used:        { icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
      title: isRTL ? 'تم قبول الدعوة'          : 'Invite Already Accepted',
      desc:  isRTL ? 'هذه الدعوة قد قُبلت مسبقاً.' : 'This invite has already been accepted.' },
    expired:     { icon: Clock,         color: 'text-amber-500',   bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
      title: isRTL ? 'انتهت صلاحية الدعوة'     : 'Invite Expired',
      desc:  isRTL ? 'اطلب من صاحب المكتب إنشاء رابط جديد.' : 'Ask the firm owner to generate a new invite link.' },
    self_invite: { icon: AlertCircle,   color: 'text-orange-500',  bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
      title: isRTL ? 'لا يمكنك قبول دعوتك الخاصة' : 'Cannot Accept Own Invite',
      desc:  isRTL ? 'لا يمكن لمن أنشأ الدعوة قبولها.' : 'You cannot accept an invite you created yourself.' },
    already_in_firm: { icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
      title: isRTL ? 'أنت بالفعل عضو في مكتب' : 'Already in a Firm',
      desc:  isRTL ? 'يمكنك الانتماء إلى مكتب واحد فقط حاليًا.' : 'You can only belong to one firm at a time today.' },
  }[type];
  const Icon = cfg.icon;

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className={cn('w-full max-w-sm rounded-2xl border p-8 text-center', cfg.bg)}>
        <Icon className={cn('mx-auto h-12 w-12 mb-4', cfg.color)} />
        <h1 className="text-lg font-bold text-foreground mb-2">{cfg.title}</h1>
        <p className="text-sm text-muted-foreground mb-6">{cfg.desc}</p>
        <Link href={`/${locale}/login`}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1A3557] text-white px-6 py-2.5 text-sm font-semibold hover:bg-[#1e4a7a] transition">
          {isRTL ? 'تسجيل الدخول' : 'Go to Login'}
        </Link>
      </div>
    </main>
  );
}

export default async function FirmInvitePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { token } = await params;
  const locale    = await getLocale();
  const isRTL     = locale === 'ar';
  const supabase  = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: invite } = await supabase
    .from('firm_invites')
    .select(`
      id, status, expires_at, invitee_email, role_offered, firm_id, created_by,
      firms!inner(id, name, name_ar),
      users!firm_invites_created_by_fkey(id, full_name, email)
    `)
    .eq('token', token)
    .maybeSingle();

  if (!invite)                                      return <StatusCard type="not_found"   locale={locale} />;
  if (invite.status === 'accepted')                 return <StatusCard type="used"        locale={locale} />;
  if (invite.status === 'revoked' ||
      new Date(invite.expires_at) < new Date())     return <StatusCard type="expired"     locale={locale} />;
  if (user && invite.created_by === user.id)        return <StatusCard type="self_invite" locale={locale} />;

  const firm    = invite.firms as unknown as { id: string; name: string; name_ar: string | null };
  const inviter = invite.users as unknown as { id: string; full_name: string; email: string };

  if (!user) {
    const returnUrl = encodeURIComponent(`/${locale}/invite/firm/${token}`);
    redirect(`/${locale}/register?role=lawyer&returnUrl=${returnUrl}`);
  }

  // Already belongs to a firm? (today a lawyer can only be in one)
  const { data: existingMembership } = await supabase
    .from('firm_members')
    .select('firm_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingMembership) {
    if (existingMembership.firm_id === invite.firm_id) {
      redirect(`/${locale}/lawyer/firm`);
    }
    return <StatusCard type="already_in_firm" locale={locale} />;
  }

  const accept = async () => {
    'use server';
    const sb = await createClient();
    const { data: { user: u } } = await sb.auth.getUser();
    if (!u) return;

    const { data: profile } = await sb
      .from('users')
      .select('role')
      .eq('id', u.id)
      .maybeSingle();

    if (profile?.role === 'client') {
      await sb.from('users').update({ role: 'lawyer' }).eq('id', u.id);
    }

    const { data: inv } = await sb
      .from('firm_invites')
      .select('id, firm_id, role_offered')
      .eq('token', token)
      .maybeSingle();
    if (!inv) return;

    await sb.from('firm_members').insert({
      firm_id: inv.firm_id,
      user_id: u.id,
      role:    inv.role_offered,
    });

    await sb.from('firm_invites').update({
      status:      'accepted',
      accepted_by: u.id,
      accepted_at: new Date().toISOString(),
    }).eq('id', inv.id);

    redirect(`/${locale}/lawyer/firm`);
  };

  const roleLabel = isRTL
    ? { lawyer: 'محامٍ', staff: 'مساعد قانوني' }[invite.role_offered]
    : { lawyer: 'Lawyer', staff: 'Staff' }[invite.role_offered];

  const daysLeft = Math.max(0, Math.ceil((new Date(invite.expires_at).getTime() - Date.now()) / 86_400_000));

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-lg space-y-4 animate-fade-in">

        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1A3557] shadow-brand">
              <Shield className="h-6 w-6 text-[#C89B3C]" />
            </div>
            <div>
              <p className="text-xl font-black text-[#1A3557] dark:text-foreground">
                {isRTL ? 'وكيلي برو' : 'WAKEELY PRO'}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                {isRTL ? 'دعوة إلى مكتب' : 'Firm Invite'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-float overflow-hidden">

          <div className="bg-gradient-to-r from-[#1A3557] to-[#0E7490] px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 shrink-0">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white">
                  {isRTL ? 'دعوة للانضمام إلى مكتب' : 'Join a Firm'}
                </h1>
                <p className="text-xs text-white/70 mt-0.5">
                  {isRTL
                    ? `من ${inviter.full_name} · ${inviter.email}`
                    : `From ${inviter.full_name} · ${inviter.email}`}
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            <div className="rounded-xl bg-muted/40 border border-border p-4 space-y-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {isRTL ? 'تفاصيل المكتب' : 'Firm Details'}
              </p>
              <p className="text-base font-bold text-foreground leading-snug">
                {(isRTL && firm.name_ar) || firm.name}
              </p>
              <span className="badge badge-navy inline-block">{roleLabel}</span>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                {isRTL ? 'بانضمامك إلى المكتب:' : 'By joining this firm:'}
              </p>
              {[
                { icon: '🏛️', en: 'Appear as a member of this firm on Wakeely Pro', ar: 'تظهر كعضو في هذا المكتب على وكيلي برو' },
                { icon: '📁', en: "You'll still need to be invited to each individual case, as before", ar: 'ستظل بحاجة لدعوة منفصلة لكل قضية، كما هو الحال حاليًا' },
              ].map((item) => (
                <div key={item.en} className="flex items-center gap-2.5 text-sm text-foreground">
                  <span>{item.icon}</span>
                  <span>{isRTL ? item.ar : item.en}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 px-4 py-2.5">
              <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {isRTL ? `ينتهي خلال ${daysLeft} يوم` : `Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
              </p>
            </div>

            <form action={accept}>
              <button type="submit" className="w-full btn-primary py-3.5 text-base">
                <Building2 className="h-5 w-5" />
                {isRTL ? 'قبول الدعوة والانضمام' : 'Accept Invite & Join Firm'}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {isRTL ? 'وكيلي القانونى لا تقدم استشارات قانونية.' : 'Legal Wakeely does not provide legal advice.'}
        </p>
      </div>
    </main>
  );
}
