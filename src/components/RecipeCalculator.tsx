import { useMemo, useState } from 'react';
import { Sheet, Field, NumberInput } from './ui';
import * as api from '../lib/api';
import { grams, kcal, parseNum, round } from '../lib/format';
import { rankFoods } from '../lib/foods';
import { useStore } from '../state/store';
import type { Food } from '../lib/types';

interface Row {
  key: number;
  foodId: string;
  qty: string;
}

/** Weekend-batch maths (spec §4): pick ingredients, say how many servings the batch
 *  makes, and save the result as an ordinary food. Not a relational recipe — the
 *  saved row is a normal library entry, which is all v1 needs. */
export function RecipeCalculator({ onClose }: { onClose: () => void }) {
  const { foods, usage, refreshFoods, notify, reportError } = useStore();
  const sorted = useMemo(() => rankFoods(foods, usage), [foods, usage]);

  const [rows, setRows] = useState<Row[]>([{ key: 1, foodId: '', qty: '1' }]);
  const [batchServings, setBatchServings] = useState('4');
  const [name, setName] = useState('');
  const [servingDesc, setServingDesc] = useState('1 serving');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);

  const batch = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        const f: Food | undefined = byId.get(r.foodId);
        const q = parseNum(r.qty) ?? 0;
        if (!f || q <= 0) return acc;
        return {
          calories: acc.calories + Number(f.calories) * q,
          protein_g: acc.protein_g + Number(f.protein_g) * q,
          carbs_g: acc.carbs_g + Number(f.carbs_g) * q,
          fat_g: acc.fat_g + Number(f.fat_g) * q,
          fiber_g: acc.fiber_g + Number(f.fiber_g ?? 0) * q,
        };
      },
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
    );
  }, [rows, byId]);

  const makes = Math.max(parseNum(batchServings) ?? 0, 0);
  const per = makes > 0
    ? {
        calories: batch.calories / makes,
        protein_g: batch.protein_g / makes,
        carbs_g: batch.carbs_g / makes,
        fat_g: batch.fat_g / makes,
        fiber_g: batch.fiber_g / makes,
      }
    : null;

  const setRow = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const save = async () => {
    if (!name.trim()) return setError('Name the batch.');
    if (!per) return setError('How many servings does the batch make?');
    if (per.calories <= 0) return setError('Add at least one ingredient.');
    setError(null);
    setBusy(true);
    try {
      const food = await api.createFood({
        name: name.trim(),
        brand: null,
        barcode: null,
        serving_desc: servingDesc.trim() || '1 serving',
        calories: round(per.calories, 1),
        protein_g: round(per.protein_g, 1),
        carbs_g: round(per.carbs_g, 1),
        fat_g: round(per.fat_g, 1),
        fiber_g: per.fiber_g > 0 ? round(per.fiber_g, 1) : null,
        is_favorite: true, // a batch is what gets eaten all week
      });
      await refreshFoods();
      notify(`${food.name} saved — ${kcal(food.calories)} kcal per serving`);
      onClose();
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title="Recipe calculator"
      subtitle="Cook once, log all week"
      onClose={onClose}
      footer={
        <button type="button" className="btn primary block" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save as a food'}
        </button>
      }
    >
      <div className="recipe">
        <p className="form-section">Ingredients</p>
        {foods.length === 0 ? (
          <p className="empty">Add some foods to your library first — recipes are built from them.</p>
        ) : null}

        <ul className="recipe-rows">
          {rows.map((r) => (
            <li key={r.key}>
              <select value={r.foodId} onChange={(e) => setRow(r.key, { foodId: e.target.value })}>
                <option value="">Choose a food…</option>
                {sorted.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                    {f.brand ? ` · ${f.brand}` : ''} ({f.serving_desc})
                  </option>
                ))}
              </select>
              <NumberInput value={r.qty} onChange={(v) => setRow(r.key, { qty: v })} />
              <button
                type="button"
                className="icon-btn"
                aria-label="Remove ingredient"
                onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : rs))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn small"
          onClick={() => setRows((rs) => [...rs, { key: Date.now(), foodId: '', qty: '1' }])}
        >
          + Ingredient
        </button>

        <div className="grid-2 recipe-meta">
          <Field label="Batch makes (servings)">
            <NumberInput value={batchServings} onChange={setBatchServings} />
          </Field>
          <Field label="One serving is">
            <input value={servingDesc} onChange={(e) => setServingDesc(e.target.value)} placeholder="1 bowl" />
          </Field>
        </div>

        <div className="card recipe-result">
          <p className="form-section">Per serving</p>
          <ul className="macro-preview">
            <li>
              <span>{per ? kcal(per.calories) : '—'}</span>kcal
            </li>
            <li>
              <span>{per ? grams(per.protein_g) : '—'}</span>protein
            </li>
            <li>
              <span>{per ? grams(per.carbs_g) : '—'}</span>carbs
            </li>
            <li>
              <span>{per ? grams(per.fat_g) : '—'}</span>fat
            </li>
          </ul>
          <p className="muted small">
            Whole batch: {kcal(batch.calories)} kcal · {grams(batch.protein_g)} g protein
          </p>
        </div>

        <Field label="Save as">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rajma batch" />
        </Field>
        {error ? <p className="error">{error}</p> : null}
      </div>
    </Sheet>
  );
}
