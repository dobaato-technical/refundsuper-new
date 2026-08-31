# refundmysuper

A lead-generation site for Australian Superannuation (DASP) refund claims, aimed at former working-holiday-makers
and international students who have left Australia. Visitors get a free refund estimate and submit their details as
a lead; an internal admin triages leads through a pipeline and runs an AI-assisted blog for SEO.

Single Next.js 15 (App Router) + React 19 app, with all backend logic as Next.js Route Handlers under `app/api/**`,
backed by Supabase (Postgres) and Supabase Auth. See [CLAUDE.md](./CLAUDE.md) for full architecture notes.

## Getting started

```bash
yarn install
yarn start   # http://localhost:3000
```

Before running against a real environment: apply `supabase/migrations/0001_init.sql` to a Supabase project, create
one admin user via the Supabase Auth dashboard, and populate `.env` (see [CLAUDE.md](./CLAUDE.md#running-the-project)
for the full list of required variables).

## Scripts

- `yarn start` — dev server (`next dev`)
- `yarn build` — production build
- `yarn serve` — run the production build (`next start`)
