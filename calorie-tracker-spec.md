# Personal Macro Tracker — v1 Build Spec

A single-user calorie and protein tracker, built with Vite + React as a static PWA hosted on GitHub Pages, with Supabase as the backend. Free to run indefinitely, no ads, no third-party accounts beyond Supabase and GitHub. This spec is self-contained: a developer (or Claude Code) should be able to build v1 from this document alone.

_Revised 2026-08-30: Vite + React confirmed as the stack; responsive phone + laptop layout specified (§3.1); weight and body-composition tracking removed — a Whoop covers it._

## 1. Purpose and constraints

The owner logs meals daily on a phone, cooks in weekend batches and eats the same meals Monday–Friday, and reviews progress weekly on Sundays. The app replaces commercial trackers by covering only the 20% of features actually used.

Hard constraints:

- $0/month at this usage level, permanently.
- Single user. No public signups, no sharing, no social features.
- Runs well on both a phone and a laptop. Mobile-first, but the laptop layout is a
  designed target, not a stretched phone view (see §3.1). Installable to the phone
  home screen as a PWA.
- Logging a saved food takes 3 taps or fewer from the Today screen.
- Data is backed up automatically off Supabase (see §8).

Weight and body composition are out of scope — a Whoop handles that. No weight table,
no weigh-in screen, no weight trend (see §11).

Default targets (editable in Settings):

- Daily calories: 1,850 (acceptable band 1,800–1,900)
- Daily protein: 140–160 g

## 2. Architecture

```
Phone / browser
   │  HTTPS
   ▼
GitHub Pages (public repo: calorie-tracker)
   static PWA: Vite + React build, no server code
   │  supabase-js with publishable key + user JWT
   ▼
Supabase free tier (Postgres + Auth + auto REST API)
   ▲
   │  REST reads with secret key (from Actions secrets)
GitHub Actions (private repo: calorie-tracker-backup)
   cron: export tables to JSON, commit  ← doubles as keep-alive
```

Two repositories, because GitHub Pages on the free plan only serves public repos, and backups contain personal logs:

- **`calorie-tracker`** (public): the frontend. Deployed to GitHub Pages. Contains no secrets — the Supabase URL and publishable key are in the code by design. This is the existing repo; it must be made public for free Pages hosting.
- **`calorie-tracker-backup`** (private): holds `backups/*.json` plus the scheduled backup workflow. Secrets (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`) live in this repo's Actions secrets.

No custom server anywhere. The frontend talks to Supabase's auto-generated REST API directly; Row Level Security is the authorization layer.

## 3. Tech stack

- Frontend: **Vite + React + TypeScript**, single-page app. React Router for the
  handful of screens. Styling is plain CSS (CSS Modules or one stylesheet with custom
  properties) — no UI framework needed at this size.
- `@supabase/supabase-js` v2 for auth and data. This is a static client-only SPA, so
  do **not** add `@supabase/ssr` / server helpers or any server runtime — there is no
  server. The session persists in `localStorage`; RLS is the only authorization layer.
- `html5-qrcode` for camera barcode scanning (works in mobile and desktop browsers
  over HTTPS; GitHub Pages is HTTPS). Uses the phone's rear camera or a laptop webcam;
  manual entry is always available as a fallback.
- No chart library. The Weekly review's bars are plain CSS/flexbox; any trend line is
  a small inline SVG. (The weight trend that would have justified a chart lib is out
  of scope — Whoop covers weight.)
- PWA: `manifest.json` + service worker that caches the app shell. v1 requires network
  to log (offline write queue is a v2 item, §11).
- Vite `base` is set to `/calorie-tracker/` so asset paths resolve under the project
  Pages URL.
- Env vars: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, read from `.env`
  locally and from repo/Actions config at build time. `.env` is git-ignored;
  `.env.example` is committed. No secret key or PAT in this repo, ever.

### 3.1 Responsive layout

One React codebase, two layouts driven by CSS breakpoints — no separate mobile build.

- **Phone (< 640px):** single column. Fixed bottom tab bar (Today / Library / Review /
  Settings). Cards are full-bleed. Add-food is a full-screen view. Touch targets ≥ 44px.
- **Tablet (640–1023px):** single column, content capped ~600px and centred; nav moves
  to the top.
- **Laptop (≥ 1024px):** content capped ~960px and centred, persistent top nav (no
  bottom bar). Today shows meal groups and the day summary side by side (summary as a
  sticky right rail). Add-food opens as a centred panel/modal over Today rather than a
  full page. Weekly review uses the full width for its 7-day bars.
- Implemented with a few `min-width` media queries (or container queries) over a
  flex/grid shell. Test at 375px and at 1440px; no horizontal scroll at either.

## 4. Data model

Run once in the Supabase SQL editor. All tables carry `user_id` defaulting to `auth.uid()` and enforce owner-only access via RLS.

```sql
create table public.foods (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id),
  name        text not null,
  brand       text,
  barcode     text,                          -- EAN/UPC as scanned, nullable
  serving_desc text not null,                -- "1 cup cooked", "1 bar", "100 g"
  calories    numeric not null,
  protein_g   numeric not null default 0,
  carbs_g     numeric not null default 0,
  fat_g       numeric not null default 0,
  fiber_g     numeric,
  is_favorite boolean not null default false,
  created_at  timestamptz not null default now()
);
create index foods_user_barcode on public.foods (user_id, barcode);

create table public.log_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id),
  logged_date date not null,
  meal        text not null check (meal in ('breakfast','lunch','dinner','snack')),
  food_id     uuid references public.foods(id) on delete set null,
  name        text not null,                 -- snapshot of food name at log time
  servings    numeric not null default 1,
  calories    numeric not null,              -- snapshot totals for this entry
  protein_g   numeric not null,
  carbs_g     numeric not null,
  fat_g       numeric not null,
  created_at  timestamptz not null default now()
);
create index log_user_date on public.log_entries (user_id, logged_date);

create table public.settings (
  user_id        uuid primary key default auth.uid() references auth.users(id),
  calorie_target int not null default 1850,
  protein_min_g  int not null default 140,
  protein_max_g  int not null default 160,
  updated_at     timestamptz not null default now()
);

alter table public.foods       enable row level security;
alter table public.log_entries enable row level security;
alter table public.settings    enable row level security;

create policy "own rows" on public.foods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.log_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Design notes:

- Log entries snapshot name and macros so later edits to a food don't rewrite history.
- Recipes are not a separate relational structure in v1. The Library screen includes a **recipe calculator**: pick ingredient foods and quantities, enter number of servings, and it computes per-serving macros and saves the result as a normal `foods` row (e.g. "Rajma batch, 1 serving"). Relational recipes are a v2 item.

## 5. Authentication

- Supabase Auth with **email magic link** (passwordless). No OAuth providers needed.
- The frontend is initialized with the project URL and the **publishable key** (`sb_publishable_...`). This key is public by design; it grants nothing by itself — every request is filtered by RLS against the signed-in user's JWT, which supabase-js attaches and refreshes automatically. Session persists in the browser, so the phone stays signed in.
- The **secret key** (`sb_secret_...`) bypasses RLS. It appears in exactly one place: the private backup repo's Actions secrets. Never in the frontend, never in the public repo.
- Use the current key types, not the legacy `anon`/`service_role` JWTs (deprecated end of 2026).

One-time Supabase configuration:

1. Auth → URL Configuration: set Site URL to the GitHub Pages URL (`https://madhavappaneni.github.io/calorie-tracker/`) and add it to Redirect URLs, so magic links land back in the app.
2. Create the owner's account by signing in once.
3. Auth → Providers → Email: turn **off** "Allow new users to sign up." RLS remains on regardless (defense in depth).

## 6. Screens and features (v1)

Navigation is a bottom tab bar on phones and a top nav on laptops (§3.1): **Today**,
**Library**, **Review**, **Settings**. Add-food is reached from Today, not the nav.

**Today** (home): date selector defaulting to today; entries grouped by meal; running totals vs targets — calories remaining out of 1,850 and a protein bar toward the 140–160 g band. Primary action: "+ Add" per meal. Tapping a recent/favorite food logs it with one more tap (servings default 1, editable). On laptop the day summary is a sticky right rail; on phone it sits at the top.

**Add food**: three paths in one flow — (a) search my library (favorites and most-logged first), (b) scan barcode (§7), (c) manual entry form. Manual entries save to the library. Full-screen view on phone, centred panel over Today on laptop.

**Library**: list, edit, favorite, delete foods; recipe calculator (see §4 notes).

**Weekly review**: for the selected week — daily calories vs target (7 CSS bars), days protein landed in band, average calories and protein vs target. Built for the Sunday check-in habit. No weight-change line — that lives in Whoop.

**Settings**: edit targets; **Export JSON** button that downloads all three tables (`foods`, `log_entries`, `settings`) as one file (manual backup independent of §8); sign out.

## 7. Barcode flow

1. Scan with `html5-qrcode` (camera permission prompt; HTTPS required — satisfied by Pages). Works with a phone's rear camera or a laptop webcam; if no camera is present or permission is denied, drop straight to the manual-entry form.
2. **Check own library first**: query `foods` where `barcode = scanned`. Hit → jump straight to logging. This makes repeat scans instant and offline-tolerant.
3. Miss → look up Open Food Facts (free, open data, no API key):
   `GET https://world.openfoodfacts.org/api/v2/product/{barcode}?fields=product_name,brands,serving_size,nutriments`
4. **Check the body, not the HTTP status**: OFF returns HTTP 200 with `status: 0` when the barcode isn't in the database. Only `status === 1` is a hit.
5. On a hit, prefill the manual-entry form: `product_name`, `brands`, and nutriments per 100 g (`energy-kcal_100g`, `proteins_100g`, `carbohydrates_100g`, `fat_100g`); default `serving_desc` to "100 g" unless `serving_size` is present. User adjusts serving and saves — the barcode is stored on the food row, so step 2 catches it forever after.
6. On a miss (`status: 0`) or network failure, fall through to the blank manual form with the barcode pre-attached.

Missing nutriment fields are common in OFF; treat every field as optional and let the user fill gaps.

## 8. Automation hooks (GitHub Actions)

### 8.1 Deploy (`calorie-tracker`, public repo)

Standard Pages deployment: build with Vite and publish via `actions/deploy-pages` on push to `main`. The build sets Vite `base` to `/calorie-tracker/` (§3) so hashed asset URLs resolve under the project Pages path. `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are provided to the build as repository **variables** (not secrets — they are public) or hard-coded in a committed `config.ts`.

### 8.2 Backup + keep-alive (`calorie-tracker-backup`, private repo)

One workflow does both jobs. Runs twice a week so the gap between runs (3–4 days) always beats Supabase's 7-day inactivity window — the REST reads count as database activity, so this is also the heartbeat that prevents free-tier pausing even if daily logging lapses (vacation, illness, lost interest for a month).

```yaml
name: backup
on:
  schedule:
    - cron: "0 12 * * 1,4"   # Mon & Thu, 12:00 UTC
  workflow_dispatch:          # manual run button
jobs:
  backup:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - name: Export tables
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}
        run: |
          set -euo pipefail
          mkdir -p backups
          for t in foods log_entries settings; do
            curl -sf "$SUPABASE_URL/rest/v1/$t?select=*" \
              -H "apikey: $SUPABASE_SECRET_KEY" \
              -H "Authorization: Bearer $SUPABASE_SECRET_KEY" \
              -o "backups/$t.json"
            # fail loudly on empty/short output so a broken export can't
            # silently overwrite good backups
            test "$(wc -c < backups/$t.json)" -ge 2
          done
      - name: Commit if changed
        run: |
          git config user.name  "backup-bot"
          git config user.email "actions@users.noreply.github.com"
          git add backups
          git diff --cached --quiet || git commit -m "backup $(date -u +%F)"
          git push
```

Notes:

- Git history of the JSON files provides versioned backups for free — every past state is a commit.
- Verify the auth headers against current Supabase REST docs at build time; if the new opaque secret key isn't accepted in the `Authorization` header by the gateway, the `apikey` header alone carries it.
- Actions email on workflow failure by default; leave that on. A failed backup should be noticed.
- Failure containment: `curl -sf` plus the size check aborts the job before commit, preserving the last good backup.

### 8.3 Restore path (documented, not automated)

If the Supabase project is ever lost: create a new project, run §4 SQL, sign in once to create the user, then bulk-insert each `backups/*.json` (`foods`, `log_entries`, `settings`) via the REST API or SQL editor (rewriting `user_id` to the new account's UUID). Keep these instructions in the backup repo's README.

## 9. Setup checklist (one-time, in order)

1. Create Supabase project (free plan). Run §4 SQL.
2. Configure auth per §5 (URLs, create account, disable signups).
3. Settings → API Keys: copy the publishable key into the app config (`.env` locally, repo variables for CI); create a secret key for the backup repo.
4. Make `calorie-tracker` public; create `calorie-tracker-backup` (private); add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` to `calorie-tracker-backup` Actions secrets.
5. Deploy the app (Vite `base` = `/calorie-tracker/`); confirm the Pages URL matches the auth Site URL.
6. Run the backup workflow manually once (`workflow_dispatch`) and confirm non-empty JSON committed.
7. Install the PWA to the phone home screen; log a real meal end-to-end on both phone and laptop.

## 10. Acceptance checks

- Signed out, a request with only the publishable key returns zero rows from every table.
- Magic link from the Pages URL completes sign-in and returns to the app.
- Logging a favorite food from Today: ≤3 taps.
- Scanning a known packaged item prefills name/brand/macros; scanning it a second time skips OFF and logs from the library.
- OFF miss (`status: 0`) falls through to manual entry without an error state.
- Today totals equal the sum of entry snapshots; editing a food afterward does not change past days.
- Weekly review shows calories vs target per day and protein-in-band count for the chosen week.
- Layout holds at 375px and at 1440px wide: no horizontal scroll; bottom tab bar on phone, top nav on laptop.
- Backup workflow green; `backups/log_entries.json` contains the test entries; a second run with no changes makes no commit.
- App installs as a PWA and loads its shell offline.

## 11. Non-goals (v1) and v2 candidates

Out of scope for v1: weight and body-composition tracking (a Whoop owns that — no table, screen, or trend), multiple users, social features, ads/monetization, native app-store builds, micronutrients beyond fiber, offline write queue, notifications.

v2 candidates, in rough priority order: offline logging queue with sync; relational recipes (edit a batch and recompute); reminder notification if nothing logged by evening; CSV export per week; streak display on Today.
