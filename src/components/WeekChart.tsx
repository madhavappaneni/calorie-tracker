import { grams, kcal } from '../lib/format';
import { weekdayShort } from '../lib/dates';
import type { Totals } from '../lib/types';

export interface DayRow {
  date: string;
  totals: Totals;
  logged: boolean;
}

/** Seven days of calories as plain CSS bars with a dashed target line, plus a dot
 *  per day for protein-in-band. No chart library (spec §3). */
export function WeekChart({
  days,
  calorieTarget,
  proteinMin,
  proteinMax,
}: {
  days: DayRow[];
  calorieTarget: number;
  proteinMin: number;
  proteinMax: number;
}) {
  // Scale to the target unless a day blew past it, so the target line sits in a
  // consistent place most weeks.
  const peak = Math.max(calorieTarget * 1.15, ...days.map((d) => d.totals.calories), 1);
  const targetLine = (calorieTarget / peak) * 100;

  return (
    <div className="chart" role="img" aria-label={`Daily calories against a ${calorieTarget} calorie target`}>
      <div className="chart-plot">
        <div className="target-line" style={{ bottom: `${targetLine}%` }}>
          <span>{kcal(calorieTarget)}</span>
        </div>
        {days.map((d) => {
          const h = (d.totals.calories / peak) * 100;
          const state = !d.logged
            ? 'empty'
            : d.totals.calories > calorieTarget
              ? 'over'
              : d.totals.calories >= calorieTarget * 0.9
                ? 'good'
                : 'under';
          return (
            <div className="chart-col" key={d.date}>
              <div className="chart-track">
                <div className={`chart-bar ${state}`} style={{ height: `${d.logged ? Math.max(h, 2) : 0}%` }}>
                  {d.logged ? <span className="chart-value">{kcal(d.totals.calories)}</span> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="chart-axis">
        {days.map((d) => (
          <div className="axis-col" key={d.date}>
            <span
              className={`protein-dot ${
                !d.logged
                  ? 'empty'
                  : d.totals.protein_g >= proteinMin && d.totals.protein_g <= proteinMax
                    ? 'good'
                    : 'miss'
              }`}
              title={d.logged ? `${grams(d.totals.protein_g)} g protein` : 'Nothing logged'}
            />
            <span className="chart-label">{weekdayShort(d.date)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
