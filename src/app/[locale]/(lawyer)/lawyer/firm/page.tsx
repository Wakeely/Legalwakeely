'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Building2, Loader2, Check, Users, Send, Copy, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FirmMember {
  user_id: string;
  role: string;
  users: { id: string; full_name: string; email: string } | null;
}

interface Firm {
  id: string;
  name: string;
  name_ar: string | null;
  plan: string;
  created_at: string;
}

interface FirmInvite {
  id: string;
  invitee_email: string;
  role_offered: string;
  status: string;
  expires_at: string;
  token: string;
}

export default function FirmPage() {
  const { locale } = useParams<{ locale: string }>();
  const isRTL = locale === 'ar';

  const [loading, setLoading]   = useState(true);
  const [firm, setFirm]         = useState<Firm | null>(null);
  const [role, setRole]         = useState<string | null>(null);
  const [members, setMembers]   = useState<FirmMember[]>([]);
  const [invites, setInvites]   = useState<FirmInvite[]>([]);

  const [name, setName]         = useState('');
  const [nameAr, setNameAr]     = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated]   = useState(false);
  const [error, setError]       = useState('');

  const [inviteEmail, setInviteEmail]     = useState('');
  const [inviteRole, setInviteRole]       = useState<'lawyer' | 'staff'>('lawyer');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteError, setInviteError]     = useState('');
  const [copiedId, setCopiedId]           = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/firms');
      const data = await res.json();
      setFirm(data.firm ?? null);
      setRole(data.role ?? null);
      setMembers(data.members ?? []);

      if (data.role === 'owner') {
        const invRes = await fetch('/api/firms/invites');
        if (invRes.ok) {
          const invData = await invRes.json();
          setInvites(invData.invites ?? []);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sendInvite = async () => {
    if (!inviteEmail.trim()) { setInviteError(isRTL ? 'البريد الإلكتروني مطلوب' : 'Email is required'); return; }
    setSendingInvite(true);
    setInviteError('');
    try {
      const res = await fetch('/api/firms/invites', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ invitee_email: inviteEmail.trim(), role_offered: inviteRole }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setInviteEmail('');
      load();
    } catch (e) {
      setInviteError(String(e));
    } finally {
      setSendingInvite(false);
    }
  };

  const revokeInvite = async (inviteId: string) => {
    await fetch(`/api/firms/invites/${inviteId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({}),
    });
    load();
  };

  const copyLink = (invite: FirmInvite) => {
    const url = `${window.location.origin}/${locale}/invite/firm/${invite.token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const submit = async () => {
    if (!name.trim()) { setError(isRTL ? 'اسم المكتب مطلوب' : 'A firm name is required'); return; }
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/firms', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), name_ar: nameAr.trim() || undefined }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setCreated(true);
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  };

  const PLAN_LABEL: Record<string, { en: string; ar: string }> = {
    trial:      { en: 'Trial',      ar: 'تجريبي' },
    solo:       { en: 'Solo',       ar: 'فردي' },
    firm:       { en: 'Firm',       ar: 'مكتب' },
    enterprise: { en: 'Enterprise', ar: 'مؤسسي' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!firm) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground mb-1">
            {isRTL ? 'أنشئ مكتبك' : 'Set up your firm'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isRTL
              ? 'أنشئ مكتبًا لدعوة محامين آخرين والعمل معًا على القضايا.'
              : 'Create a firm to invite other lawyers and work on cases together.'}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {isRTL ? 'اسم المكتب' : 'Firm name'}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3557]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {isRTL ? 'اسم المكتب (بالعربية)' : 'Firm name (Arabic)'}
            </label>
            <input
              type="text"
              dir="rtl"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3557]/30"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2">{error}</p>
          )}

          <button
            onClick={submit}
            disabled={creating || !name.trim()}
            className={cn(
              'w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition',
              created ? 'bg-emerald-500 text-white' : 'bg-[#1A3557] text-white hover:bg-[#1e4a7a] disabled:opacity-50'
            )}
          >
            {creating ? (
              <><Loader2 className="h-4 w-4 animate-spin" />{isRTL ? 'جارٍ الإنشاء…' : 'Creating…'}</>
            ) : (
              <><Building2 className="h-4 w-4" />{isRTL ? 'إنشاء المكتب' : 'Create firm'}</>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="rounded-full bg-[#0E7490]/10 px-2.5 py-0.5 text-xs font-semibold text-[#0E7490]">
            {PLAN_LABEL[firm.plan]?.[isRTL ? 'ar' : 'en'] ?? firm.plan}
          </span>
        </div>
        <h1 className="text-xl font-bold text-foreground">
          {(isRTL && firm.name_ar) || firm.name}
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          {isRTL ? 'دورك' : 'Your role'}: {role}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <Users className="h-3.5 w-3.5" />{isRTL ? 'أعضاء المكتب' : 'Firm members'}
          <span className="ms-auto rounded-full bg-muted px-2 py-0.5 text-[10px]">{members.length}</span>
        </h3>
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-2 rounded-xl border border-border p-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{m.users?.full_name ?? m.user_id}</p>
                <p className="text-[10px] text-muted-foreground" dir="ltr">{m.users?.email}</p>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {m.role}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {role === 'owner' && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <Send className="h-3.5 w-3.5" />{isRTL ? 'دعوة عضو جديد' : 'Invite a member'}
          </h3>

          <div className="flex flex-col sm:flex-row gap-2 mb-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder={isRTL ? 'البريد الإلكتروني' : 'Email address'}
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3557]/30"
              dir="ltr"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'lawyer' | 'staff')}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3557]/30"
            >
              <option value="lawyer">{isRTL ? 'محامٍ' : 'Lawyer'}</option>
              <option value="staff">{isRTL ? 'مساعد قانوني' : 'Staff'}</option>
            </select>
            <button
              onClick={sendInvite}
              disabled={sendingInvite || !inviteEmail.trim()}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#1A3557] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#1e4a7a] disabled:opacity-50 whitespace-nowrap"
            >
              {sendingInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isRTL ? 'إرسال' : 'Send'}
            </button>
          </div>

          {inviteError && (
            <p className="text-xs text-red-600 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 mb-2">{inviteError}</p>
          )}

          {invites.length > 0 && (
            <ul className="space-y-2 mt-3 border-t border-border pt-3">
              {invites.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-2 rounded-xl border border-border p-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate" dir="ltr">{inv.invitee_email}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {inv.role_offered} · {inv.status}
                    </p>
                  </div>
                  {inv.status === 'pending' && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => copyLink(inv)}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-[#1A3557] hover:bg-accent"
                      >
                        {copiedId === inv.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        {copiedId === inv.id ? (isRTL ? 'تم النسخ' : 'Copied') : (isRTL ? 'نسخ الرابط' : 'Copy link')}
                      </button>
                      <button
                        onClick={() => revokeInvite(inv.id)}
                        className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-red-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
