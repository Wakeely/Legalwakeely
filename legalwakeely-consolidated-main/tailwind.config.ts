import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        navy: {
          50:  '#eef3f9',
          100: '#d4e2f0',
          200: '#a8c5e1',
          300: '#7da8d2',
          400: '#518bc3',
          500: '#2a6fb5',
          600: '#1e5491',
          700: '#1A3557',
          800: '#122640',
          900: '#0a1728',
        },
        gold: {
          50:  '#fdf8ee',
          100: '#f9efd0',
          200: '#f3dea1',
          300: '#edcd72',
          400: '#e7bc43',
          500: '#C89B3C',
          600: '#a07a2e',
          700: '#785b22',
          800: '#503c16',
          900: '#281e0b',
        },
        teal: {
          50:  '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0E7490',
          800: '#155e75',
          900: '#164e63',
        },
        // ── ink: neutral gray scale for text/borders/backgrounds ──
        ink: {
          50:  '#faf7f2',   // warm off-white (page background)
          100: '#f6eabe',   // warm cream (accent/card backgrounds)
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#036176',   // deep teal — bold text / headings
          800: '#1e293b',
          900: '#0f172a',
        },
        // ── brand: primary brand colors (teal-based, #085f63 family) ──
        brand: {
          50:  '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#085f63',   // primary brand color (dark teal)
          700: '#036176',   // deep teal — headings, bold text
          800: '#064e4a',
          900: '#134e4a',
        },
        // ── cream: warm accent backgrounds (#f6eabe family) ──
        cream: {
          50:  '#faf7f2',   // page background
          100: '#f6eabe',   // card accent background
          200: '#f0dfa0',
          300: '#e8d278',
        },
        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontFamily: {
        sans:   ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        arabic: ['var(--font-arabic)', 'IBM Plex Arabic', 'Noto Naskh Arabic', 'serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
        'fade-in':        'fade-in 0.4s ease-out forwards',
        'scale-in':       'scale-in 0.3s ease-out forwards',
      },
    },
  },
  plugins: [animate],
};

export default config;
