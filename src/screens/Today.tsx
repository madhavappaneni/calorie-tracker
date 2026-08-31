import { useCallback, useEffect, useMemo, useState } from 'react';
import { DaySummary } from '../components/DaySummary';
import { AddFood } from '../components/AddFood';
import { EntryEditor } from '../components/EntryEditor';
import { MealSection } from '../components/MealSection';
import { Spinner } from '../components/ui';
import * as api from '../lib/api';
import { addDays, dayLabel, todayISO } from '../lib/dates';
import { perServing, quickPicks } from '../lib/foods';
import { useStore, useTargets } from '../state/store';
import { MEALS, sumEntries } from '../lib/types';
import type { Food, LogEntry, Meal } from '../lib/types';

export function Today() {
  const { foods, usage, notify, reportError, refreshUsage } = useStore();
  const { calorieTarget, proteinMin, proteinMax } = useTargets();
  const [date, setDate] = useState(todayISO);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<Meal | null>(null);
  const [editing, setEditing] = useState<LogEntry | null>(null);

  const load = useCallback(async () => {
    try {
      setEntries(await api.listEntries(date, date));
    } catch (e) {
      reportError(e);
    } finally {
      setLoading(false);
    }
  }, [date, reportError]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const totals = useMemo(() => sumEntries(entries), [entries]);
  const byMeal = useMemo(() => {
    const map = Object.fromEntries(MEALS.map((m) => [m, [] as LogEntry[]])) as Record<Meal, LogEntry[]>;
    for (const e of entries) (map[e.meal] ??= []).push(e);
    return map;
  }, [entries]);

  /** One-tap logging from Today — the ≤3-tap path in spec §1. */
  const quickLog = async (food: Food, meal: Meal) => {
    try {
      await api.logEntry({ date, meal, food, name: food.name, servings: 1, per: perServing(food) });
      notify(`${food.name} added`);
      void load();
      void refreshUsage();
    } catch (e) {
      reportError(e);
    }
  };

  return (
    <div className="today">
      <header className="day-nav">
        <button type="button" className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
          ‹
        </button>
        <div className="day-nav-label">
          <h1>{dayLabel(date)}</h1>
          <input
            type="date"
            value={date}
            max={addDays(todayISO(), 7)}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Pick a date"
          />
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setDate(addDays(date, 1))}
          aria-label="Next day"
          disabled={date >= todayISO()}
        >
          ›
        </button>
        {date !== todayISO() ? (
          <button type="button" className="btn ghost" onClick={() => setDate(todayISO())}>
            Today
          </button>
        ) : null}
      </header>

      <div className="today-layout">
        <div className="today-rail">
          <DaySummary
            totals={totals}
            calorieTarget={calorieTarget}
            proteinMin={proteinMin}
            proteinMax={proteinMax}
            entryCount={entries.length}
          />
        </div>

        <div className="today-meals">
          {loading ? (
            <Spinner label="Loading the day…" />
          ) : (
            MEALS.map((meal) => (
              <MealSection
                key={meal}
                meal={meal}
                entries={byMeal[meal] ?? []}
                picks={quickPicks(foods, usage, meal)}
                onAdd={() => setAdding(meal)}
                onQuick={(f) => quickLog(f, meal)}
                onEdit={setEditing}
              />
            ))
          )}
        </div>
      </div>

      {adding ? (
        <AddFood date={date} meal={adding} onClose={() => setAdding(null)} onLogged={load} />
      ) : null}
      {editing ? (
        <EntryEditor entry={editing} onClose={() => setEditing(null)} onChanged={load} />
      ) : null}
    </div>
  );
}

