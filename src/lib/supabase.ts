import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Both values are public by design (spec §5): the publishable key grants nothing on
 *  its own — Row Level Security filters every request against the signed-in user. */
export const isConfigured = Boolean(url && key);

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // consumes the magic-link tokens on return
    storageKey: 'calorie-tracker-auth',
  },
});

/** Where magic links come back to — the app's own base URL, in dev or on Pages. */
export const redirectTo = (): string =>
  `${window.location.origin}${import.meta.env.BASE_URL}`;

export function errorMessage(e: unknown): string {
  if (!e) return 'Something went wrong.';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  const m = (e as { message?: unknown }).message;
  return typeof m === 'string' ? m : 'Something went wrong.';
}
