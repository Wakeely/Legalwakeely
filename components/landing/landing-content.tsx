'use client';

import { useEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import {
  Shield, ChevronRight, ChevronLeft, Lock, Bell,
  AlertTriangle, Calendar, FileText, MessageCircle,
  CheckCircle2, Star, ArrowRight, ArrowLeft,
  UserPlus, Radar, ShieldCheck, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── bilingual content (all original copy preserved verbatim) ──── */
const CONTENT = {
  en: {
    nav:        { login: 'Sign In', register: 'Start Free' },
    hero: {
      badge:    'Legal Clarity. Finally.',
      h1a:      'Know Exactly',
      h1b:      "What's Happening",
      h1c:      'in Your Legal Case',
      sub:      'Track every step, deadline, and action. No more missed updates. No more uncertainty.',
      cta1:     'Start Your Case — Free',
      cta2:     'Sign In',
      trust:    'Trusted by 2,400+ clients across UAE, KSA & Kuwait',
    },
    problems: [
      { icon: '⏰', t: 'Missed Deadlines',   d: 'Critical dates pass with no one reminding you — or your lawyer.' },
      { icon: '📵', t: 'No Updates',          d: 'Days pass with zero communication. You have no idea what\'s happening.' },
      { icon: '📁', t: 'Lost Documents',      d: 'Papers scattered across email, WhatsApp, and physical folders.' },
      { icon: '❓', t: 'No Accountability',   d: 'When things go wrong, nobody is responsible and nothing is recorded.' },
    ],
    problemHeader: { badge: 'Sound familiar?', h2: 'Legal cases are often chaotic and unclear' },
    solutionHeader: { badge: 'The Legal Wakeely way', h2: 'Clarity and control in every step' },
    solutions: [
      { icon: '⚡', t: 'Real-time Timeline',  d: 'Every action logged the moment it happens.' },
      { icon: '🎯', t: 'Deadline Tracking',   d: 'Automated reminders so nothing ever slips.' },
      { icon: '🔒', t: 'Full Transparency',   d: 'Complete audit trail of your entire case.' },
    ],
    howItWorksHeader: { badge: 'Getting started', h2: 'From confusion to clarity in three steps' },
    howItWorks: [
      { n: '01', t: 'Add your case',        d: 'Tell us the basics in under two minutes. No paperwork, no waiting on hold.' },
      { n: '02', t: 'We watch everything',  d: 'Every filing, hearing, and message is tracked automatically from day one.' },
      { n: '03', t: 'You stay in control',  d: 'Real-time alerts and a live health score mean you\'re never the last to know.' },
    ],
    featuresHeader: { badge: 'Everything you need', h2: 'Built for people who deserve to know the truth' },
    features: [
      { icon: '📋', t: 'Case Timeline',        d: 'See every action, filing, and hearing clearly. Nothing hidden.',   tag: 'Real-time'           },
      { icon: '📅', t: 'Deadline Tracker',     d: 'Court dates and submissions — all in one place with smart alerts.', tag: 'Never miss a date'    },
      { icon: '🗂️', t: 'Document Vault',       d: 'Store and instantly access all your legal documents. SHA-256 secure.', tag: 'Bank-grade security' },
      { icon: '💬', t: 'Accountable Chat',     d: 'Every message between you and your lawyer is logged permanently.', tag: 'Full audit trail'     },
      { icon: '⚖️', t: 'NDE Alerts',           d: 'AI detects silence and inaction and alerts you before it costs you.', tag: 'AI-powered'          },
      { icon: '📊', t: 'Case Health Score',    d: 'A live score shows exactly how your case is progressing.',          tag: 'Instant overview'    },
    ],
    trust: {
      badge: 'Zero hidden actions',
      h2a:  'No more hidden actions.',
      h2b:  'Everything is logged.',
      sub:  "Legal Wakeely creates an immutable record of every step. If something was promised, it\'s recorded. If a deadline was missed, it\'s flagged.",
      stats: [
        { v: '100%', l: 'Actions logged'  },
        { v: '0',    l: 'Hidden steps'    },
        { v: '24/7', l: 'Case monitoring' },
        { v: '256-bit', l: 'Encryption'  },
      ],
    },
    testimonials: [
      { q: 'I finally understood what was happening in my labor dispute. Every step was visible.', n: 'Ahmed Al-Rashidi', r: 'Labor dispute, UAE',        stars: 5 },
      { q: 'After 3 years of confusion, Legal Wakeely gave me the full picture in 10 minutes.',          n: 'Sarah Mohammed',   r: 'Family case, KSA',          stars: 5 },
      { q: 'The deadline alerts alone saved my case. I would have missed a critical submission.',   n: 'Khaled Ibrahim',   r: 'Commercial dispute, Kuwait', stars: 5 },
    ],
    whatsapp: {
      h2:  'Need help? Talk to us directly',
      sub: 'Our team replies within 5 minutes on WhatsApp.',
      btn: 'Chat on WhatsApp',
    },
    pricing: {
      badge: 'Simple pricing',
      h2:   'Start free. Upgrade when you need more.',
      sub:  'No credit card required. No hidden fees.',
    },
    faqHeader: { badge: 'Questions', h2: 'Everything you were about to ask' },
    faq: [
      { q: 'Do I need a lawyer to use Legal Wakeely?', a: 'No. You can track any legal matter on your own, or invite the lawyer you already work with to collaborate on the same timeline.' },
      { q: 'Is my data actually secure?',               a: 'Yes. Every document and message is protected with 256-bit encryption and written to an immutable audit trail nobody can quietly edit.' },
      { q: 'Which countries do you support?',           a: 'Legal Wakeely currently supports clients across the UAE, Saudi Arabia, Kuwait, and Jordan, with more markets on the way.' },
      { q: 'Can I cancel anytime?',                      a: 'Yes. Every plan is month-to-month — no long-term contract, no cancellation fee.' },
    ],
    finalCta: {
      h2:   'Take control of your legal case today',
      sub:  'Join thousands of clients across the GCC who finally know exactly what is happening.',
      btn:  'Get Started — Free',
      note: 'No credit card required. Set up in 2 minutes.',
    },
    footer: { copy: '© 2026 Legal Wakeely. All rights reserved.' },
  },
  ar: {
    nav:       { login: 'تسجيل الدخول', register: 'ابدأ مجاناً' },
    hero: {
      badge:   'وضوح قانوني. أخيراً.',
      h1a:     'اعرف بالضبط',
      h1b:     'ماذا يحدث',
      h1c:     'في قضيتك القانونية',
      sub:     'تابع كل خطوة، كل موعد، وكل إجراء. لا مزيد من الغموض أو التأخير.',
      cta1:    'ابدأ قضيتي — مجاناً',
      cta2:    'تسجيل الدخول',
      trust:   'يثق بنا أكثر من 2,400 عميل في الإمارات والسعودية والكويت',
    },
    problems: [
      { icon: '⏰', t: 'مواعيد ضائعة',     d: 'تمر مواعيد حرجة دون تذكير — لا منك ولا من محاميك.' },
      { icon: '📵', t: 'غياب التواصل',     d: 'تمر أيام دون أي تواصل. لا تعلم إن كان أي شيء يحدث.' },
      { icon: '📁', t: 'مستندات مفقودة',   d: 'الوثائق المهمة مبعثرة في البريد وواتساب والمجلدات.' },
      { icon: '❓', t: 'لا مساءلة',         d: 'حين يسوء الأمر، لا أحد مسؤول ولا سجل لما وُعد به.' },
    ],
    problemHeader:  { badge: 'هل يبدو مألوفاً؟', h2: 'القضايا القانونية غالباً غير واضحة ومليئة بالفوضى' },
    solutionHeader: { badge: 'طريقة وكيلي القانونى',        h2: 'وضوح وتحكم في كل خطوة' },
    solutions: [
      { icon: '⚡', t: 'متابعة فورية',       d: 'كل إجراء يُسجَّل في اللحظة التي يحدث فيها.' },
      { icon: '🎯', t: 'تنبيهات للمواعيد',  d: 'تذكيرات تلقائية حتى لا يفوتك شيء أبداً.' },
      { icon: '🔒', t: 'شفافية كاملة',       d: 'سجل تدقيق كامل لكل تفاصيل قضيتك.' },
    ],
    howItWorksHeader: { badge: 'كيف تبدأ', h2: 'من الغموض إلى الوضوح في ثلاث خطوات' },
    howItWorks: [
      { n: '01', t: 'أضف قضيتك',        d: 'أخبرنا بالتفاصيل الأساسية في أقل من دقيقتين. لا أوراق ولا انتظار.' },
      { n: '02', t: 'نراقب كل شيء',      d: 'كل تقديم وجلسة ورسالة تُتابَع تلقائياً من اليوم الأول.' },
      { n: '03', t: 'أنت من يتحكم',      d: 'تنبيهات فورية ومؤشر صحة حي يضمنان ألا تكون آخر من يعلم.' },
    ],
    featuresHeader: { badge: 'كل ما تحتاجه', h2: 'مصمم لمن يستحق معرفة الحقيقة كاملة' },
    features: [
      { icon: '📋', t: 'الجدول الزمني',       d: 'شاهد كل إجراء وجلسة ومراسلة في عرض واضح. لا شيء مخفي.',         tag: 'في الوقت الفعلي'            },
      { icon: '📅', t: 'متتبع المواعيد',      d: 'مواعيد المحكمة والتقديمات — كلها في مكان واحد مع تنبيهات ذكية.',  tag: 'لا تفوّت موعداً'           },
      { icon: '🗂️', t: 'خزنة المستندات',     d: 'خزّن جميع وثائقك وادخل إليها فوراً. مُحقَّق بـ SHA-256.',         tag: 'أمان بنكي'                  },
      { icon: '💬', t: 'محادثة موثَّقة',      d: 'كل رسالة بينك وبين محاميك مُسجَّلة بالتوقيت ومحفوظة دائماً.',    tag: 'سجل تدقيق كامل'            },
      { icon: '⚖️', t: 'تنبيهات NDE',         d: 'يرصد الذكاء الاصطناعي الصمت والإهمال ويُنبهك قبل فوات الأوان.',  tag: 'مدعوم بالذكاء الاصطناعي'  },
      { icon: '📊', t: 'مؤشر صحة القضية',   d: 'مؤشر مباشر يُظهر الحالة الإجمالية لقضيتك.',                         tag: 'نظرة عامة فورية'           },
    ],
    trust: {
      badge: 'لا إجراءات مخفية',
      h2a:  'لا مزيد من الأمور المخفية.',
      h2b:  'كل شيء موثق.',
      sub:  'تُنشئ وكيلي القانونى سجلاً غير قابل للتغيير لكل خطوة. إن كان هناك وعد فهو مُسجَّل. إن فات موعد فهو مُعلَّم.',
      stats: [
        { v: '100%',    l: 'الإجراءات مُسجَّلة' },
        { v: '0',       l: 'خطوات مخفية'        },
        { v: '24/7',    l: 'مراقبة القضية'       },
        { v: '256-bit', l: 'تشفير'               },
      ],
    },
    testimonials: [
      { q: 'أخيراً فهمت ما يجري في نزاعي العمالي. كل خطوة كانت مرئية ومحاميي يعلم أنني أتابع.',    n: 'أحمد الراشدي', r: 'نزاع عمالي، الإمارات',    stars: 5 },
      { q: 'بعد 3 سنوات من الارتباك، أعطتني وكيلي القانونى صورة كاملة عن قضيتي في 10 دقائق فقط.',         n: 'سارة محمد',     r: 'قضية أسرية، السعودية',    stars: 5 },
      { q: 'تنبيهات المواعيد وحدها أنقذت قضيتي. كنت سأفوّت تقديماً حرجاً لولا وكيلي القانونى.',            n: 'خالد إبراهيم',  r: 'نزاع تجاري، الكويت',      stars: 5 },
    ],
    whatsapp: {
      h2:  'هل تحتاج مساعدة؟ تواصل معنا مباشرة',
      sub: 'فريقنا يرد عادةً خلال 5 دقائق على واتساب.',
      btn: 'تواصل عبر واتساب',
    },
    pricing: {
      badge: 'أسعار بسيطة',
      h2:   'ابدأ مجاناً وارتقِ لتتبع كامل',
      sub:  'لا بطاقة ائتمانية. لا رسوم مخفية.',
    },
    faqHeader: { badge: 'أسئلة شائعة', h2: 'كل ما كنت ستسأل عنه' },
    faq: [
      { q: 'هل أحتاج إلى محامٍ لاستخدام وكيلي القانونى؟', a: 'لا. يمكنك متابعة أي قضية بنفسك، أو دعوة محاميك الحالي للتعاون على نفس الجدول الزمني.' },
      { q: 'هل بياناتي محمية فعلاً؟',                      a: 'نعم. كل مستند ورسالة محميان بتشفير 256-bit ومُسجَّلان في سجل تدقيق غير قابل للتعديل بصمت.' },
      { q: 'ما هي الدول التي تدعمونها؟',                    a: 'تدعم وكيلي القانونى حالياً عملاء في الإمارات والسعودية والكويت والأردن، مع أسواق جديدة قريباً.' },
      { q: 'هل يمكنني الإلغاء في أي وقت؟',                  a: 'نعم. كل الباقات شهرية بدون عقد طويل الأمد أو رسوم إلغاء.' },
    ],
    finalCta: {
      h2:   'ابدأ التحكم في قضيتك اليوم',
      sub:  'انضم إلى آلاف العملاء في الخليج الذين يعلمون أخيراً ما يجري في قضاياهم.',
      btn:  'ابدأ الآن — مجاناً',
      note: 'لا بطاقة ائتمانية. الإعداد في دقيقتين.',
    },
    footer: { copy: '© 2026 وكيلي القانونى. جميع الحقوق محفوظة.' },
  },
};

/* ─── Section badge ─────────────────────────────────────────── */
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="badge-shimmer inline-flex items-center gap-1.5 rounded-full border border-[#f6eabe]/40 bg-[#f6eabe]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#f6eabe]">
      ✦ {children}
    </span>
  );
}

/* ─── Scroll reveal wrapper ─────────────────────────────────── */
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn('reveal', visible && 'reveal-visible', className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── FAQ accordion item ────────────────────────────────────── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-ink-200 bg-card overflow-hidden transition-colors hover:border-teal-300">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-start"
        aria-expanded={open}
      >
        <span className="text-base font-bold text-ink-900">{q}</span>
        <ChevronDown
          className={cn('h-5 w-5 shrink-0 text-[#085f63] transition-transform duration-300', open && 'rotate-180')}
        />
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <p className="px-6 pb-5 text-sm leading-relaxed text-ink-600">{a}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Hero illustration: fog of confusion clearing into a clear timeline ── */
function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 200 120"
      className="pointer-events-none absolute inset-x-0 -top-6 mx-auto h-40 w-full max-w-xl opacity-90"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="fogGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#94a3b8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="clarityGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f6eabe" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#f6eabe" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse className="fog-blob-1" cx="30" cy="55" rx="34" ry="22" fill="url(#fogGrad)" />
      <ellipse className="fog-blob-2" cx="165" cy="40" rx="30" ry="20" fill="url(#fogGrad)" />
      <ellipse cx="100" cy="60" rx="55" ry="30" fill="url(#clarityGrad)" />
    </svg>
  );
}

/* ─── Main page content ─────────────────────────────────────── */
export default function LandingContent({ locale }: { locale: string }) {
  const isRTL = locale === 'ar';
  const c = isRTL ? CONTENT.ar : CONTENT.en;
  const ChevIcon = isRTL ? ChevronLeft : ChevronRight;

  const howItWorksIcons = [UserPlus, Radar, ShieldCheck];

  return (
    <div className="min-h-screen bg-background text-foreground antialiased overflow-x-hidden">
      <style jsx global>{`
        .reveal {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .reveal-visible {
          opacity: 1;
          transform: translateY(0);
        }
        @keyframes heroLineIn {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hero-line {
          opacity: 0;
          animation: heroLineIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fogDrift1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(14px, -10px) scale(1.08); }
        }
        @keyframes fogDrift2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(-16px, 8px) scale(0.94); }
        }
        .fog-blob-1 { animation: fogDrift1 9s ease-in-out infinite; transform-origin: center; }
        .fog-blob-2 { animation: fogDrift2 11s ease-in-out infinite; transform-origin: center; }
        @keyframes badgeShimmer {
          0%   { background-position: -120% 0; }
          100% { background-position: 220% 0; }
        }
        .badge-shimmer {
          position: relative;
          background-image: linear-gradient(90deg, transparent, rgba(246,234,190,0.25), transparent);
          background-size: 200% 100%;
          animation: badgeShimmer 4s ease-in-out infinite;
        }
        @keyframes growHealth {
          from { width: 0%; }
          to   { width: 72%; }
        }
        .health-bar-fill {
          animation: growHealth 1.4s 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes rowFadeIn {
          from { opacity: 0; transform: translateX(var(--row-shift, 12px)); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .mock-row {
          opacity: 0;
          animation: rowFadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes iconFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        .icon-float:hover { animation: iconFloat 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .reveal, .hero-line, .fog-blob-1, .fog-blob-2, .badge-shimmer,
          .health-bar-fill, .mock-row, .icon-float:hover {
            animation: none !important;
            transition: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Grid bg */}
        <div className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(to right,var(--border) 1px,transparent 1px)',
            backgroundSize: '60px 60px',
            opacity: .35,
            maskImage: 'radial-gradient(ellipse 70% 70% at 50% 40%,black 0%,transparent 75%)',
          }} />
        {/* Glow */}
        <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#036176]/8 blur-3xl" />
        <HeroIllustration />

        <div className="relative mx-auto max-w-5xl px-5 py-20 text-center">
          <div className="mb-5 hero-line" style={{ animationDelay: '0ms' }}>
            <Badge>{c.hero.badge}</Badge>
          </div>
          <h1 className="mb-5 text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            <span className="hero-line inline-block text-[#036176] dark:text-white" style={{ animationDelay: '90ms' }}>{c.hero.h1a} </span>
            <span className="hero-line inline-block bg-gradient-to-r from-[#036176] to-[#085f63] bg-clip-text text-transparent" style={{ animationDelay: '180ms' }}>
              {c.hero.h1b}
            </span>
            <br />
            <span className="hero-line inline-block text-[#036176] dark:text-white" style={{ animationDelay: '270ms' }}>{c.hero.h1c}</span>
          </h1>
          <p className="hero-line mx-auto mb-8 max-w-xl text-lg text-muted-foreground leading-relaxed" style={{ animationDelay: '360ms' }}>
            {c.hero.sub}
          </p>
          {/* CTAs */}
          <div className={cn('hero-line flex flex-wrap justify-center gap-3', isRTL && 'flex-row-reverse')} style={{ animationDelay: '450ms' }}>
            <Link href="/register"
              className="group flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#085f63] to-[#036176] px-7 py-3.5 text-base font-black text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
              {c.hero.cta1}
              <ChevIcon className={cn('h-4 w-4 transition-transform', isRTL ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1')} />
            </Link>
            <Link href="/login"
              className="flex items-center gap-2 rounded-2xl border border-border px-7 py-3.5 text-base font-semibold text-foreground hover:border-[#036176]/40 hover:bg-[#036176]/5 transition-all">
              {c.hero.cta2}
            </Link>
          </div>
          {/* Trust line */}
          <p className="hero-line mt-7 text-sm text-muted-foreground flex items-center justify-center gap-2" style={{ animationDelay: '540ms' }}>
            <span className="text-[#f6eabe]">✦</span>
            {c.hero.trust}
          </p>

          {/* Dashboard mockup */}
          <div className="hero-line mx-auto mt-14 max-w-2xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden" style={{ animationDelay: '630ms' }}>
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-muted/40">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
              <span className="ms-2 text-xs font-medium text-muted-foreground">
                {isRTL ? 'نزاع عمالي — القضية #1842' : 'Labor Dispute — Case #1842'}
              </span>
            </div>
            <div className="p-4 space-y-2">
              {[
                { tag: 'bg-emerald-100 text-emerald-700', label: isRTL ? '✓ منتهي' : '✓ Done',   text: isRTL ? 'تعيين المحامي وتوقيع العقد' : 'Lawyer assigned & contract signed',    date: 'Mar 1' },
                { tag: 'bg-blue-100 text-blue-700',       label: isRTL ? 'نشط' : 'Active',         text: isRTL ? 'تقديم المستندات للمحكمة'    : 'Documents submitted to court',          date: 'Mar 8' },
                { tag: 'bg-amber-100 text-amber-700',     label: isRTL ? '⏳ قريب' : '⏳ Soon',    text: isRTL ? 'جلسة الاستماع — قاعة أ'     : 'Hearing scheduled — Court A',           date: 'Mar 22' },
                { tag: 'bg-red-100 text-red-700',         label: isRTL ? '⚠ تنبيه' : '⚠ Alert',   text: isRTL ? 'NDE: 14 يوماً بدون تحديث'  : 'NDE: 14 days without update',           date: isRTL ? 'اليوم' : 'Today' },
              ].map((row, i) => (
                <div
                  key={i}
                  className="mock-row flex items-center gap-3 rounded-xl border border-border p-3"
                  style={{ animationDelay: `${900 + i * 130}ms`, ['--row-shift' as string]: isRTL ? '-12px' : '12px' }}
                >
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0', row.tag)}>{row.label}</span>
                  <span className="flex-1 text-xs font-medium text-foreground text-start">{row.text}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0" dir="ltr">{row.date}</span>
                </div>
              ))}
              <div className="mock-row flex items-center gap-3 rounded-xl bg-muted/50 border border-border p-3 mt-1" style={{ animationDelay: '1420ms' }}>
                <span className="text-xs font-medium text-muted-foreground shrink-0">
                  {isRTL ? 'صحة القضية' : 'Case Health'}
                </span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="health-bar-fill h-full rounded-full bg-gradient-to-r from-[#085f63] to-[#C89B3C]" style={{ width: '72%' }} />
                </div>
                <span className="text-xs font-black text-[#085f63] tabular-nums shrink-0">72%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROBLEM ────────────────────────────────────────────── */}
      <section className="bg-muted/40 py-20">
        <div className="mx-auto max-w-5xl px-5">
          <Reveal className="text-center mb-12">
            <div className="mb-4"><Badge>{c.problemHeader.badge}</Badge></div>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{c.problemHeader.h2}</h2>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {c.problems.map((item, i) => (
              <Reveal key={item.t} delay={i * 90}>
                <div className="group h-full cursor-pointer rounded-2xl border border-border bg-card p-8 hover:bg-white hover:-translate-y-2 hover:shadow-2xl hover:border-teal-300 active:scale-95 transition-all duration-300 relative overflow-hidden">
                  <div className="absolute top-0 start-0 end-0 h-0.5 bg-gradient-to-r from-red-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="icon-float mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-2xl group-hover:scale-110 transition-transform duration-300">{item.icon}</span>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{item.t}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOLUTION ───────────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-5">
          <Reveal className="text-center mb-12">
            <div className="mb-4"><Badge>{c.solutionHeader.badge}</Badge></div>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{c.solutionHeader.h2}</h2>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {c.solutions.map((item, i) => (
              <Reveal key={item.t} delay={i * 110}>
                <div className="group h-full cursor-pointer text-center rounded-2xl border border-border bg-card p-8 hover:bg-white hover:-translate-y-2 hover:shadow-2xl hover:border-teal-300 active:scale-95 transition-all duration-300">
                  <div className="icon-float mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#036176] to-[#085f63] shadow-lg text-3xl group-hover:scale-110 transition-transform duration-300">
                    {item.icon}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{item.t}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS (new) ─────────────────────────────────── */}
      <section className="bg-muted/40 py-20">
        <div className="mx-auto max-w-5xl px-5">
          <Reveal className="text-center mb-16">
            <div className="mb-4"><Badge>{c.howItWorksHeader.badge}</Badge></div>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{c.howItWorksHeader.h2}</h2>
          </Reveal>
          <div className="relative grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
            <div className="pointer-events-none absolute top-8 hidden h-px w-full bg-gradient-to-r from-transparent via-[#085f63]/25 to-transparent sm:block" />
            {c.howItWorks.map((step, i) => {
              const Icon = howItWorksIcons[i];
              return (
                <Reveal key={step.n} delay={i * 140} className="relative text-center">
                  <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white border border-border shadow-md">
                    <Icon className="h-7 w-7 text-[#085f63]" strokeWidth={1.75} />
                    <span className="absolute -top-3 -end-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#036176] text-[11px] font-black text-white shadow">
                      {step.n}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{step.t}</h3>
                  <p className="mx-auto max-w-xs text-sm text-slate-600 leading-relaxed">{step.d}</p>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-5">
          <Reveal className="text-center mb-12">
            <div className="mb-4"><Badge>{c.featuresHeader.badge}</Badge></div>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{c.featuresHeader.h2}</h2>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {c.features.map((item, i) => (
              <Reveal key={item.t} delay={(i % 3) * 100}>
                <div className="group h-full cursor-pointer rounded-2xl border border-border bg-card p-8 hover:bg-white hover:-translate-y-2 hover:shadow-2xl hover:border-teal-300 active:scale-95 transition-all duration-300 relative overflow-hidden">
                  <div className="absolute bottom-0 start-0 end-0 h-0.5 bg-gradient-to-r from-[#036176] via-[#085f63] to-[#C89B3C] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-start" />
                  <span className="icon-float mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[#085f63]/10 text-2xl group-hover:scale-110 transition-transform duration-300">{item.icon}</span>
                  <span className="inline-block rounded-md bg-[#085f63]/10 text-[#085f63] text-[10px] font-bold px-2 py-0.5 mb-2 uppercase tracking-wide">{item.tag}</span>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{item.t}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-20"
        style={{ background: 'linear-gradient(160deg,#036176 0%,#085f63 40%,#064e4a 100%)' }}>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute start-0 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-[#085f63]/15 blur-3xl" />
          <div className="absolute end-0 top-0 h-64 w-64 rounded-full bg-[#f6eabe]/10 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-5xl px-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <Reveal>
              <div className="mb-4">
                <Badge>{c.trust.badge}</Badge>
              </div>
              <h2 className="text-3xl font-black text-white mb-4 sm:text-4xl">
                {c.trust.h2a}<br />
                <span className="text-[#f6eabe]">{c.trust.h2b}</span>
              </h2>
              <p className="text-white/65 leading-relaxed mb-8">{c.trust.sub}</p>
              <Link href="/register"
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#085f63] to-[#036176] px-6 py-3 font-black text-white hover:shadow-lg hover:-translate-y-0.5 transition-all">
                {isRTL ? 'جرّب مجاناً' : 'Try Free'}
                <ChevIcon className="h-4 w-4" />
              </Link>
            </Reveal>
            <div className="grid grid-cols-2 gap-4">
              {c.trust.stats.map((s, i) => (
                <Reveal key={s.l} delay={i * 100}>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center hover:bg-white/8 hover:border-[#f6eabe]/40 transition-all">
                    <div className="text-3xl font-black text-[#f6eabe] mb-2 tabular-nums">{s.v}</div>
                    <div className="text-xs text-white/55 font-semibold">{s.l}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ───────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-5">
          <Reveal className="text-center mb-12">
            <Badge>{isRTL ? 'ماذا يقول العملاء' : 'What clients say'}</Badge>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {c.testimonials.map((item, i) => (
              <Reveal key={item.n} delay={i * 100}>
                <div className="h-full rounded-2xl border border-border bg-card p-6 hover:-translate-y-1 hover:shadow-lg transition-all relative overflow-hidden">
                  <span className="pointer-events-none absolute -top-4 text-7xl font-black text-[#036176]/5 select-none" aria-hidden="true">”</span>
                  <div className="relative text-[#f6eabe] text-sm mb-3">{'★'.repeat(item.stars)}</div>
                  <p className="relative text-sm text-foreground font-medium leading-relaxed mb-5">"{item.q}"</p>
                  <div className="relative flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#036176] to-[#085f63] flex items-center justify-center text-white text-xs font-black shrink-0">
                      {item.n[0]}
                    </div>
                    <div>
                      <p className="text-xs font-bold">{item.n}</p>
                      <p className="text-[10px] text-muted-foreground">{item.r}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHATSAPP ───────────────────────────────────────────── */}
      <section className="py-16" style={{ background: 'linear-gradient(135deg,#0d1f35,#0a2820)' }}>
        <div className="mx-auto max-w-3xl px-5 text-center">
          <Reveal>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-lg"
              style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)', boxShadow: '0 8px 32px rgba(37,211,102,.4)' }}>
              💬
            </div>
            <h2 className="text-2xl font-black text-white mb-3">{c.whatsapp.h2}</h2>
            <p className="text-white/60 mb-7 text-sm">{c.whatsapp.sub}</p>
            <a href="https://wa.me/971500000000?text=Hi%2C%20I%27d%20like%20to%20know%20more%20about%20Legal Wakeely"
              target="_blank" rel="noopener"
              className="inline-flex items-center gap-2 rounded-2xl px-8 py-3.5 text-base font-black text-white transition-all hover:-translate-y-1"
              style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)', boxShadow: '0 4px 24px rgba(37,211,102,.35)' }}>
              {c.whatsapp.btn}
            </a>
          </Reveal>
        </div>
      </section>

      {/* ── PRICING ────────────────────────────────────────────── */}
      <section className="py-20 bg-ink-50/50">
        <div className="mx-auto max-w-5xl px-5">
          <Reveal className="text-center mb-12">
            <div className="mb-4"><Badge>{c.pricing.badge}</Badge></div>
            <h2 className="text-3xl font-black mb-3 sm:text-4xl">{c.pricing.h2}</h2>
            <p className="text-ink-600 text-lg mb-2">{c.pricing.sub}</p>
            <p className="text-sm text-ink-500">
              {isRTL ? "الأسعار بالدينار الأردني · الدفع عبر CliQ" : "Prices in JOD · Pay via CliQ"}
            </p>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { name: isRTL ? 'أساسية' : 'Basic', price: '6', period: isRTL ? 'شهرياً' : '/month', highlight: false, icon: '📋',
                features: isRTL ? ['حتى 3 قضايا نشطة','5 مستندات لكل قضية','1 غيغابايت تخزين','تتبع المواعيد'] : ['Up to 3 active cases','5 documents per case','1 GB storage','Deadline tracking'] },
              { name: isRTL ? 'احترافية' : 'Pro', price: '21', period: isRTL ? 'شهرياً' : '/month', highlight: true, icon: '⚖️',
                features: isRTL ? ['حتى 10 قضايا نشطة','تنبيهات تصعيد NDE','تقييم المحامين','الفواتير + المدفوعات','إشعارات واتساب'] : ['Up to 10 active cases','NDE escalation alerts','Lawyer scoring','Invoices + disbursements','WhatsApp notifications'] },
              { name: isRTL ? 'مميزة' : 'Premium', price: '56', period: isRTL ? 'شهرياً' : '/month', highlight: false, icon: '👑',
                features: isRTL ? ['قضايا غير محدودة','تحليل الوثائق بالذكاء الاصطناعي','مستشار صوتي غير محدود','دعم ذو أولوية'] : ['Unlimited cases','Legal-AI document analysis','Unlimited voice advisor','Priority support'] },
            ].map((plan, i) => (
              <Reveal key={plan.name} delay={i * 110}>
                <div className={cn(
                  'group relative flex h-full flex-col rounded-2xl bg-white p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-start',
                  plan.highlight
                    ? 'border-2 border-brand-500 shadow-lg ring-1 ring-brand-200'
                    : 'border border-ink-200 shadow-sm hover:border-brand-300'
                )}>
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-4 py-1 text-xs font-bold text-white shadow-md">
                        ★ {isRTL ? 'الأكثر شيوعاً' : 'Most Popular'}
                      </span>
                    </div>
                  )}
                  <div className="mb-5 flex items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-xl bg-ink-50 text-2xl">{plan.icon}</span>
                    <h3 className="text-xl font-bold text-ink-900">{plan.name}</h3>
                  </div>
                  <div className="mb-6 border-b border-ink-100 pb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-ink-900">{plan.price}</span>
                      <span className="text-lg font-bold text-ink-600">JOD</span>
                    </div>
                    <p className="mt-1 text-sm text-ink-500">{plan.period}</p>
                  </div>
                  <ul className="mb-8 flex-1 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-ink-700">
                        <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-100">
                          <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" strokeWidth={3} />
                        </span>
                        <span className="leading-relaxed">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/register" className={cn(
                    'block rounded-xl py-3.5 text-center text-sm font-bold transition-all duration-200 active:scale-95',
                    plan.highlight
                      ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-md hover:shadow-lg'
                      : 'border-2 border-ink-900 bg-white text-ink-900 hover:bg-ink-900 hover:text-white'
                  )}>
                    {isRTL ? 'ابدأ الآن' : 'Get Started'}
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-8 text-center">
            <Link href="/billing" className="text-sm font-bold text-brand-700 hover:underline">
              {isRTL ? 'عرض كل الباقات والتفاصيل ←' : 'View all plans & details →'}
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ (new) ──────────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-5">
          <Reveal className="text-center mb-12">
            <div className="mb-4"><Badge>{c.faqHeader.badge}</Badge></div>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{c.faqHeader.h2}</h2>
          </Reveal>
          <div className="space-y-4">
            {c.faq.map((item, i) => (
              <Reveal key={item.q} delay={i * 70}>
                <FaqItem q={item.q} a={item.a} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────── */}
      <section className="py-24 text-center relative overflow-hidden bg-ink-100">
        <div className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 100%,rgba(8,95,99,.10) 0%,transparent 60%)' }} />
        <Reveal className="relative mx-auto max-w-2xl px-5">
          <h2 className="text-4xl font-black tracking-tight mb-4 sm:text-5xl text-ink-700">{c.finalCta.h2}</h2>
          <p className="text-ink-600 text-lg mb-8">{c.finalCta.sub}</p>
          <Link href="/register"
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#085f63] to-[#036176] px-8 py-4 text-lg font-black text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all">
            {c.finalCta.btn}
            <ChevIcon className="h-5 w-5" />
          </Link>
          <p className="mt-4 text-sm text-ink-600">{c.finalCta.note}</p>
        </Reveal>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-5xl px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#036176]">
              <Shield className="h-3.5 w-3.5 text-[#f6eabe]" />
            </div>
            <span className="text-sm font-black text-[#036176] dark:text-white">
              {isRTL ? 'وكيلي القانونى' : 'LEGAL WAKEELY'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{c.footer.copy}</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href={`/${locale}/login`} className="hover:text-foreground transition">{c.nav.login}</Link>
            <Link href={`/${locale}/register`} className="hover:text-foreground transition">{c.nav.register}</Link>
            <a href={locale === 'ar' ? '/en' : '/ar'}
              className="font-bold hover:text-[#036176] transition">
              {isRTL ? 'English' : 'العربية'}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
