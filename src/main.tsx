import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { StoreProvider } from './state/store';
import { supabase } from './lib/supabase';
import './index.css';

// HashRouter, not BrowserRouter: GitHub Pages serves no SPA fallback for deep links.
// No StrictMode — its double-mount restarts the camera scanner mid-start in dev.

/** A magic link lands back here carrying its tokens in the hash (or ?code= under PKCE). */
const isAuthCallback = /[#&?](access_token|refresh_token|error_description|code)=/.test(
  window.location.href,
);

async function boot() {
  // supabase-js parses that URL asynchronously. Render first and HashRouter would
  // rewrite the hash to "#/" before it ever gets read, silently dropping the
  // sign-in. getSession() resolves only after the URL has been consumed.
  if (isAuthCallback) {
    try {
      await supabase.auth.getSession();
    } catch {
      /* fall through to the sign-in screen */
    }
  }

  createRoot(document.getElementById('root')!).render(
    <HashRouter>
      <StoreProvider>
        <App />
      </StoreProvider>
    </HashRouter>,
  );
}

void boot();

// App-shell caching only (spec §3): v1 still needs the network to log.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* an unregistered SW just means no offline shell */
    });
  });
}
