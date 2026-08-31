# calorie-tracker-backup

Private companion to [`calorie-tracker`](https://github.com/madhavappaneni/calorie-tracker).
Holds `backups/*.json` and the scheduled workflow that writes them. Nothing here is
public: these files are the owner's food log.

Copy `.github/workflows/backup.yml` from this directory into the private repo at the
same path.

## Setup

1. Create `calorie-tracker-backup` as a **private** repo.
2. Add `.github/workflows/backup.yml`.
3. Settings → Secrets and variables → Actions → **Secrets**:
   - `SUPABASE_URL` — `https://<project-ref>.supabase.co`
   - `SUPABASE_SECRET_KEY` — the `sb_secret_...` key from the Supabase dashboard.
     It bypasses RLS, so it lives here and nowhere else.
4. Run the workflow once via **Run workflow** (`workflow_dispatch`) and confirm that
   `backups/foods.json`, `backups/log_entries.json` and `backups/settings.json` were
   committed and are non-empty.

## What it does

Runs Monday and Thursday at 12:00 UTC. The 3–4 day gap always beats Supabase's 7-day
inactivity window, so the REST reads keep the free-tier project awake even if logging
lapses for a month. Git history of the JSON files *is* the versioned backup — every
past state is a commit.

`curl -sf` plus the byte-count check aborts the job before committing, so a broken
export can never overwrite a good backup. Leave Actions' failure emails on: a failed
backup should be noticed.

## Restore (spec §8.3)

If the Supabase project is ever lost:

1. Create a new Supabase project on the free plan.
2. Run the schema from `supabase/schema.sql` in the app repo (SQL editor → Run).
3. Configure auth: Site URL and Redirect URLs set to the Pages URL; sign in once with
   the magic link to create the user; then turn **off** "Allow new users to sign up".
4. Note the new account's UUID (`select id from auth.users;`).
5. Bulk-insert each backup file, rewriting `user_id` to that UUID. Order matters —
   `foods` before `log_entries`, because entries reference food rows:

   ```sh
   NEW_USER_ID=...        # from step 4
   SUPABASE_URL=...       # new project URL
   SUPABASE_SECRET_KEY=... # new project secret key

   for t in foods log_entries settings; do
     jq --arg u "$NEW_USER_ID" 'map(.user_id = $u)' "backups/$t.json" \
       | curl -s "$SUPABASE_URL/rest/v1/$t" \
           -H "apikey: $SUPABASE_SECRET_KEY" \
           -H "Authorization: Bearer $SUPABASE_SECRET_KEY" \
           -H "Content-Type: application/json" \
           -H "Prefer: return=minimal" \
           --data-binary @-
   done
   ```

6. Update the app's `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` repository
   variables and redeploy, then update this repo's Actions secrets to the new project.
