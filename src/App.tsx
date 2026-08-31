import { Navigate, Route, Routes } from 'react-router-dom';
import { Nav } from './components/Nav';
import { Today } from './screens/Today';
import { Library } from './screens/Library';
import { Review } from './screens/Review';
import { SettingsScreen } from './screens/SettingsScreen';
import { SignIn } from './screens/SignIn';
import { isConfigured } from './lib/supabase';
import { useStore } from './state/store';

export function App() {
  const { authReady, session, toasts, dismissToast } = useStore();

  if (!isConfigured) return <ConfigError />;
  if (!authReady) return <main className="boot">Loading…</main>;
  if (!session) return <SignIn />;

  return (
    <div className="app">
      <Nav />
      <main className="content">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/library" element={<Library />} />
          <Route path="/review" element={<Review />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`toast ${t.kind}`}
            onClick={() => dismissToast(t.id)}
          >
            {t.message}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A build without the two VITE_ values would fail confusingly at the first query. */
function ConfigError() {
  return (
    <main className="boot">
      <div className="signin-card">
        <h1>Not configured</h1>
        <p className="muted">
          <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> are missing
          from this build. Set them in <code>.env</code> locally, or as repository variables for the
          Pages workflow.
        </p>
      </div>
    </main>
  );
}
