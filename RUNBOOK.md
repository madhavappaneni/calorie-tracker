# Runbook — accessing project resources

Operational reference for the calorie-tracker project. **No secrets in this file** —
the Supabase secret key and any GitHub PAT live in `secrets.local.md` (git-ignored)
and, for CI, in the `calorie-tracker-backup` repo's Actions secrets.

## At a glance

| Resource | Value |
|---|---|
| App repo (public) | https://github.com/madhavappaneni/calorie-tracker |
| Backup repo (private) | `calorie-tracker-backup` — **not created yet** |
| Live app (GitHub Pages) | https://madhavappaneni.github.io/calorie-tracker/ |
| Pages build source | GitHub Actions (`build_type: workflow`) |
| Supabase project ref | `cnmhajuvpifadnrexunb` |
| Supabase URL | https://cnmhajuvpifadnrexunb.supabase.co |
| Supabase dashboard | https://supabase.com/dashboard/project/cnmhajuvpifadnrexunb |
| Owner account | appanenim@gmail.com (magic-link only) |

## Supabase

- **Publishable key** (public by design, safe in frontend/CI): `sb_publishable_MU5dR9L4Wl5l8YfeOaeyHA_wjC5Fk3l`
- **Secret key**: in `secrets.local.md`. Bypasses RLS. Only ever used by the backup
  workflow. Rotate via dashboard → Project Settings → API Keys.
- **Run schema SQL**: dashboard → SQL Editor → paste spec §4 block → Run. (Already done
  for v1 — `foods`, `log_entries`, `settings` exist with RLS on.)
- **Tables**: `foods`, `log_entries`, `settings`. No `weights` table (Whoop covers weight).
- **Auth config**: dashboard → Authentication → URL Configuration. Site URL and Redirect
  URLs must include `https://madhavappaneni.github.io/calorie-tracker/`. New signups are
  disabled under Authentication → Providers → Email.

### Check the API is reachable (publishable key only — RLS should return `[]`)

```sh
set -a; . ./.env; set +a
curl -s "$VITE_SUPABASE_URL/rest/v1/foods?select=*&limit=1" \
  -H "apikey: $VITE_SUPABASE_PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_PUBLISHABLE_KEY"
```

## GitHub

- **Push**: plain `git push` (credentials are configured locally).
- **Repo is public.** Anything committed is world-readable — never commit `.env` or
  `secrets.local.md` (both git-ignored; see `.gitignore`).
- **Actions variables** (Settings → Secrets and variables → Actions → Variables), used
  by the Pages build:
  - `VITE_SUPABASE_URL` = `https://cnmhajuvpifadnrexunb.supabase.co`
  - `VITE_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_MU5dR9L4Wl5l8YfeOaeyHA_wjC5Fk3l`
- **Deploy**: push to `main` → the (Fable-authored) Pages workflow builds with Vite
  (`base: '/calorie-tracker/'`) and publishes via `actions/deploy-pages`.

### Backup repo (to create)

1. Create `calorie-tracker-backup`, **private**.
2. Add the workflow from spec §8.2 (`.github/workflows/backup.yml`).
3. Settings → Secrets and variables → Actions → Secrets:
   - `SUPABASE_URL` = `https://cnmhajuvpifadnrexunb.supabase.co`
   - `SUPABASE_SECRET_KEY` = (from `secrets.local.md`)
4. Run once via `workflow_dispatch`; confirm `backups/*.json` committed.

### One-off admin calls (need a PAT with `repo`; not stored — read from `secrets.local.md` or paste)

```sh
PAT=...   # do not commit
# list Actions variables
curl -s -H "Authorization: Bearer $PAT" \
  https://api.github.com/repos/madhavappaneni/calorie-tracker/actions/variables
# Pages status
curl -s -H "Authorization: Bearer $PAT" \
  https://api.github.com/repos/madhavappaneni/calorie-tracker/pages
```

## Local development

```sh
npm install
cp .env.example .env        # already populated locally with the two VITE_ values
npm run dev                 # Vite dev server
npm run build && npm run preview
```

`.env` holds only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Secret hygiene

- `secrets.local.md` — git-ignored stash of the Supabase secret key + GitHub PAT +
  rotation instructions.
- Both were shared in chat during setup → **rotate once the backup repo is wired up.**
- After rotating: update `secrets.local.md`, the `calorie-tracker-backup` Actions
  secrets, and revoke the old PAT.
