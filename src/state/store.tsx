import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, errorMessage } from '../lib/supabase';
import * as api from '../lib/api';
import { addDays, todayISO } from '../lib/dates';
import type { Usage } from '../lib/api';
import type { Food, Settings } from '../lib/types';

/** Recency window for the "most-logged first" ordering in the food picker. */
const USAGE_WINDOW_DAYS = 90;

export interface Toast {
  id: number;
  message: string;
  kind: 'info' | 'error';
}

interface Store {
  session: Session | null;
  user: User | null;
  authReady: boolean;
  settings: Settings | null;
  foods: Food[];
  usage: Usage;
  dataReady: boolean;
  refreshFoods: () => Promise<void>;
  refreshUsage: () => Promise<void>;
  setSettings: (s: Settings) => void;
  toasts: Toast[];
  notify: (message: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;
  reportError: (e: unknown) => void;
}

const StoreContext = createContext<Store | null>(null);

const emptyUsage = (): Usage => ({
  total: {},
  byMeal: { breakfast: {}, lunch: {}, dinner: {}, snack: {} },
});

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [foods, setFoods] = useState<Food[]>([]);
  const [usage, setUsage] = useState<Usage>(emptyUsage);
  const [dataReady, setDataReady] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const notify = useCallback((message: string, kind: Toast['kind'] = 'info') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const reportError = useCallback((e: unknown) => notify(errorMessage(e), 'error'), [notify]);

  useEffect(() => {
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!alive) return;
        setSession(data.session);
        setAuthReady(true);
      })
      .catch(() => alive && setAuthReady(true));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setAuthReady(true);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;
  const userId = user?.id ?? null;

  const refreshFoods = useCallback(async () => {
    setFoods(await api.listFoods());
  }, []);

  const refreshUsage = useCallback(async () => {
    setUsage(await api.foodUsage(addDays(todayISO(), -USAGE_WINDOW_DAYS)));
  }, []);

  useEffect(() => {
    if (!userId) {
      setFoods([]);
      setUsage(emptyUsage());
      setSettings(null);
      setDataReady(false);
      return;
    }
    let alive = true;
    setDataReady(false);
    (async () => {
      try {
        const [f, s, u] = await Promise.all([
          api.listFoods(),
          api.getSettings(userId),
          api.foodUsage(addDays(todayISO(), -USAGE_WINDOW_DAYS)),
        ]);
        if (!alive) return;
        setFoods(f);
        setSettings(s);
        setUsage(u);
      } catch (e) {
        if (alive) reportError(e);
      } finally {
        if (alive) setDataReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, reportError]);

  const value = useMemo<Store>(
    () => ({
      session,
      user,
      authReady,
      settings,
      foods,
      usage,
      dataReady,
      refreshFoods,
      refreshUsage,
      setSettings,
      toasts,
      notify,
      dismissToast,
      reportError,
    }),
    [
      session, user, authReady, settings, foods, usage, dataReady,
      refreshFoods, refreshUsage, toasts, notify, dismissToast, reportError,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

/** Targets always resolve, even before the settings row loads (spec §1 defaults). */
export function useTargets() {
  const { settings } = useStore();
  return {
    calorieTarget: settings?.calorie_target ?? 1850,
    proteinMin: settings?.protein_min_g ?? 140,
    proteinMax: settings?.protein_max_g ?? 160,
  };
}
