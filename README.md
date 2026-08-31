# calorie-tracker

Single-user calorie and protein tracker — a Vite + React PWA on GitHub Pages with a
Supabase backend. Built to cover only the handful of tracking features actually used
daily; no weight tracking (a Whoop covers that).

See [calorie-tracker-spec.md](calorie-tracker-spec.md) for the full v1 build spec:
architecture, data model, auth, screens, barcode flow, and backup automation.

## Local development

```sh
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

Both env values are public by design — the publishable key grants nothing on its own;
Row Level Security is the authorization layer. The Supabase secret key never lives in
this repo (see spec §5).
