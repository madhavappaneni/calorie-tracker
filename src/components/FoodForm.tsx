import { useRef, useState } from 'react';
import { Field, NumberInput, ServingStepper } from './ui';
import { VoiceEntry } from './VoiceEntry';
import { parseNum } from '../lib/format';
import type { FoodDraft } from '../lib/types';

const str = (v: number | null | undefined): string => (v === null || v === undefined ? '' : String(v));

export interface FoodFormValues {
  draft: FoodDraft;
  servings: number;
}

/** The manual-entry form (spec §6). Doubles as the barcode-prefill form and the
 *  Library editor — same fields, different submit label. */
export function FoodForm({
  initial,
  saveLabel,
  withServings = false,
  busy = false,
  onSave,
  secondary,
}: {
  initial?: Partial<FoodDraft>;
  saveLabel: string;
  withServings?: boolean;
  busy?: boolean;
  onSave: (values: FoodFormValues) => void;
  /** Optional second submit path (e.g. "save to library without logging"). */
  secondary?: { label: string; onSave: (values: FoodFormValues) => void };
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [servingDesc, setServingDesc] = useState(initial?.serving_desc ?? '');
  const [calories, setCalories] = useState(str(initial?.calories));
  const [protein, setProtein] = useState(str(initial?.protein_g));
  const [carbs, setCarbs] = useState(str(initial?.carbs_g));
  const [fat, setFat] = useState(str(initial?.fat_g));
  const [fiber, setFiber] = useState(str(initial?.fiber_g));
  const [favorite, setFavorite] = useState(initial?.is_favorite ?? false);
  const [servings, setServings] = useState('1');
  const [error, setError] = useState<string | null>(null);
  // Which submit button was pressed — a ref, because the value must be readable
  // synchronously inside the submit handler.
  const target = useRef<'primary' | 'secondary'>('primary');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cal = parseNum(calories);
    if (!name.trim()) return setError('Give it a name.');
    if (cal === null || cal < 0) return setError('Calories are required.');
    const s = parseNum(servings) ?? 1;
    if (withServings && s <= 0) return setError('Servings must be more than zero.');
    setError(null);
    const handler = target.current === 'secondary' && secondary ? secondary.onSave : onSave;
    target.current = 'primary';
    handler({
      draft: {
        name: name.trim(),
        brand: brand.trim() || null,
        barcode: initial?.barcode ?? null,
        serving_desc: servingDesc.trim() || '1 serving',
        calories: cal,
        protein_g: parseNum(protein) ?? 0,
        carbs_g: parseNum(carbs) ?? 0,
        fat_g: parseNum(fat) ?? 0,
        fiber_g: parseNum(fiber),
        is_favorite: favorite,
      },
      servings: s,
    });
  };

  /** Voice fills only what it actually heard — a field it could not parse keeps
   *  whatever is already typed there. */
  const applySpoken = (spoken: Partial<FoodDraft>) => {
    if (spoken.name) setName(spoken.name);
    if (spoken.serving_desc) setServingDesc(spoken.serving_desc);
    if (spoken.calories !== undefined) setCalories(String(spoken.calories));
    if (spoken.protein_g !== undefined) setProtein(String(spoken.protein_g));
    if (spoken.carbs_g !== undefined) setCarbs(String(spoken.carbs_g));
    if (spoken.fat_g !== undefined) setFat(String(spoken.fat_g));
    if (spoken.fiber_g !== undefined && spoken.fiber_g !== null) setFiber(String(spoken.fiber_g));
    setError(null);
  };

  return (
    <form className="food-form" onSubmit={submit}>
      <VoiceEntry onParsed={applySpoken} />

      <Field label="Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Greek yogurt"
          autoComplete="off"
          autoFocus={!initial?.name}
        />
      </Field>

      <div className="grid-2">
        <Field label="Brand (optional)">
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Fage" autoComplete="off" />
        </Field>
        <Field label="Serving" hint="What one serving means">
          <input
            value={servingDesc}
            onChange={(e) => setServingDesc(e.target.value)}
            placeholder="1 cup · 100 g · 1 bar"
            autoComplete="off"
          />
        </Field>
      </div>

      <p className="form-section">Per serving</p>
      <div className="grid-2">
        <Field label="Calories">
          <NumberInput value={calories} onChange={setCalories} placeholder="0" />
        </Field>
        <Field label="Protein (g)">
          <NumberInput value={protein} onChange={setProtein} placeholder="0" />
        </Field>
        <Field label="Carbs (g)">
          <NumberInput value={carbs} onChange={setCarbs} placeholder="0" />
        </Field>
        <Field label="Fat (g)">
          <NumberInput value={fat} onChange={setFat} placeholder="0" />
        </Field>
        <Field label="Fiber (g, optional)">
          <NumberInput value={fiber} onChange={setFiber} placeholder="—" />
        </Field>
        {withServings ? (
          <Field label="Servings">
            <ServingStepper value={servings} onChange={setServings} />
          </Field>
        ) : null}
      </div>

      <label className="check">
        <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
        <span>Favorite — pin to the top of the picker</span>
      </label>

      {initial?.barcode ? <p className="muted small">Barcode {initial.barcode} will be saved with this food.</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="form-actions">
        {secondary ? (
          <button
            type="submit"
            className="btn"
            disabled={busy}
            onClick={() => {
              target.current = 'secondary';
            }}
          >
            {secondary.label}
          </button>
        ) : null}
        <button
          type="submit"
          className="btn primary"
          disabled={busy}
          onClick={() => {
            target.current = 'primary';
          }}
        >
          {busy ? 'Saving…' : saveLabel}
        </button>
      </div>
    </form>
  );
}
