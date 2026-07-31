# AussieBack — Product Requirements (Living Doc)

## Original Problem Statement
Build a high-converting lead-magnet platform that captures the "Returning Temporary Resident" market — backpackers, students and working-holiday-makers who have left Australia and have unclaimed superannuation. Provide a friction-free experience: a quick refund estimate first, then capture name/email/WhatsApp, then ask for super fund details. Compute refund using ATO DASP tax rates (Working Holiday 417/462 → keep 35%; Student/Other Temp visas → keep 65%). Forward leads to a CRM webhook. Comply with TPB tax-agent regulations (lead/facilitation positioning).

## Personas
1. **Backpacker (WHM 417/462)** — 20–30 yrs old, returned home, mobile-first, multilingual. Wants quick cash with no paperwork.
2. **Returning Student (Visa 500)** — left after study, often retains larger super. Cares about safety & legitimacy.
3. **Admin / Ops** — internal team triaging leads through pipeline stages: New Estimate → Contacted → Documents Received → Submitted to ATO → Refund Paid.

## Architecture (v2 — Feb 2026)
- **Frontend:** **Next.js 15 (App Router)** + React 19 + Tailwind + Shadcn UI + Framer Motion + Lucide
    - Server-rendered `/`, `/blog`, `/blog/[slug]` (SSR for full-HTML Googlebot indexing)
    - Client components for interactive UI (`Estimator`, `Comments`, `AdminGuard`, admin console)
    - Metadata + JSON-LD via Next `metadata` export (+ per-post `generateMetadata`)
    - Env compat: `next.config.mjs` re-exports `REACT_APP_*` to preserve legacy references
- **Backend:** FastAPI + Motor (Mongo async) + Passlib (bcrypt) + python-jose (JWT) + APScheduler (weekly digest + weekly blog autopilot)
- **DB:** MongoDB (collections: `leads`, `admins`, `share_events`, `blog_posts`, `comments`, `settings`, `autopilot_queue`)
- **Integrations (stubbed, env-configurable):** Twilio WhatsApp, Resend, generic webhook (Zapier/Make), Claude Sonnet 4.6 (Blog Autopilot — live)

### Ingress Rules (production runbook)
Because Next.js and FastAPI live on different pods, the Kubernetes ingress must route these paths to the **backend** (port 8001), not the frontend (port 3000):

| Path                  | Route to | Why |
|-----------------------|----------|-----|
| `/api/*`              | backend  | All FastAPI endpoints |
| `/sitemap.xml`        | backend  | Dynamically generated using live blog slugs + configured `site_url` |
| `/robots.txt`         | backend  | Uses configured `site_url` for the `Sitemap:` directive |
| `/google*.html`       | backend  | Google Search Console file-verification token endpoint |

All other paths continue to route to the Next.js frontend. In preview, `/robots.txt` currently returns the static file in `public/`; that's fine for indexing but production **must** add the rules above so the dynamic backend endpoints are reachable (or use DNS-TXT verification for Search Console as a workaround).

## Original Architecture (v1 — pre-Feb 2026, kept for history)
- **Frontend:** React 19 + CRA + Tailwind + Shadcn UI + Framer Motion + Lucide
- **Backend:** FastAPI + Motor (Mongo async) + Passlib (bcrypt) + python-jose (JWT)
- **DB:** MongoDB (collections: `leads`, `admins`)
- **Integrations (stubbed, env-configurable):** Twilio WhatsApp, Resend (lead + admin email), Generic webhook (Zapier/Make)

## Implemented (Feb 2026)
- [x] Landing page — hero, trust marquee, "How it works", testimonials, FAQ, final CTA, footer with TPB disclaimer
- [x] 3-step progressive estimator (visa → balance/earnings-slider → blurred-gate contact reveal → super fund + departure date)
- [x] Live refund preview + count-up animation on reveal
- [x] Backend: POST `/api/estimate`, POST `/api/leads`
- [x] Admin: JWT login (seeded `admin@aussieback.com` / `Admin@123`)
- [x] Admin dashboard: stats cards, lead table, search + status filter, status pipeline (5 stages), lead detail modal, CSV export
- [x] Integration stubs (WhatsApp, email, webhook) — drop in env vars to enable

## Implemented (Jul 2026 — Iteration 2)
- [x] **E.164 phone validation** — backend via `phonenumbers`, frontend via `libphonenumber-js`. Inline error UI + normalized to E.164 before persistence.
- [x] **Google reCAPTCHA v3** — stubbed (no keys). Backend `verify_recaptcha` dependency + frontend `useRecaptcha('leads')` + conditional `GoogleReCaptchaProvider` mount. Drop in `RECAPTCHA_SECRET_KEY` + `REACT_APP_RECAPTCHA_SITE_KEY` to activate.
- [x] **Rate limiting** — 5 leads / hour / IP on POST `/api/leads` via `slowapi` (`LEAD_RATE_LIMIT` env, default `5/hour`). Returns 429 with friendly message.
- [x] **i18n scaffolding** — `react-i18next` + `i18next` + browser language detector. All landing/estimator/footer copy centralized in `/i18n/locales/en.json`. Language switcher in header (currently only EN — add new lang by dropping a JSON file & registering it in `/i18n/index.js`).

## Implemented (Jul 2026 — Iteration 3)
- [x] **Refund Share Card** — after submission, users can open a canvas-rendered 1080×1350 PNG summary card (`ShareCardModal`) and Download / Web-Share / Copy-Link. Native share invokes WhatsApp/Instagram/etc on mobile; falls back to download on desktop.
- [x] **Live Chat Widget** — floating WhatsApp button (bottom-right of landing) linked via `wa.me/<REACT_APP_SUPPORT_WHATSAPP>` with pre-filled greeting. After 20s of inactivity, a nudge bubble pops up. Dismissable.

## Implemented (Jul 2026 — Iteration 4)
- [x] **Referral Tracking** — every submitted lead now gets a unique 8-char referral_code (alphabet excludes 0/O/1/I). URLs like `/?ref=CODE` capture the code to localStorage `ab_ref` and forward it as `referred_by_code` on the next submission. Backend resolves it to `referred_by_lead_id`. Lead detail modal shows both.
- [x] **Share Analytics** — new `POST /api/share-events` and admin collection `share_events`. ShareCardModal fires an event on each Download/Native/Copy/Story Download. Admin dashboard renders a Share Channels breakdown card + Top Referrers table.
- [x] **Instagram Story preset** — Feed (1080×1350) / Story (1080×1920) toggle in ShareCardModal. Story downloads are tracked as `story_download` channel; button label switches to "Download Story".

## Implemented (Jul 2026 — Iteration 5)
- [x] **Referral Reward Tier** — public `GET /api/referrals/{code}/progress` (rate-limited 60/hr) returns 4-tier ladder (1→Priority WhatsApp support, 3→Free premium claim review, 5→$50 travel voucher, 10→Full concierge claim). ShareCardModal renders "Your Reward Progress" with unlocked ✓ / locked 🔒 rows + `X more = <next reward>` copy.
- [x] **Landing Ref Banner** — `RefBanner` component fetches `GET /api/referrals/{code}` (public) and warmly greets visitors with "<Name> invited you — get a free expert review on us." Dismissable.
- [x] **Weekly Analytics Email** — APScheduler cron job (Mon 09:00 Australia/Sydney) calls `send_weekly_digest()`; body includes new-lead count, pipeline $, top share channel and top 3 referrers. Admin can trigger manually via `POST /api/admin/weekly-digest/run` + "Run digest" button in dashboard. STUB-logs (with PII redacted) when Resend keys absent.
- [x] **UTM Passthrough** — `utm_source/medium/campaign` captured from URL to localStorage `ab_utm` and forwarded on POST /api/leads. Admin analytics returns `utm_sources` aggregation; dashboard renders a UTM Sources card.

## Implemented (Jul 2026 — Iteration 6)
- [x] **Blog section** — 6 SEO-optimised seed articles (DASP guide, Working Holiday 417/462, Student 500, UK backpackers, 5 mistakes, JP case study). Public `/api/blog/posts` (with category/tag filters) + `/api/blog/posts/{slug}`. `/blog` list + `/blog/:slug` detail routes.
- [x] **Blog lead capture** — inline `BlogCTA` card at bottom of every article + sticky sidebar "Estimate your refund" widget that scrolls the visitor straight into the funnel via `/#estimator`.
- [x] **SEO overhaul** — react-helmet-async powered per-page `<SEO>` component injecting title/description/canonical/OG/Twitter/JSON-LD. Landing exposes FAQPage schema; Blog list exposes Blog schema; Blog posts expose BlogPosting schema. Global Organization + WebSite schema in index.html. robots.txt + sitemap.xml served from /public. Keyword-rich titles/H1s targeting "australian super refund", "DASP", "super back australia", "working holiday super refund".

## Implemented (Jul 2026 — Iteration 7)
- [x] **Google Search Console plumbing** — env-driven `SITE_URL` + `GOOGLE_SITE_VERIFICATION`. `/api/site-config` endpoint exposes them; `<SEO>` fetches once and injects `<meta name="google-site-verification">` when set. Root-level `/sitemap.xml` and `/robots.txt` now dynamically served by backend using the real domain + live blog slugs. `/google<token>.html` verification-file endpoint implemented (note: preview ingress does not route this to backend — production ingress must add the rule, or use DNS TXT method).
- [x] **Threaded comments on blog posts** — public `POST/GET /api/blog/posts/{slug}/comments` (rate-limited 10/hr), moderation-ready via `COMMENTS_AUTO_APPROVE` env flag. Admin endpoints for listing all + approving + deleting. Author email never leaked in public responses. `<Comments>` UI at the bottom of every article with reply threading.
- [x] **Auto-Article Generator** — Admin `/admin/blog` studio page. Enter topic + keywords → Claude Sonnet 4.6 (via Emergent LLM key + emergentintegrations) drafts a 500-900 word markdown article with H2/lists/CTA. Admin edits inline and 1-click publishes to `/blog/{slug}`. Defensive JSON parsing returns 502 with a clear message when the model deviates from the schema.

## Implemented (Jul 2026 — Iteration 8)
- [x] **Real-Domain Cutover panel** — `settings.site_config` singleton (DB > env). New admin endpoints `GET/PUT /api/admin/site-settings`. Blog Studio has a "Site settings" card to edit Site URL + Google verification token without a redeploy. `_effective_site_settings()` now feeds `/api/site-config`, `/sitemap.xml`, `/robots.txt` and `/google<token>.html`.
- [x] **Comment Moderation UI** — new `/admin/comments` page listing all comments with filter chips (all / pending / approved), Approve + Delete actions, links back to the source article. "Comments" button added to admin dashboard toolbar.
- [x] **Bulk Article Autopilot** — new `settings.autopilot` config + `autopilot_queue` collection. Weekly APScheduler cron (Mon 10:00 Australia/Sydney) pops one queued topic and publishes it via Claude Sonnet. Admin can Add/Remove queue items, toggle enable/pause, and manually "Run now" from the Blog Studio "Content Autopilot" card.

## Implemented (Feb 2026 — Iteration 12: Resend live + Outbox UI + ISR revalidation)
- [x] **Resend Email activated** — `RESEND_API_KEY` and `RESEND_FROM_EMAIL=hello@aussieback.com` in backend `.env`. Send path fires on every lead creation and is wrapped in try/except so a Resend outage never breaks lead capture. **⚠️ Domain `aussieback.com` is NOT yet verified in Resend** — sends currently fail with `not authorized to send emails from aussieback.com`. Verify the domain in the Resend dashboard to activate delivery. User opted out of `ADMIN_NOTIFICATION_EMAILS` (admin new-lead alerts skipped).
- [x] **Outbox Admin UI** at `/admin/outbox` — three count cards (pending / delivered / dead), filter chips, "Flush now" toolbar button, table with per-row copy / retry / delete icons, row-click opens a Dialog showing the full JSON payload sent to the CRM. Auto-refreshes every 15s. New "Outbox" toolbar button on `/admin` dashboard links straight to it. Guard: `force_retry` refuses to reset `status=success` rows (prevents accidental double-send).
- [x] **Next.js ISR revalidation** — new `POST /api/revalidate` route on the Next.js dev server (port 3000), guarded by shared `REVALIDATE_SECRET`. Backend hits it automatically from BOTH the manual publish endpoint (`POST /api/admin/blog/posts`) and the autopilot cron. Revalidates `/`, `/blog`, and `/blog/{slug}` so new articles appear on the live site in **~200ms** instead of waiting for the 60-second ISR window. Full pipeline verified: publish → `IndexNow ping status=202` + `[REVALIDATE] status=200` both logged, article visible on preview immediately.
- [x] Testing: 16/16 backend tests pass in `test_iteration12.py`, full frontend UI validated.
- **⚠️ SKIPPED per user**: Twilio WhatsApp, GSC service-account JSON (both still stubbed).
- [x] **IndexNow live** — Auto-generated `INDEXNOW_KEY` stored in backend `.env`, key-verification file served at `/{key}.txt`. Every blog publish + autopilot cron auto-fires `POST https://api.indexnow.org/indexnow` (**verified: returns 202 Accepted** for Bing/Yandex/DuckDuckGo/Naver). Manual re-fire: `POST /api/admin/blog/ping-search-engines[?slug=<slug>]`.
- [x] **Custom CRM webhook wired** — `WEBHOOK_URL=https://flowtax.io/api/lead-webhook/intake?org_id=…&token=…` (bearer token embedded in query string, HMAC signing intentionally disabled). Verified live delivery to flowtax.io for `share_event.created` and `lead.status_changed` events (HTTP 2xx on first attempt).
- [x] **Durable webhook outbox** — new `webhook_outbox` collection + `services/outbox.py`. `send_webhook()` now enqueues rows synchronously (pymongo) instead of firing HTTP directly. APScheduler `webhook_outbox_retry` job runs every minute, POSTs up to 25 due rows per tick. Exponential backoff (2, 4, 8, 16, 30, 30, 30 min) up to 8 attempts, then row marked `status=dead` for manual retry. Admin API:
    - `GET /api/admin/outbox?status=pending|success|dead` — list rows + status counts
    - `POST /api/admin/outbox/process-now` — flush the retry loop synchronously
    - `POST /api/admin/outbox/{id}/retry` — reset a `dead` row back to `pending` for another try
    - `DELETE /api/admin/outbox/{id}` — purge (e.g. old success rows)
  Idempotency preserved: same-status PATCH still returns `{unchanged: true}` and does NOT enqueue.
- [x] **Backend router split** — `server.py` shrunk from ~1300 lines to ~140. Now organised as:
    - `deps.py` — shared config, DB collections, auth helpers, limiter, `effective_site_settings()`
    - `models.py` — all Pydantic models
    - `integrations.py` — Twilio, Resend, HMAC-signed webhook, IndexNow, Google Search Console API
    - `services/{calculator,referrals,blog,digest}.py` — pure business logic
    - `routes/{leads,admin,blog_public,admin_blog,seo}.py` — per-domain APIRouter groups
    - `server.py` — FastAPI bootstrap, CORS, startup indexes+seed, APScheduler cron
  All endpoint URLs + response shapes remain identical (100% regression coverage in iteration_10.json).
- [x] **HMAC-signed CRM webhook** (`WEBHOOK_URL`, `WEBHOOK_SECRET`) — fires on **every** lead created, lead status changed, comment created, and share event created. Payload envelope: `{event, id, occurred_at, data, previous?}`. Signature header: `X-AussieBack-Signature: sha256=<64-hex>` (GitHub/Stripe convention) — HMAC-SHA256 over the raw body. Additional `X-AussieBack-Event` header for easy routing. Zapier / Zoho / Hubspot / Salesforce compatible. Comment payloads have `author_email` redacted. Idempotency: status PATCH with the same status returns `{unchanged: true}` and does NOT fire a webhook.
- [x] **Live search-engine ping** — On blog post publish (`POST /api/admin/blog/posts`) AND on autopilot cron publish, a background task pings:
    - **IndexNow** (Bing, Yandex, DuckDuckGo, Naver — re-crawls in ~15 min). Requires `INDEXNOW_KEY` env var + serves `/{key}.txt` verification file via the seo router.
    - **Google Search Console API** — Requires `GSC_SERVICE_ACCOUNT_JSON` env (full service-account JSON string) and the service-account email added as an owner in Search Console. Uses `google-api-python-client` + `google-auth` (lazy imports).
  Manual re-ping: `POST /api/admin/blog/ping-search-engines?slug=<slug>` (or omit slug to ping ALL posts). Both integrations no-op cleanly with `[STUB]` logs when their keys are unset.
- [x] **SSR Migration to Next.js 15 App Router** — full frontend re-scaffolded. `app/page.jsx` (Landing, client), `app/blog/page.jsx` (SSR list, `revalidate: 60s`), `app/blog/[slug]/page.jsx` (SSR post w/ `generateMetadata` per slug + `notFound()`), `app/admin/*` (client + `AdminGuard`). React Router → `next/link` + `next/navigation`. React Helmet → Next `metadata` API. Google-site-verification injected at runtime by `<SiteVerification>` client component. `next.config.mjs` re-exports `REACT_APP_*` env vars so existing code paths keep working. Server-side `apiFetch` proxies to internal backend when `INTERNAL_BACKEND_URL` is set. Hero image + H1 + article body all render in initial HTML (validated via `curl` grep).
- [x] **Autopilot Requeue** — `POST /api/admin/autopilot/queue/{id}/requeue` — returns 400 for non-failed items, 200 + resets status to `queued` (also clears `error`, `finished_at`, `started_at`). Blog Studio queue list surfaces failed items in a red-tinted row with a "Requeue" button (with spinner) alongside the existing delete action.
- [x] **Delete Confirm on Comment Moderation** — `/admin/comments` "Delete" now opens a Shadcn `AlertDialog` showing the author name, first 3 lines of the comment body, and the affected `/blog/{slug}`. Cancel + Confirm both disabled while a delete is in flight.
- [x] **PRD Ingress Rules** — see the Ingress Rules table above.
## Implemented (Feb 2026 — Iteration 11: Durable outbox + live integrations turned on)
- **P0**: Real domain migration — update `SITE_URL` in prod .env and register at Google Search Console (DNS TXT verification recommended over HTML-file for the preview environment).
- **P1**: Un-stub Twilio WhatsApp + Resend Email + reCAPTCHA (all currently keyed as env-configurable stubs — user opted to skip in iter 11).
- **P1**: Configure `GSC_SERVICE_ACCOUNT_JSON` so Google Search Console gets pinged alongside IndexNow (currently IndexNow-only in prod).
- **P2**: Admin Outbox UI — visual list of pending/dead webhook rows with one-click retry (endpoints exist, no UI panel yet).
- **P2**: Rate-limit `GET /api/blog/posts/{slug}/comments` to prevent scraping.

## Backlog
- **P0**: Verify `aussieback.com` in the Resend dashboard so `hello@aussieback.com` sender can actually deliver (currently returns "not authorized").
- **P1**: Un-stub Twilio WhatsApp notification (still stubbed — user deferred).
- **P1**: Configure `GSC_SERVICE_ACCOUNT_JSON` so Google Search Console gets pinged alongside IndexNow.
- **P1**: Move `_revalidate_nextjs` HTTP call from sync `requests` inside a coroutine to `asyncio.to_thread` or `httpx.AsyncClient` — currently OK because it's only called from BackgroundTasks (threadpool) but should be cleaned up before scaling.
- **P2**: Rate-limit `GET /api/blog/posts/{slug}/comments` to prevent scraping.

## Older Backlog (still valid)
- **P1**: Multi-admin invitations + audit log.
- **P2**: Conversion analytics (funnel drop-off), Hotjar/Plausible embed.
- **P2**: Real TPB-agent partner onboarding form / signed engagement letter PDF.
- **P2**: Stripe success-fee invoicing when status moves to `refund_paid`.
