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

## Backlog
- **P1**: Multi-language support (DE, FR, JA, KO, ES), better phone validation (E.164), reCAPTCHA on lead form, rate-limit POST `/api/leads`.
- **P1**: Webhook signature signing (HMAC) for CRM forwarding.
- **P2**: Conversion analytics (funnel drop-off), Hotjar/Plausible embed.
- **P2**: Multi-admin invitations + audit log.
- **P2**: Real TPB-agent partner onboarding form / signed engagement letter PDF.
- **P2**: Stripe success-fee invoicing when status moves to `refund_paid`.
