# LegalWakeely — Consolidated Legal Tech Platform

> **One app, two products.** A single Next.js codebase that merges:
> - **Wakeela** — case accountability platform (deadlines, NDE escalation, lawyer scoring, invoices, vault, chat, witness mode)
> - **Almustahar (Legal-AI)** — AI document analysis with a Jordanian legal-corpus RAG engine, sold as a **paid add-on module** on top of any base tier (or bundled with premium)

The Legal-AI module is the natural top-of-funnel: *understand a legal document → decide if you need a lawyer → one click opens a Wakeela case pre-filled with the analysis context.*

---

## What changed in this consolidation

This repo was rebuilt from the broken `legalwakeelytest` merge attempt into a single, coherent, buildable app. The four architectural seams that blocked the merge are now resolved:

| Seam | Before | After |
|------|--------|-------|
| **Data layer** | Prisma (`@prisma/client`) + Supabase SQL coexisted with overlapping, conflicting tables (`User`/`users`, `Document`/`documents`, `Analysis`/`document_analyses`) | **Supabase-native only.** Prisma deleted. Almustahar's `Analysis`/`Lead`/`Review`/`LawyerProfile`/`LegalCorpus` ported as new Supabase tables in `supabase/migrations/20260342_legal_ai_module.sql` with RLS. `document_analyses` extended (single source of truth). |
| **Auth** | Almustahar Phone-OTP (`OtpChallenge` model) + Wakeela Supabase Auth, two sessions | **Supabase Auth only.** `OtpChallenge` deleted. The `session-provider` / `session-server` shims now read from Supabase auth but keep the `SessionUser` API the ported pages expect. |
| **i18n** | Almustahar custom `locale-provider` (localStorage) + Wakeela `next-intl` (`[locale]` URL segment), two systems | **next-intl only.** The ported pages live under `src/app/[locale]/legal-ai/`. The `locale-provider` shim now derives locale from `next-intl`'s `useLocale()` (URL) and navigates via next-intl router. (Almustahar's inline dictionary stays as a bridge — see "i18n debt" below.) |
| **Dependencies** | Ported code imported `pdfjs-dist`, `tesseract.js`, `@google/generative-ai`, `@prisma/client` — none in `package.json` | `pdfjs-dist`, `tesseract.js`, `@google/generative-ai` added. Prisma removed. `tsx` added for the corpus seed script. |

### Cleanup
- Deleted `almustahar-temp/` (3 MB of scratch files)
- Deleted `tsconfig.tsbuildinfo` (1.2 MB build artifact)
- Deleted `temp-test.html` (67 KB scratch)
- Deleted `prisma/` folder and all Prisma-dependent lib files (`db.ts`, `data.ts`, `ai-gemini.ts`, `analyze-save.ts`, `ai-mock.ts`)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  ONE Next.js app (Supabase-native, next-intl ar/en, Stripe)     │
├─────────────────────────────────────────────────────────────────┤
│  BASE (free / basic / pro / premium)                            │
│   • Landing, auth, dashboard                                    │
│   • Cases, deadlines, timeline                                  │
│   • Document vault + shares                                     │
│   • Chat with lawyer, witness mode                              │
│   • NDE escalation + WhatsApp alerts  (pro+)                    │
│   • Lawyer scoring, invoices, voice AI   (pro+)                 │
├─────────────────────────────────────────────────────────────────┤
│  ⭐ LEGAL-AI ADD-ON  (src/app/[locale]/legal-ai/*)               │
│     Enabled when: premium tier  OR  legal_ai_enabled = true     │
│   • Upload PDF/image → OCR (Tesseract) + parse (PDF.js)         │
│   • Gemini analysis grounded in Jordanian corpus (pgvector RAG) │
│   • Rights / obligations / risks / legal sources                │
│   • "Lawyer-needed gauge" → one-click create case  ──┐          │
│   • Lawyer directory + hire leads                     │ handoff  │
│   • Analysis history + admin review queue            ↓          │
│   • Monthly fair-use cap (legal_ai_usage table)   → BASE case   │
└─────────────────────────────────────────────────────────────────┘
```

### Subscription gating

The Legal-AI module is an **orthogonal add-on**, not a tier. Access is granted when EITHER:
- the user's base tier is `premium` (`TIER_GATES.premium.legal_ai === true`), OR
- `subscriptions.legal_ai_enabled = true` (the add-on was purchased on top of any base tier).

Enforcement: `checkLegalAiAccess(userId)` in `src/lib/legal-ai/gate.ts` is called by:
- the `/legal-ai/*` page server components (renders an upgrade CTA if denied)
- the `/api/legal-ai/analyze` route (returns 402 if denied, 429 if monthly cap reached)

The Stripe webhook (`/api/webhooks/stripe`) detects the add-on by matching its price ID against `LEGAL_AI_ADDON.priceId` (or `sub.metadata.addon === 'legal_ai'`) and flips `legal_ai_enabled` on `subscription.created/updated`, off on `subscription.deleted`.

### Cross-module handoff (the killer feature)

When a Legal-AI analysis returns `lawyerScore !== LOW`, the analysis page renders a **"Create case from this analysis"** button (`src/components/legal-ai/create-case-from-analysis.tsx`). It POSTs to `/api/cases` with:
- `title` ← the analysis's `documentTitle`
- `case_type` ← mapped from `documentType` (rental→property, employment→employment, …)
- `draft_data.source = "legal-ai"` + `draft_data.analysis_id` + `draft_data.summary`

…then routes the user straight to the new case. This is the whole reason to merge: the Legal-AI funnel *becomes* the case-management funnel.

---

## Project layout

```
src/
├─ app/
│  ├─ [locale]/
│  │  ├─ page.tsx              # Wakeela landing
│  │  ├─ (auth)/               # login, register
│  │  ├─ (dashboard)/          # cases, vault, deadlines, settings, billing, …
│  │  ├─ (lawyer)/             # lawyer dashboard
│  │  ├─ (admin)/              # admin tools
│  │  └─ legal-ai/             # ⭐ the consolidated Almustahar module
│  │     ├─ page.tsx           #   landing (shows upgrade CTA if gated)
│  │     ├─ upload/            #   document upload + analysis
│  │     ├─ analyses/          #   analysis history + result view
│  │     └─ lawyers/           #   lawyer directory + hire flow
│  ├─ api/
│  │  ├─ legal-ai/analyze/     # ⭐ gated Gemini+RAG analysis endpoint
│  │  ├─ cases/                #   case CRUD (handoff target)
│  │  ├─ stripe/               #   checkout + portal
│  │  ├─ webhooks/stripe/      #   subscription + add-on lifecycle
│  │  └─ …                     #   deadlines, invoices, nde, voice, …
│  └─ share/ witness/          # public token pages (no locale)
├─ components/
│  ├─ legal-ai/                # ⭐ cross-module handoff button
│  ├─ ui/                      # shadcn-style primitives
│  └─ …                        # cases, chat, deadlines, invoices, …
├─ lib/
│  ├─ legal-ai/                # ⭐ the consolidated engine
│  │  ├─ gemini.ts             #   Gemini analysis + pgvector RAG retriever
│  │  ├─ data.ts               #   Supabase-native analyses/lawyers/leads DAL
│  │  ├─ analyze-save.ts       #   persist analysis + meter usage
│  │  ├─ gate.ts               #   subscription + fair-use guard
│  │  ├─ pdf-client.ts         #   PDF.js + Tesseract browser extraction
│  │  └─ index.ts              #   barrel
│  ├─ supabase/                # server + browser clients
│  ├─ feature-gate.ts          # TIER_GATES enforcement (now incl. legal_ai)
│  ├─ stripe-plans.ts          # base tiers + LEGAL_AI_ADDON config
│  ├─ locale-provider.tsx      # ⚠️ shim (next-intl → Almustahar dictionary API)
│  ├─ session-provider.tsx     # ⚠️ shim (Supabase auth → SessionUser API)
│  └─ …
├─ types/index.ts              # SubscriptionTier, TIER_GATES (incl. legal_ai), …
└─ i18n/                       # next-intl routing, navigation, request config

supabase/
├─ migrations/
│  ├─ 001_initial_schema.sql … 022_*  # Wakeela base schema
│  └─ 20260342_legal_ai_module.sql    # ⭐ Legal-AI tables + RLS + RPCs
└─ functions/                          # edge functions (nde-engine, notifications)

data/jordanian-corpus.ts              # ⭐ seed corpus (580 lines, ~hundreds of articles)
scripts/seed-legal-corpus.ts          # ⭐ `npm run legal-ai:seed-corpus`
messages/{ar,en}.json                 # next-intl message catalogs
```

---

## Getting started

### 1. Install
```bash
npm install
```

### 2. Configure env
```bash
cp .env.example .env.local
# fill in: Supabase URL + anon + service-role keys, Stripe keys, Gemini key (for Legal-AI)
```

### 3. Apply migrations
The consolidated schema = all of Wakeela's existing migrations + the new Legal-AI migration:
```bash
# Option A — Supabase CLI (recommended)
supabase db push

# Option B — apply the one new migration by hand
# Run supabase/migrations/20260342_legal_ai_module.sql in the Supabase SQL editor.
```

### 4. Seed the legal corpus (Legal-AI RAG)
```bash
npm run legal-ai:seed-corpus
# If GEMINI_API_KEY is set, each chunk gets a 768-dim embedding.
# Without it, chunks are inserted text-only (RAG falls back to keyword search).
```

### 5. Create the Stripe add-on product
In your Stripe dashboard, create a recurring product for the Legal-AI add-on ($15/mo USD or equivalent). Copy its price ID into `STRIPE_PRICE_LEGAL_AI_MONTHLY` in `.env.local`. When a user subscribes, pass `metadata.addon = "legal_ai"` (the webhook detects it).

### 6. Run
```bash
npm run dev
```

### 7. Typecheck / build
```bash
npm run type-check   # tsc --noEmit — currently passes clean
npm run build        # next build — requires env vars for data collection
```

---

## The Legal-AI data model (migration 20260342)

| Table | Purpose | RLS |
|-------|---------|-----|
| `legal_corpus` | RAG knowledge base — Jordanian/MENA legal articles, with `vector(768)` embedding column + `external_id` for idempotent re-ingestion | read: authenticated; write: service role only |
| `lawyer_directory` | Public lawyer discovery profiles (separate from `users` / `case_lawyers`) | read: verified lawyers public; self-update own row |
| `legal_leads` | Citizen→lawyer hire requests, optionally linked to a `document_analyses` row | owner read/write; assigned lawyer read |
| `legal_reviews` | Citizen ratings of lawyers (1–5) | owner write; public read |
| `legal_ai_usage` | Monthly fair-use metering per user | owner read |
| `document_analyses` (extended) | Already existed in Wakeela (`20260331_doc_ai.sql`); now carries `rights`, `legal_sources`, `lawyer_score`, `lawyer_reason`, `confidence_score`, `review_status`, `cited_corpus_ids` | unchanged (owner-only) |
| `subscriptions` (extended) | Already existed; now carries `legal_ai_enabled`, `legal_ai_stripe_price_id`, `legal_ai_current_period_end` | unchanged |

### RPCs
- `match_legal_corpus(query_embedding vector(768), match_count int, match_threshold float)` — pgvector cosine retriever, `SECURITY DEFINER` so authenticated users can search without direct UPDATE rights on the embedding column.
- `increment_legal_ai_usage(p_user_id uuid, p_period date)` — atomic monthly counter bump.

---

## Known follow-ups (i18n debt)

The Legal-AI pages still contain inline Arabic strings via the `dictionaries` object in `src/lib/i18n.ts`. The `locale-provider` shim exposes these through the `t` property so the pages render correctly, and the locale itself is now driven by next-intl (URL-based). **The remaining work** is to extract those strings into `messages/ar.json` + `messages/en.json` and replace `t.foo.bar` lookups with next-intl's `useTranslations()`. This is mechanical and can be done page-by-page without changing behavior.

The pages affected:
- `src/app/[locale]/legal-ai/upload/page.tsx`
- `src/app/[locale]/legal-ai/analyses/[id]/page.tsx`
- `src/app/[locale]/legal-ai/lawyers/page.tsx`
- `src/app/[locale]/legal-ai/lawyers/[id]/page.tsx`
- `src/components/site-header.tsx`, `site-footer.tsx`, `hire-form.tsx`, `admin-actions.tsx`

---

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run type-check` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright e2e |
| `npm run legal-ai:seed-corpus` | Seed/embed the Jordanian legal corpus into Supabase |
| `npm run supabase:migrate` | `supabase db push` |

---

## Source repositories

| Repo | Role in this consolidation |
|------|----------------------------|
| `github.com/jeepooly-blip/wakeely.git` | **Base.** All of Wakeela's case-management, billing, escalation, and i18n infrastructure is preserved as-is. |
| `github.com/jeepooly-blip/almustahar.git` | **Source of the Legal-AI engine.** Gemini analysis, RAG over Jordanian corpus, lawyer directory, PDF/OCR client, and the Jordanian corpus data were ported into `src/lib/legal-ai/` + `data/` + `supabase/migrations/20260342_legal_ai_module.sql`. Prisma + Phone-OTP + custom i18n were dropped in favor of Supabase + next-intl. |
| `github.com/jeepooly-blip/legalwakeelytest.git` | **Starting point of this merge** (now superseded). Its `almustahar-temp/` scratch copy and broken dual data layer were removed. |

---

## License & data

The Jordanian legal corpus (`data/jordanian-corpus.ts`) is sourced from public law texts. Confirm you have the rights to serve it commercially before deploying to production.
