'use client';

import { useState } from 'react';
import {
  Loader2, ChevronRight, ChevronLeft, Search,
  Ban, CheckCircle2, Trash2, Shield, Sparkles,
  ChevronDown, ChevronUp, AlertTriangle, Crown
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  subscription_tier: string;
  created_at: string;
  last_seen_at?: string;
  locale: string;
  data_region: string;
  is_suspended?: boolean;
  suspended_at?: string;
  suspend_reason?: string;
}

interface AdminUsersTableProps {
  users: User[];
  total: number;
  page: number;
  limit: number;
  q: string;
  role: string;
  locale: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin:  'bg-red-100    text-red-700    dark:bg-red-900/30',
  lawyer: 'bg-[#0E7490]/10 text-[#0E7490]',
  client: 'bg-muted      text-muted-foreground',
};
const TIER_COLORS: Record<string, string> = {
  premium: 'bg-amber-100 text-[#C89B3C]',
  pro:     'bg-blue-100  text-[#1A3557]',
  basic:   'bg-muted     text-muted-foreground',
};

export function AdminUsersTable({ users, total, page, limit, q, role, locale }: AdminUsersTableProps) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [localUsers, setLocalUsers] = useState<User[]>(users);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const totalPages = Math.ceil(total / limit);

  async function patchUser(id: string, changes: Record<string, unknown>, displayName?: string) {
    setUpdating(id);
    setFeedback({});
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: id, ...changes }),
      });
      const j = await res.json();
      if (res.ok) {
        // Update local state
        setLocalUsers((prev) => prev.map((u) => {
          if (u.id !== id) return u;
          return {
            ...u,
            role: (changes.role as string) ?? u.role,
            subscription_tier: (changes.subscription_tier as string) ?? (changes.force_tier as string) ?? u.subscription_tier,
            is_suspended: changes.is_suspended !== undefined ? (changes.is_suspended as boolean) : u.is_suspended,
            suspend_reason: changes.is_suspended ? (changes.suspend_reason as string) : undefined,
          };
        }));
        setFeedback({ [id]: `✓ ${displayName ?? 'Updated'}` });
        setTimeout(() => setFeedback({}), 3000);
      } else {
        setFeedback({ [id]: `✗ ${j.error ?? 'Failed'}` });
      }
    } catch (e) {
      setFeedback({ [id]: `✗ Network error` });
    } finally {
      setUpdating(null);
    }
  }

  async function deleteUser(id: string) {
    setUpdating(id);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: id, confirm: true }),
      });
      const j = await res.json();
      if (res.ok) {
        setLocalUsers((prev) => prev.filter((u) => u.id !== id));
        setConfirmDelete(null);
        setFeedback({ [id]: '✓ Deleted' });
      } else {
        setFeedback({ [id]: `✗ ${j.error ?? 'Failed'}` });
      }
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Search + filter */}
      <form className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input name="q" defaultValue={q} placeholder="Search email or name…"
            className="w-full rounded-xl border border-border bg-background ps-9 pe-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E7490]/30" />
        </div>
        <select name="role" defaultValue={role}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none">
          <option value="">All roles</option>
          <option value="client">Client</option>
          <option value="lawyer">Lawyer</option>
          <option value="admin">Admin</option>
        </select>
        <select name="suspended" defaultValue=""
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none">
          <option value="">All users</option>
          <option value="true">Suspended only</option>
        </select>
        <button type="submit" className="rounded-xl bg-[#0E7490] text-white px-4 py-2 text-sm font-semibold hover:bg-[#0c6578] transition">
          Search
        </button>
      </form>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {['User', 'Role', 'Tier', 'Status', 'Last seen', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {localUsers.map((u) => (
                <>
                  <tr key={u.id} className={cn('hover:bg-muted/30 transition', u.is_suspended && 'bg-red-50/50')}>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpanded(expanded === u.id ? null : u.id)}
                        className="flex items-center gap-1 text-left"
                      >
                        {expanded === u.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        <div>
                          <p className="font-semibold text-foreground truncate max-w-[180px]">{u.full_name || '—'}</p>
                          <p className="text-muted-foreground font-mono" dir="ltr">{u.email}</p>
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', ROLE_COLORS[u.role] ?? ROLE_COLORS.client)}>
                        {u.role === 'admin' && <Crown className="inline h-2.5 w-2.5 mr-0.5" />}
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', TIER_COLORS[u.subscription_tier] ?? TIER_COLORS.basic)}>
                        {u.subscription_tier}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.is_suspended ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                          <Ban className="h-2.5 w-2.5" /> Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground" dir="ltr">
                      {u.last_seen_at
                        ? new Date(u.last_seen_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })
                        : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {updating === u.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <button
                              onClick={() => setExpanded(expanded === u.id ? null : u.id)}
                              className="rounded-lg border border-border px-2 py-1 text-[10px] font-semibold hover:bg-muted"
                              title="Expand controls"
                            >
                              Manage
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded === u.id && (
                    <tr key={`${u.id}-detail`} className="bg-muted/20">
                      <td colSpan={6} className="px-6 py-4">
                        <UserDetailControls
                          user={u}
                          onPatch={patchUser}
                          onDelete={deleteUser}
                          updating={updating === u.id}
                          confirmDelete={confirmDelete === u.id}
                          setConfirmDelete={(v) => setConfirmDelete(v ? u.id : null)}
                          suspendReason={suspendReason[u.id] ?? ''}
                          setSuspendReason={(v) => setSuspendReason((s) => ({ ...s, [u.id]: v }))}
                          feedback={feedback[u.id]}
                        />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {localUsers.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No users found.</p>
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-center">
          {page > 1 && (
            <a href={`?page=${page - 1}&q=${q}&role=${role}`}
              className="rounded-lg border border-border p-1.5 hover:bg-muted transition">
              <ChevronLeft className="h-3.5 w-3.5" />
            </a>
          )}
          <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <a href={`?page=${page + 1}&q=${q}&role=${role}`}
              className="rounded-lg border border-border p-1.5 hover:bg-muted transition">
              <ChevronRight className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Expanded detail controls for a single user ──────────────────
function UserDetailControls({
  user,
  onPatch,
  onDelete,
  updating,
  confirmDelete,
  setConfirmDelete,
  suspendReason,
  setSuspendReason,
  feedback,
}: {
  user: User;
  onPatch: (id: string, changes: Record<string, unknown>, displayName?: string) => void;
  onDelete: (id: string) => void;
  updating: boolean;
  confirmDelete: boolean;
  setConfirmDelete: (v: boolean) => void;
  suspendReason: string;
  setSuspendReason: (v: string) => void;
  feedback?: string;
}) {
  return (
    <div className="space-y-4">
      {feedback && (
        <div className={cn(
          'rounded-lg px-3 py-2 text-xs font-semibold',
          feedback.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        )}>
          {feedback}
        </div>
      )}

      {/* User info */}
      <div className="grid gap-3 sm:grid-cols-3 text-xs">
        <div>
          <p className="text-muted-foreground">User ID</p>
          <p className="font-mono text-foreground" dir="ltr">{user.id}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Joined</p>
          <p className="text-foreground" dir="ltr">{new Date(user.created_at).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Region / Locale</p>
          <p className="text-foreground uppercase">{user.data_region} / {user.locale}</p>
        </div>
      </div>

      {user.is_suspended && user.suspend_reason && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <strong>Suspended reason:</strong> {user.suspend_reason}
        </div>
      )}

      {/* Role + Tier controls */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Role</label>
          <select
            value={user.role}
            onChange={(e) => onPatch(user.id, { role: e.target.value }, `Role → ${e.target.value}`)}
            disabled={updating}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none"
          >
            <option value="client">Client</option>
            <option value="lawyer">Lawyer</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Base tier</label>
          <select
            value={user.subscription_tier}
            onChange={(e) => onPatch(user.id, { subscription_tier: e.target.value }, `Tier → ${e.target.value}`)}
            disabled={updating}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none"
          >
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
            <option value="premium">Premium</option>
          </select>
        </div>
      </div>

      {/* Force subscription overrides */}
      <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
        <p className="mb-2 text-xs font-bold text-amber-800">
          <Crown className="mr-1 inline h-3 w-3" />
          Super admin — force subscription (no payment required)
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onPatch(user.id, { force_tier: 'pro', force_period_end: new Date(Date.now() + 30 * 86400000).toISOString() }, 'Granted Pro for 30 days')}
            disabled={updating}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Grant Pro (30d)
          </button>
          <button
            onClick={() => onPatch(user.id, { force_tier: 'premium', force_period_end: new Date(Date.now() + 30 * 86400000).toISOString() }, 'Granted Premium for 30 days')}
            disabled={updating}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            Grant Premium (30d)
          </button>
          <button
            onClick={() => onPatch(user.id, { force_legal_ai: true, force_period_end: new Date(Date.now() + 30 * 86400000).toISOString() }, 'Enabled Legal-AI for 30 days')}
            disabled={updating}
            className="rounded-lg bg-teal-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            <Sparkles className="mr-0.5 inline h-2.5 w-2.5" />
            Enable Legal-AI (30d)
          </button>
          <button
            onClick={() => onPatch(user.id, { force_legal_ai: false }, 'Disabled Legal-AI')}
            disabled={updating}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-[10px] font-bold text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            Disable Legal-AI
          </button>
          <button
            onClick={() => onPatch(user.id, { force_tier: 'basic', force_legal_ai: false }, 'Reset to Basic')}
            disabled={updating}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-[10px] font-bold text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            Reset to Basic
          </button>
        </div>
      </div>

      {/* Suspend controls */}
      <div className="rounded-lg border border-border p-3">
        <p className="mb-2 text-xs font-bold text-foreground">
          <Shield className="mr-1 inline h-3 w-3" />
          Account status
        </p>
        {!user.is_suspended ? (
          <div className="space-y-2">
            <input
              type="text"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Reason for suspension (required)…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none"
            />
            <button
              onClick={() => suspendReason.trim() && onPatch(user.id, { is_suspended: true, suspend_reason: suspendReason.trim() }, 'User suspended')}
              disabled={updating || !suspendReason.trim()}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Ban className="mr-0.5 inline h-2.5 w-2.5" />
              Suspend user
            </button>
          </div>
        ) : (
          <button
            onClick={() => onPatch(user.id, { is_suspended: false }, 'User reinstated')}
            disabled={updating}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <CheckCircle2 className="mr-0.5 inline h-2.5 w-2.5" />
            Reinstate user
          </button>
        )}
      </div>

      {/* Delete (danger zone) */}
      <div className="rounded-lg border border-red-200 bg-red-50/30 p-3">
        <p className="mb-2 text-xs font-bold text-red-700">
          <AlertTriangle className="mr-1 inline h-3 w-3" />
          Danger zone — permanent deletion
        </p>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={updating}
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-[10px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="mr-0.5 inline h-2.5 w-2.5" />
            Delete account permanently
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-red-700">
              This will permanently delete <strong>{user.email}</strong> and all their data (cases, documents, analyses, etc.). This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => onDelete(user.id)}
                disabled={updating}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes, delete forever'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-border bg-white px-3 py-1.5 text-[10px] font-bold text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
