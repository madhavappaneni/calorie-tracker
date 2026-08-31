import { useState } from 'react';
import { supabase, redirectTo, errorMessage } from '../lib/supabase';

/** Passwordless magic link (spec §5). Signups are disabled in Supabase, so this only
 *  ever lets the owner back in. */
export function SignIn() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setState('sending');
    setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo(), shouldCreateUser: false },
      });
      if (err) throw err;
      setState('sent');
    } catch (err) {
      setError(errorMessage(err));
      setState('idle');
    }
  };

  return (
    <main className="signin">
      <div className="signin-card">
        <h1>Macros</h1>
        <p className="muted">Calories and protein, nothing else.</p>

        {state === 'sent' ? (
          <div className="signin-sent">
            <p>
              Check <strong>{email}</strong> for the sign-in link. Open it on this device to
              stay signed in here.
            </p>
            <button type="button" className="btn" onClick={() => setState('idle')}>
              Use a different address
            </button>
          </div>
        ) : (
          <form onSubmit={send}>
            <label className="field">
              <span className="field-label">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <button type="submit" className="btn primary block" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
