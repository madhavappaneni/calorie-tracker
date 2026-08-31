# calorie-tracker

Single-user calorie and protein tracker — a Vite + React PWA on GitHub Pages with a
Supabase backend. Built to cover only the handful of tracking features actually used
daily; no weight tracking (a Whoop covers that).

See [calorie-tracker-spec.md](calorie-tracker-spec.md) for the v1 build spec and
[RUNBOOK.md](RUNBOOK.md) for project URLs, keys and operational steps.

## Local development

```sh
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev            # http://localhost:5173/calorie-tracker/
npm run build          # typecheck + production build into dist/
npm run preview        # serve dist/ (needed to exercise the service worker)
npm run icons          # regenerate the PWA icons in public/
```

Both env values are public by design — the publishable key grants nothing on its own;
Row Level Security is the authorization layer. The Supabase secret key never lives in
this repo (see spec §5).

## Screens

| Screen | What it does |
|---|---|
| **Today** | Date picker, entries grouped by meal, calories-left and protein-band summary. One-tap "Quick" chips log a repeat meal without leaving the screen. |
| **Add food** | Three paths in one sheet — search the library, scan a barcode, or type it in. Full-screen on a phone, a centred panel on a laptop. |
| **Library** | Search, edit, favourite and delete foods, plus the recipe calculator that turns a weekend batch into one saved food. |
| **Review** | Seven CSS bars of calories vs target, a protein-in-band dot per day, and the week's averages. |
| **Settings** | Targets, JSON export, sign out. |

## Layout

One codebase, three layouts (spec §3.1): a fixed bottom tab bar under 640px, a top nav
and 600px column to 1023px, and a 960px column with the day summary as a sticky right
rail from 1024px up. Verified at 375px and 1440px with no horizontal scroll.

## Repository layout

```
src/
  lib/          supabase client, REST helpers, dates, formatting, Open Food Facts
  state/        session + foods + settings + toasts (one context)
  components/   sheets, forms, scanner, chart, day summary
  screens/      Today, Library, Review, Settings, SignIn
public/         manifest, service worker, generated icons
supabase/       schema.sql — the spec §4 tables and RLS policies
docs/backup-repo/  workflow + restore instructions to copy into the private backup repo
.github/workflows/deploy.yml  builds and publishes to GitHub Pages
```

## Deploying

Push to `main`. The Pages workflow builds with `base: '/calorie-tracker/'` and publishes
via `actions/deploy-pages`. It reads `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` from repository **variables** (Settings → Secrets and
variables → Actions → Variables) and fails loudly if either is missing.

The scheduled backup lives in the private `calorie-tracker-backup` repo — copy the files
in [docs/backup-repo/](docs/backup-repo/) into it and add the two Actions secrets.
