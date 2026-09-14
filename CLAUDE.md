# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A lead-generation marketing site for Australian Superannuation (DASP) refund claims, targeting former
working-holiday-makers/students. It is **not** a payment processor — there are no end-user accounts and no money
movement. Visitors submit anonymous "leads" through a refund estimator; a single internal **admin** triages them
through a status pipeline and runs an AI-assisted blog. Branding is mid-migration from the old name "AussieBack" to
"refundmysuper" (`refundsuper.com.au`) — some internal identifiers (a few webhook header names, one blog slug) still
say "aussieback"; this is known, deliberate, deferred cleanup (see `memory/PRD.md`), not something to silently "fix"
in unrelated changes.

The project originally ran as two services (a FastAPI + MongoDB backend in `/backend`, alongside a Next.js frontend
in `/frontend`, scaffolded by the "Emergent" hosting platform). That has been **fully migrated** to a single Next.js
app so it deploys as one Vercel project — `/backend`, `.emergent/`, and the `/frontend` subdirectory itself no
longer exist; the Next.js app now lives directly at the repo root (`app/`, `src/`, `package.json`, etc., not
`frontend/app/`, `frontend/src/`, `frontend/package.json`). If you see references to FastAPI, Mongo, Emergent, or a
`frontend/` path prefix in git history, `memory/PRD.md`, or `test_result.md`/`test_reports/`, they describe the
pre-migration state, not the current one.

## Architecture

Single Next.js 15 (App Router) + React 19 app, plain JavaScript (no TypeScript — see `jsconfig.json`, path alias
`@/*` → `src/*`). UI is shadcn/Radix (`src/components/ui/*`, configured by `components.json`). All backend logic
lives in the same app as Next.js Route Handlers under `app/api/**`, backed by **Supabase (Postgres)**. There is no
separate backend process to run or deploy.

- All API routes live under `app/api/**`, mirroring the URL shape the old FastAPI backend used (`/api/leads`,
  `/api/admin/*`, `/api/blog/*`, etc.) so existing frontend call sites needed minimal changes.
- SEO crawler files use Next's native conventions instead of hand-rolled routes: `app/sitemap.js` and `app/robots.js`
  serve `/sitemap.xml`/`/robots.txt` directly. Google Search Console / IndexNow verification files still need exact
  root-level paths (`/google*.html`, `/{key}.txt`), so `next.config.mjs`'s `rewrites()` proxies those two patterns to
  `app/api/seo/google-verification/[token]/route.js` and `app/api/seo/indexnow/[key]/route.js`. Don't delete that
  rewrites block — it's the only way those two crawler-facing paths reach their handlers.
- Server-only code (DB access, integrations, business logic) lives under `src/lib/server/**` — this directory must
  **never** be imported from a `"use client"` component; only from route handlers, Server Components, or
  `middleware.js`. (`jsconfig.json` only aliases `@/*` → `src/*`, not `app/*`, which is why server code lives under
  `src/lib/server/` rather than colocated under `app/`.)

### Database (Supabase / Postgres)

Schema lives in `supabase/migrations/0001_init.sql` — this is the source of truth for table/column
structure (`leads`, `share_events`, `blog_posts`, `comments`, `settings`, `autopilot_queue`, `webhook_outbox`,
`rate_limit_hits`). All tables have RLS **enabled with zero policies** (deny-all) — every read/write goes through the
service-role client in `src/lib/server/supabaseAdmin.js`, which bypasses RLS entirely. Never query these tables with
the anon/publishable key.

There is **no `admins` table** — admin auth is handled entirely by Supabase Auth's own `auth.users`. Create the one
admin user directly in the Supabase dashboard (Authentication → Users → Add user) and disable public sign-up.

`src/lib/server/supabaseAdmin.js` and `supabaseServer.js` read `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` /
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` **lazily** (inside function calls, not at module import
time), so `next build`/`next dev` never crash just because Supabase credentials are unset — a request that actually
needs the database will fail clearly at request time instead.

### Auth: Supabase Auth + middleware (real server-side protection)

- `middleware.js` (repo root) — the actual security boundary for `/admin/:path*` and `/api/admin/:path*`. Calls
  `supabase.auth.getUser()` (re-validates against the auth server, not just decoding a cookie). Fails closed
  (401 / redirect-to-login) when Supabase env vars are unset.
- `src/lib/server/requireAdmin.js` — a second, defense-in-depth check called at the top of every
  `app/api/admin/**/route.js` handler.
- `app/admin/login/page.jsx` calls `supabase.auth.signInWithPassword()` directly from the client
  (`src/lib/supabaseBrowser.js`) — there is **no** `/api/admin/login` route; login never round-trips through a
  custom API route.
- `src/components/AdminGuard.jsx` is now just a loading-flash guard, not a security boundary — middleware is what
  actually protects admin routes.
- `src/lib/api.js` is a relative-baseURL (`/api`) axios instance with no bearer-token interceptor — the Supabase
  session travels automatically via same-origin cookies.

### Integrations — all soft-fail when unconfigured (`src/lib/server/`)

- `mailer.js` + `integrations.js` — email via the **Resend HTTP API** (`RESEND_API_KEY`/`RESEND_FROM_EMAIL`). Guard
  every send behind `isEmailConfigured()`; when unset, sends are no-ops that log `[STUB]`. **Do not reintroduce
  SMTP/Nodemailer** — serverless platforms (Vercel runs on AWS Lambda) block outbound SMTP ports, which made raw
  SMTP fail in production with `ETIMEDOUT` on `CONN`. Resend's SDK resolves with `{ data, error }` rather than
  rejecting, so an unchecked `error` silently looks like a successful send.
- `integrations.js` — WhatsApp via the `twilio` npm package, IndexNow ping, Google Search Console ping
  (`google-auth-library`, direct REST call rather than a generated client). Twilio accepts **either** credential
  style — Account SID + Auth Token, or API Key SID + Secret (which additionally requires `TWILIO_ACCOUNT_SID`) — see
  `getTwilioClient()`. Both the `from` and `to` addresses are normalised to Twilio's required `whatsapp:` prefix,
  so `TWILIO_WHATSAPP_FROM` should hold a bare E.164 number.
- `anthropic.js` — AI blog-draft generation via the direct Anthropic API (`@anthropic-ai/sdk`, model
  `claude-sonnet-5`), replacing the old Emergent LLM proxy. System prompt and JSON contract are preserved exactly.
- `outbox.js` — durable webhook queue with HMAC-SHA256 signing. **Keep the header names
  `X-AussieBack-Signature`/`X-AussieBack-Event` exact** — this is a live external CRM integration contract, not
  part of the brand cleanup. Backoff schedule: `[0, 2, 4, 8, 16, 30, 30, 30]` minutes, `MAX_ATTEMPTS = 8`.
- `rateLimit.js` — Postgres-backed rate limiting (`rate_limit_hits` table), since serverless functions have no
  shared in-memory state between invocations. No Redis/Upstash — traffic volume (5-60 req/hour limits) makes a
  `COUNT` query per request trivially cheap.

**Deferred (explicitly out of scope for now, tracked via `TODO(cron)` comments):** the weekly digest, blog
autopilot, and webhook-outbox-retry are all **manual-trigger only** (called from admin UI buttons —
`POST /api/admin/weekly-digest/run`, `/api/admin/autopilot/run`, `/api/admin/outbox/process-now`). There is no
Vercel Cron / node-cron scheduling yet. Don't add automatic scheduling without discussing it first — it was
deliberately deferred.

### Cross-cutting contracts (edit both sides together)

- **Refund math**: `src/lib/server/calculator.js` (authoritative — `SUPER_RATE=0.12`,
  `TAX_RATES={working_holiday:0.65, other_temp:0.35}`) and `src/components/Estimator.jsx`'s `compute()`
  (display-only preview, same constants duplicated). The API route always recomputes server-side on submit and does
  not trust the client's number, but a tax-rate change must still be made in both places to avoid a confusing
  preview-vs-actual mismatch.
- **Pipeline status values**: the `leads.status` check constraint in `0001_init.sql` and `src/lib/format.js`'s
  `STATUS_PIPELINE`/`statusLabel`/`statusBadgeClass`. Adding a stage means editing both.
- **Blog publish → ISR revalidate**: now an in-process `revalidatePath()` call (not an HTTP round-trip) since
  publish and revalidation are the same Next.js process — see the publish route handler under
  `app/api/admin/blog/posts/route.js`.

## Running the project

No `.env.example` exists (env files are gitignored). `.env` (repo root) env vars:

- **Supabase**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose to the browser),
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Email (Resend)**: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (must be on a Resend-verified domain;
  `onboarding@resend.dev` works for testing), `ADMIN_NOTIFICATION_EMAILS`. Leave unset to no-op sends in local dev.
- **WhatsApp (Twilio)**: `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN`, **or** `TWILIO_API_KEY_SID` +
  `TWILIO_API_KEY_SECRET` + `TWILIO_ACCOUNT_SID`; plus `TWILIO_WHATSAPP_FROM` (bare E.164).
- **AI blog drafts**: `ANTHROPIC_API_KEY`.
- **`SITE_URL`** — server-side canonical origin used for email/webhook/sitemap links. Distinct from the client-side
  `REACT_APP_SITE_URL`; if unset it falls back to `https://refundsuper.com.au`, which silently produces wrong links
  on any other deployment.
- **Everything else, unchanged from before the migration**: `WEBHOOK_URL`/`WEBHOOK_SECRET`, `RECAPTCHA_SECRET_KEY`/
  `REACT_APP_RECAPTCHA_SITE_KEY`/`RECAPTCHA_MIN_SCORE`/`RECAPTCHA_ACTION`, `LEAD_RATE_LIMIT`, `INDEXNOW_KEY`/
  `INDEXNOW_ENDPOINT`, `GSC_SERVICE_ACCOUNT_JSON`, `WEEKLY_DIGEST_TZ`/`WEEKLY_DIGEST_ENABLED`,
  `GOOGLE_SITE_VERIFICATION`, `COMMENTS_AUTO_APPROVE`, `REACT_APP_SUPPORT_WHATSAPP`, `REACT_APP_SITE_URL`.

```bash
yarn install
yarn start        # next dev -p 3000 -H 0.0.0.0
```

Other scripts: `yarn build` (`next build` — ESLint errors do **not** fail this build; `eslint.ignoreDuringBuilds:
true` in `next.config.mjs`), `yarn serve` (`next start -p 3000 -H 0.0.0.0`, production server after build).

Before first run against a real environment: apply `supabase/migrations/0001_init.sql` to your Supabase project
(SQL editor or `supabase db push`), then create the one admin user in the Supabase Auth dashboard.

### Tests

No automated frontend tests exist yet (the old FastAPI backend had 199 pytest integration tests; they tested a
system that no longer exists and were not ported — see `memory/PRD.md` for that history). Verification is currently
manual: `curl` smoke checks against `next dev`, plus click-through of the admin UI. If you add tests, Node's built-in
`node --test` runner is the lowest-friction option for pure logic (e.g. `src/lib/server/calculator.js`,
`src/lib/server/referrals.js`) — no new dependency required.

## Notes for future changes

- `memory/PRD.md` is a living product-requirements/changelog doc — check it before non-trivial changes; it records
  the intent and known-deferred issues (e.g. the webhook header naming, one blog slug) from past iterations,
  including the FastAPI→Node.js/Supabase migration itself.
- `react-hook-form`, `zod`, `@hookform/resolvers`, `@tanstack/react-query`, and `recharts` are installed but
  **unused** anywhere in the app (forms are hand-rolled `useState`, data fetching is raw axios/fetch in
  `useEffect`, admin charts are hand-rolled CSS bars). Don't assume a component uses them just because they're
  dependencies; if adding a new form or data-fetching flow, decide deliberately whether to finally adopt them or
  keep matching the existing hand-rolled pattern.
