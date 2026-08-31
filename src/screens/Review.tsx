import { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner } from '../components/ui';
import { WeekChart } from '../components/WeekChart';
import type { DayRow } from '../components/WeekChart';
import * as api from '../lib/api';
import { addDays, monthDay, todayISO, weekDays, weekLabel, weekStart } from '../lib/dates';
import { grams, kcal } from '../lib/format';
import { useStore, useTargets } from '../state/store';
import { sumEntries } from '../lib/types';
import type { LogEntry } from '../lib/types';

/** The Sunday check-in (spec §6): seven plain CSS bars, no chart library. */
export function Review() {
  const { reportError } = useStore();
  const { calorieTarget, proteinMin, proteinMax } = useTargets();
  const [start, setStart] = useState(() => weekStart(todayISO()));
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(await api.listEntries(start, addDays(start, 6)));
    } catch (e) {
      reportError(e);
    } finally {
      setLoading(false);
    }
  }, [start, reportError]);

  useEffect(() => {
    void load();
  }, [load]);

  const days: DayRow[] = useMemo(() => {
    const byDate = new Map<string, LogEntry[]>();
    for (const e of entries) {
      const list = byDate.get(e.logged_date) ?? [];
      list.push(e);
      byDate.set(e.logged_date, list);
    }
    return weekDays(start).map((date) => {
      const list = byDate.get(date) ?? [];
      return { date, totals: sumEntries(list), logged: list.length > 0 };
    });
  }, [entries, start]);

  const logged = days.filter((d) => d.logged);
  const inBand = logged.filter(
    (d) => d.totals.protein_g >= proteinMin && d.totals.protein_g <= proteinMax,
  ).length;
  const avgCal = logged.length ? logged.reduce((s, d) => s + d.totals.calories, 0) / logged.length : 0;
  const avgProtein = logged.length
    ? logged.reduce((s, d) => s + d.totals.protein_g, 0) / logged.length
    : 0;

  const isCurrentWeek = start === weekStart(todayISO());

  return (
    <div className="review">
      <header className="screen-head">
        <h1>Review</h1>
        <div className="head-actions">
          <button type="button" className="icon-btn" onClick={() => setStart(addDays(start, -7))} aria-label="Previous week">
            ‹
          </button>
          <span className="week-label">{weekLabel(start)}</span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setStart(addDays(start, 7))}
            aria-label="Next week"
            disabled={isCurrentWeek}
          >
            ›
          </button>
        </div>
      </header>
      <p className="muted small week-range">
        {monthDay(start)} – {monthDay(addDays(start, 6))}
      </p>

      {loading ? (
        <Spinner label="Loading the week…" />
      ) : (
        <>
          <section className="card chart-card">
            <WeekChart
              days={days}
              calorieTarget={calorieTarget}
              proteinMin={proteinMin}
              proteinMax={proteinMax}
            />
            <p className="muted small legend">
              Bar: calories vs {kcal(calorieTarget)} target. Dot: protein inside the {proteinMin}–
              {proteinMax} g band.
            </p>
          </section>

          <section className="stat-grid">
            <div className="card stat">
              <p className="stat-value">
                {inBand}
                <span className="muted">/{logged.length || 0}</span>
              </p>
              <p className="stat-label">Days protein in band</p>
            </div>
            <div className="card stat">
              <p className="stat-value">{logged.length ? kcal(avgCal) : '—'}</p>
              <p className="stat-label">
                Avg calories
                {logged.length ? (
                  <span className={avgCal > calorieTarget ? 'delta over' : 'delta good'}>
                    {avgCal > calorieTarget ? '+' : '−'}
                    {kcal(Math.abs(avgCal - calorieTarget))}
                  </span>
                ) : null}
              </p>
            </div>
            <div className="card stat">
              <p className="stat-value">{logged.length ? `${grams(avgProtein)} g` : '—'}</p>
              <p className="stat-label">
                Avg protein
                {logged.length ? (
                  <span
                    className={
                      avgProtein >= proteinMin && avgProtein <= proteinMax ? 'delta good' : 'delta over'
                    }
                  >
                    target {proteinMin}–{proteinMax}
                  </span>
                ) : null}
              </p>
            </div>
            <div className="card stat">
              <p className="stat-value">
                {logged.length}
                <span className="muted">/7</span>
              </p>
              <p className="stat-label">Days logged</p>
            </div>
          </section>

          <section className="card day-table">
            {days.map((d) => (
              <div className="day-row" key={d.date}>
                <span className="day-row-date">{monthDay(d.date)}</span>
                <span className="day-row-macros">
                  {d.logged ? (
                    <>
                      {kcal(d.totals.calories)} kcal · {grams(d.totals.protein_g)} g P
                    </>
                  ) : (
                    <span className="muted">nothing logged</span>
                  )}
                </span>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
