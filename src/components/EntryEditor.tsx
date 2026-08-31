import { useState } from 'react';
import { Sheet, ServingStepper, ConfirmButton } from './ui';
import * as api from '../lib/api';
import { grams, kcal, parseNum } from '../lib/format';
import { useStore } from '../state/store';
import { MEALS, MEAL_LABELS } from '../lib/types';
import type { LogEntry, Meal } from '../lib/types';

/** Edit one logged entry: servings, which meal it belongs to, or remove it.
 *  Rescaling keeps the entry's own snapshot — the food's current macros are
 *  deliberately not consulted (spec §4). */
export function EntryEditor({
  entry,
  onClose,
  onChanged,
}: {
  entry: LogEntry;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { reportError, notify } = useStore();
  const [servings, setServings] = useState(String(Number(entry.servings)));
  const [meal, setMeal] = useState<Meal>(entry.meal);
  const [busy, setBusy] = useState(false);

  const count = parseNum(servings) ?? Number(entry.servings);
  const factor = count / Number(entry.servings || 1);

  const save = async () => {
    setBusy(true);
    try {
      if (count !== Number(entry.servings)) await api.updateEntryServings(entry, count);
      if (meal !== entry.meal) await api.moveEntry(entry.id, meal, entry.logged_date);
      onChanged();
      onClose();
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.deleteEntry(entry.id);
      notify(`${entry.name} removed`);
      onChanged();
      onClose();
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={entry.name} subtitle={`Logged to ${MEAL_LABELS[entry.meal].toLowerCase()}`} onClose={onClose}>
      <div className="detail">
        <label className="field">
          <span className="field-label">Servings</span>
          <ServingStepper value={servings} onChange={setServings} />
        </label>

        <ul className="macro-preview">
          <li>
            <span>{kcal(Number(entry.calories) * factor)}</span>kcal
          </li>
          <li>
            <span>{grams(Number(entry.protein_g) * factor)}</span>protein
          </li>
          <li>
            <span>{grams(Number(entry.carbs_g) * factor)}</span>carbs
          </li>
          <li>
            <span>{grams(Number(entry.fat_g) * factor)}</span>fat
          </li>
        </ul>

        <span className="field-label">Meal</span>
        <div className="meal-picker">
          {MEALS.map((m) => (
            <button key={m} type="button" className={m === meal ? 'chip on' : 'chip'} onClick={() => setMeal(m)}>
              {MEAL_LABELS[m]}
            </button>
          ))}
        </div>

        <div className="form-actions">
          <ConfirmButton label="Delete" confirmLabel="Delete for real?" onConfirm={remove} />
          <button type="button" className="btn primary" onClick={save} disabled={busy || count <= 0}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
