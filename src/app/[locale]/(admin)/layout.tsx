import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requireAdmin } from '@/lib/admin-guard';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  Shield, LayoutDashboard, Users, FileText,
  AlertTriangle, Settings, Activity, LogOut, CreditCard, TrendingUp, Send, BarChart3,
} from 'lucide-react';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  await requireAdmin(locale); // redirects if not admin

  // Locale-FREE paths — next-intl Link will prefix /ar or /en once
  const navItems = [
    { href: '/admin',             icon: LayoutDashboard, label: 'Overview'       },
    { href: '/admin/analytics',   icon: BarChart3,       label: 'Analytics'      },
    { href: '/admin/users',       icon: Users,           label: 'Users'          },
    { href: '/admin/subscriptions', icon: TrendingUp,    label: 'Subscriptions'  },
    { href: '/admin/payments',    icon: CreditCard,      label: 'Payments'       },
    { href: '/admin/broadcast',   icon: Send,            label: 'Broadcast'      },
    { href: '/admin/cases',       icon: FileText,        label: 'Cases'          },
    { href: '/admin/cliq',        icon: CreditCard,      label: 'CliQ Verify'    },
    { href: '/admin/audit',       icon: Activity,        label: 'Audit Log'      },
    { href: '/admin/system',      icon: Settings,        label: 'System'         },
  ] as const;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Admin sidebar — distinct teal color to visually separate from client UI */}
      <aside className="hidden lg:flex flex-col w-56 bg-[#0E7490] shrink-0">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/10">
          <div className="rounded-lg bg-white/95 px-2 py-1">
            <img src="/logo.png" alt="Legal Wakeely" className="h-12 w-auto" width={428} height={189} />
          </div>
          <span className="text-[10px] text-white/60 font-medium uppercase tracking-widest">Admin</span>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {navItems.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors">
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-2 py-4 border-t border-white/10 space-y-1">
          <ThemeToggle />
          <Link href="/dashboard"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors">
            <LogOut className="h-4 w-4" />
            Back to App
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Admin top bar */}
        <header className="flex items-center justify-between px-6 py-3 bg-[#0E7490] lg:bg-transparent border-b border-[#0E7490]/20">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="rounded-lg bg-white/95 px-2 py-0.5">
              <img src="/logo.png" alt="Legal Wakeely" className="h-14 w-auto" width={428} height={189} />
            </div>
            <span className="text-sm font-black text-white">Admin</span>
          </div>
          <div className="hidden lg:flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              Founder-only area. All actions are logged.
            </p>
          </div>
          <div className="lg:hidden"><ThemeToggle /></div>
        </header>

        <main className="flex-1 p-5 lg:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
