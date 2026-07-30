# AussieBack — Product Requirements (Living Doc)

## Original Problem Statement
Build a high-converting lead-magnet platform that captures the "Returning Temporary Resident" market — backpackers, students and working-holiday-makers who have left Australia and have unclaimed superannuation. Provide a friction-free experience: a quick refund estimate first, then capture name/email/WhatsApp, then ask for super fund details. Compute refund using ATO DASP tax rates (Working Holiday 417/462 → keep 35%; Student/Other Temp visas → keep 65%). Forward leads to a CRM webhook. Comply with TPB tax-agent regulations (lead/facilitation positioning).

## Personas
1. **Backpacker (WHM 417/462)** — 20–30 yrs old, returned home, mobile-first, multilingual. Wants quick cash with no paperwork.
2. **Returning Student (Visa 500)** — left after study, often retains larger super. Cares about safety & legitimacy.
3. **Admin / Ops** — internal team triaging leads through pipeline stages: New Estimate → Contacted → Documents Received → Submitted to ATO → Refund Paid.

## Architecture (v1)
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

## Backlog
- **P1**: Multi-language support (DE, FR, JA, KO, ES), better phone validation (E.164), reCAPTCHA on lead form, rate-limit POST `/api/leads`.
- **P1**: Webhook signature signing (HMAC) for CRM forwarding.
- **P2**: Conversion analytics (funnel drop-off), Hotjar/Plausible embed.
- **P2**: Multi-admin invitations + audit log.
- **P2**: Real TPB-agent partner onboarding form / signed engagement letter PDF.
- **P2**: Stripe success-fee invoicing when status moves to `refund_paid`.
