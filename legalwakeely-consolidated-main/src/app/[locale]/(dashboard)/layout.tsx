import { redirect }        from 'next/navigation';
import { createClient }    from '@/lib/supabase/server';
import {
  Shield, LayoutDashboard, FolderOpen, Lock,
  Calendar, Bell, Settings, CreditCard, Mic, LogOut, FileText,
} from 'lucide-react';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const isRTL    = locale === 'ar';

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  // ── Parallelise DB queries ──────────────────────────────────
  const [{ count: unreadCount }, { data: profile }] = await Promise.all([
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null),
    supabase
      .from('users')
      .select('full_name, onboarding_completed, first_case_created_at')
      .eq('id', user.id)
      .maybeSingle(),
  ]);

  const initials = (profile?.full_name ?? user.email ?? '?')
    .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  const navItems = [
    { href: `/${locale}/dashboard`,    icon: LayoutDashboard, label: isRTL ? 'لوحة التحكم'    : 'Dashboard'       },
    { href: `/${locale}/cases`,         icon: FolderOpen,      label: isRTL ? 'قضاياي'          : 'My Cases'        },
    { href: `/${locale}/vault`,         icon: Lock,            label: isRTL ? 'خزنة المستندات' : 'Evidence Vault'  },
    { href: `/${locale}/deadlines`,     icon: Calendar,        label: isRTL ? 'المواعيد'        : 'Deadlines'       },
    { href: `/${locale}/alerts`,        icon: Bell,            label: isRTL ? 'التنبيهات'       : 'Alerts'          },
    { href: `/${locale}/notifications`, icon: Bell,            label: isRTL ? 'الإشعارات'       : 'Notifications', badge: unreadCount ?? 0 },
    { href: `/${locale}/invoices`,      icon: FileText,        label: isRTL ? 'الفواتير'        : 'Invoices'        },
    { href: `/${locale}/billing`,       icon: CreditCard,      label: isRTL ? 'الاشتراك'        : 'Billing'         },
    { href: `/${locale}/voice`,         icon: Mic,             label: isRTL ? 'المستشار الصوتي' : 'Voice Advisor'   },
    { href: `/${locale}/settings`,      icon: Settings,        label: isRTL ? 'الإعدادات'       : 'Settings'        },
  ];

  return (
    <div className="flex min-h-screen bg-background">

      {/* ── Desktop Sidebar ─────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 border-e border-border bg-card shrink-0 shadow-card">

        {/* Logo */}
        <div className="flex items-center gap-2 px-5 py-5 border-b border-border">
          <img src="/logo.png" alt={isRTL ? "وكيلي القانونى" : "Legal Wakeely"} className="h-14 w-auto" width={428} height={189} />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto no-scrollbar">
          {navItems.map(({ href, icon: Icon, label, badge }) => (
            <a key={href} href={href}
              className="nav-item group relative">
              <Icon className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-110" />
              <span className="flex-1">{label}</span>
              {(badge ?? 0) > 0 && (
                <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">
                  {badge}
                </span>
              )}
            </a>
          ))}
        </nav>

        {/* Bottom: user + sign out */}
        <div className="border-t border-border p-3 space-y-3">
          {/* User profile + Sign out button */}
                    <a href="/api/auth/logout" className="block">
            <div className="flex items-center gap-2.5 rounded-xl bg-muted/50 px-3 py-2.5 hover:bg-muted/80 transition-colors cursor-pointer">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#1A3557] to-[#0E7490] flex items-center justify-center shrink-0 shadow-sm">
                <span className="text-[10px] font-black text-white">{initials}</span>
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-xs font-semibold text-foreground truncate">
                  {profile?.full_name ?? user.email}
                </p>
                <p className="text-[10px] text-muted-foreground truncate" dir="ltr">{user.email}</p>
              </div>
              <LogOut className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          </a>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── Mobile header ───────────────────────────────────────── */}
        <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b border-border bg-card/95 backdrop-blur-sm shadow-sm">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt={isRTL ? "وكيلي القانونى" : "Legal Wakeely"} className="h-9 w-auto" width={428} height={189} />
          </div>
          <div className="flex items-center gap-1.5">
            {(unreadCount ?? 0) > 0 && (
              <a href={`/${locale}/notifications`} className="relative grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground">
                <Bell className="h-4 w-4" />
                <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">
                  {unreadCount}
                </span>
              </a>
            )}
            <a href="/api/auth/logout" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground">
              <LogOut className="h-4 w-4" />
            </a>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="container-page py-6 px-4 sm:px-6 lg:px-8 max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
