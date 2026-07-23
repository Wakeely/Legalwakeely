'use client';

import { useState } from 'react';
import { Users, Lock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentVisibilityToggleProps {
  caseId: string;
  documentId: string;
  initialVisible: boolean;
  locale: string;
}

export function DocumentVisibilityToggle({ caseId, documentId, initialVisible, locale }: DocumentVisibilityToggleProps) {
  const isRTL = locale === 'ar';
  const [visible, setVisible] = useState(initialVisible);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    const next = !visible;
    setLoading(true);
    setVisible(next); // optimistic
    try {
      const res = await fetch(`/api/cases/${caseId}/documents/${documentId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ is_client_visible: next }),
      });
      if (!res.ok) setVisible(!next); // revert on failure
    } catch {
      setVisible(!next);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={isRTL
        ? (visible ? 'مرئي للعميل — اضغط لإخفائه' : 'داخلي فقط — اضغط لإظهاره للعميل')
        : (visible ? 'Client-visible — click to hide' : 'Internal only — click to share with client')}
      className={cn(
        'flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition',
        visible
          ? 'bg-[#0E7490]/10 text-[#0E7490] hover:bg-[#0E7490]/20'
          : 'bg-muted text-muted-foreground hover:bg-accent'
      )}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : visible ? (
        <Users className="h-3 w-3" />
      ) : (
        <Lock className="h-3 w-3" />
      )}
      {visible ? (isRTL ? 'مرئي للعميل' : 'Client-visible') : (isRTL ? 'داخلي' : 'Internal')}
    </button>
  );
}
