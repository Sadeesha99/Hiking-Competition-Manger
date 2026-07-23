# Hiking Team Challenge Poonagala 2026 — Scoring App

A mobile-first web app that replaces the paper score sheets: judges enter scores,
everyone else sees a live public leaderboard. Built per `HTC_Poonagala_Scoring_App_Spec.md`.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:5173
```

- **Public leaderboard:** `/` — no login. Teams / Players / Progress tabs, auto-refreshes.
- **Admin:** `/admin` — login required.

### Demo login (local mode)

The app runs in **demo mode** out of the box: all data lives in your browser's
`localStorage` (single device, no backend, works offline). It comes pre-seeded with
the 19 events, their criteria, and 6 sample teams.

```
Email:    admin@htc.local
Password: htc2026        (super-admin)
```

Super-admins can add judge accounts under **Settings**. Use **Settings → Reset
competition** to clear scores / remove the demo teams before the real event.

## What's included

- **Public views:** main team leaderboard (expandable per-event breakdown), individual
  contribution board, progression line chart — all live.
- **Admin:** teams & players CRUD, events & criteria CRUD, per-event **scaling**
  (e.g. score out of 120 → counts as 100), adaptive **score entry** (per-team or
  per-player, time fields auto-compute duration, penalties subtract), draft/finalise
  lock, manual **adjustments** (mandatory reason), full **audit log** (filterable),
  dashboard charts (standings, progression, completion heatmap, per-event, top players,
  adjustments), and **CSV export**.
- **Printable views** (browser Print → Save as PDF): per-event score sheet (filled or
  blank, mirrors the paper layout with signature lines), whole-competition results, and
  a per-team audit report.

## Go multi-device / live across phones (Supabase — free)

Demo mode is single-device. For real multi-device use with a live board, switch to Supabase:

1. Create a free project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run `supabase/schema.sql` (creates tables + RLS: public read, admin write).
3. Copy `.env.example` to `.env` and fill in:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   VITE_SUPER_ADMIN_EMAIL=you@example.com   # optional: which login is super-admin
   ```
4. Create admin logins under **Supabase → Authentication → Users**.
5. Restart `npm run dev`. The app auto-detects the env vars and uses Supabase (with realtime).

## Deploy for free

```bash
npm run build     # outputs to dist/
```

Push to GitHub and import into **Vercel** or **Netlify** (both free, give a public
`*.vercel.app` / `*.netlify.app` URL). Add the same `VITE_*` variables in the host's
environment settings. Every push auto-deploys.

## Tech

React + Vite + TypeScript · Tailwind CSS · Recharts · React Router · Supabase (optional backend).
