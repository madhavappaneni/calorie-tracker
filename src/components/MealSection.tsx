import { grams, kcal, servings as fmtServings } from '../lib/format';
import { MEAL_LABELS, sumEntries } from '../lib/types';
import type { Food, LogEntry, Meal } from '../lib/types';

/** One meal on Today: its entries, its running total, and the one-tap quick picks
 *  that make logging a repeat meal a single press (spec §1). */
export function MealSection({
  meal,
  entries,
  picks,
  onAdd,
  onQuick,
  onEdit,
}: {
  meal: Meal;
  entries: LogEntry[];
  picks: Food[];
  onAdd: () => void;
  onQuick: (food: Food) => void;
  onEdit: (entry: LogEntry) => void;
}) {
  const totals = sumEntries(entries);
  return (
    <section className="card meal">
      <header className="meal-head">
        <h2>{MEAL_LABELS[meal]}</h2>
        <span className="muted small">
          {entries.length ? `${kcal(totals.calories)} kcal · ${grams(totals.protein_g)} g P` : '—'}
        </span>
        <button type="button" className="btn small primary" onClick={onAdd}>
          + Add
        </button>
      </header>

      {entries.length > 0 ? (
        <ul className="entry-list">
          {entries.map((e) => (
            <li key={e.id}>
              <button type="button" className="entry" onClick={() => onEdit(e)}>
                <span className="entry-name">
                  {e.name}
                  {Number(e.servings) !== 1 ? (
                    <span className="muted"> × {fmtServings(Number(e.servings))}</span>
                  ) : null}
                </span>
                <span className="entry-macros">
                  {kcal(e.calories)}
                  <span className="muted"> kcal</span> · {grams(e.protein_g)}
                  <span className="muted"> g P</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {picks.length > 0 ? (
        <div className="quick-row">
          <span className="quick-label">Quick</span>
          {picks.map((f) => (
            <button key={f.id} type="button" className="chip quick" onClick={() => onQuick(f)}>
              {f.name}
              <span className="muted"> {kcal(f.calories)}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
