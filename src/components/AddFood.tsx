import { Suspense, useCallback, useMemo, useState } from 'react';
import { Sheet, ServingStepper, Empty, Spinner } from './ui';
import { FoodForm } from './FoodForm';
import { LazyBarcodeScanner } from './LazyScanner';
import type { FoodFormValues } from './FoodForm';
import * as api from '../lib/api';
import { resolveBarcode } from '../lib/barcode';
import { perServing, rankFoods } from '../lib/foods';
import { grams, kcal, parseNum } from '../lib/format';
import { useStore } from '../state/store';
import { MEALS, MEAL_LABELS } from '../lib/types';
import type { Food, FoodDraft, Meal } from '../lib/types';

type Tab = 'library' | 'scan' | 'manual';

/** The three add-food paths in one flow (spec §6): search the library, scan a
 *  barcode, or type it in. Every path ends at the same log-an-entry call. */
export function AddFood({
  date,
  meal: initialMeal,
  onClose,
  onLogged,
}: {
  date: string;
  meal: Meal;
  onClose: () => void;
  onLogged: () => void;
}) {
  const { foods, usage, refreshFoods, refreshUsage, notify, reportError } = useStore();
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [tab, setTab] = useState<Tab>('library');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<Food | null>(null);
  const [servings, setServings] = useState('1');
  const [manualInitial, setManualInitial] = useState<Partial<FoodDraft> | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);

  const ranked = useMemo(() => rankFoods(foods, usage, query), [foods, usage, query]);

  const log = useCallback(
    async (food: Food, count: number) => {
      setBusy('Logging…');
      try {
        await api.logEntry({
          date,
          meal,
          food,
          name: food.name,
          servings: count,
          per: perServing(food),
        });
        onLogged();
        void refreshUsage();
        notify(`${food.name} added to ${MEAL_LABELS[meal].toLowerCase()}`);
        onClose();
      } catch (e) {
        reportError(e);
      } finally {
        setBusy(null);
      }
    },
    [date, meal, onClose, onLogged, notify, refreshUsage, reportError],
  );

  const openDetail = (food: Food) => {
    setDetail(food);
    setServings('1');
  };

  const handleBarcode = useCallback(
    async (barcode: string) => {
      try {
        // Library first, then Open Food Facts, then a blank form (spec §7).
        const result = await resolveBarcode(barcode, setBusy);
        notify(result.message);
        if (result.kind === 'known') {
          setDetail(result.food);
          setServings('1');
          setTab('library');
          return;
        }
        setManualInitial(result.draft);
        setTab('manual');
      } catch (e) {
        reportError(e);
        setManualInitial({ barcode });
        setTab('manual');
      } finally {
        setBusy(null);
      }
    },
    [notify, reportError],
  );

  const saveManual = async ({ draft, servings: count }: FoodFormValues, mode: 'log' | 'library') => {
    setBusy('Saving…');
    try {
      const food = await api.createFood(draft);
      await refreshFoods();
      if (mode === 'library') {
        notify(`${food.name} saved to your library`);
        onClose();
        return;
      }
      await log(food, count);
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(null);
    }
  };

  const count = parseNum(servings) ?? 1;

  return (
    <Sheet
      title={detail ? detail.name : 'Add food'}
      subtitle={detail ? detail.brand || detail.serving_desc : undefined}
      onClose={onClose}
    >
      <div className="meal-picker" role="group" aria-label="Meal">
        {MEALS.map((m) => (
          <button
            key={m}
            type="button"
            className={m === meal ? 'chip on' : 'chip'}
            onClick={() => setMeal(m)}
          >
            {MEAL_LABELS[m]}
          </button>
        ))}
      </div>

      {detail ? (
        <div className="detail">
          <p className="detail-serving">
            {detail.serving_desc} — {kcal(detail.calories)} kcal, {grams(detail.protein_g)} g protein
          </p>
          <label className="field">
            <span className="field-label">Servings</span>
            <ServingStepper value={servings} onChange={setServings} />
          </label>
          <ul className="macro-preview">
            <li>
              <span>{kcal(Number(detail.calories) * count)}</span>kcal
            </li>
            <li>
              <span>{grams(Number(detail.protein_g) * count)}</span>protein
            </li>
            <li>
              <span>{grams(Number(detail.carbs_g) * count)}</span>carbs
            </li>
            <li>
              <span>{grams(Number(detail.fat_g) * count)}</span>fat
            </li>
          </ul>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setDetail(null)}>
              Back
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={!!busy}
              onClick={() => log(detail, count)}
            >
              {busy ?? `Log to ${MEAL_LABELS[meal].toLowerCase()}`}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="tabs" role="tablist">
            {(['library', 'scan', 'manual'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={tab === t ? 'tab on' : 'tab'}
                onClick={() => {
                  if (t === 'manual' && tab !== 'manual') setManualInitial(undefined);
                  setTab(t);
                }}
              >
                {t === 'library' ? 'My library' : t === 'scan' ? 'Scan' : 'Manual'}
              </button>
            ))}
          </div>

          {busy ? <Spinner label={busy} /> : null}

          {tab === 'library' ? (
            <>
              <input
                className="search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search my foods"
                autoComplete="off"
              />
              {ranked.length === 0 ? (
                <Empty>
                  {foods.length === 0
                    ? 'Your library is empty — scan something or add it manually.'
                    : 'No food matches that.'}
                </Empty>
              ) : (
                <ul className="food-list">
                  {ranked.map((f) => (
                    <li key={f.id}>
                      <button type="button" className="food-row" onClick={() => log(f, 1)} disabled={!!busy}>
                        <span className="food-name">
                          {f.is_favorite ? <span className="star" aria-label="Favorite">★</span> : null}
                          {f.name}
                          {f.brand ? <span className="muted"> · {f.brand}</span> : null}
                        </span>
                        <span className="food-macros">
                          {kcal(f.calories)} kcal · {grams(f.protein_g)} g P
                          <span className="muted"> · {f.serving_desc}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => openDetail(f)}
                        aria-label={`Choose servings for ${f.name}`}
                      >
                        ⋯
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}

          {tab === 'scan' ? (
            <Suspense fallback={<Spinner label="Loading the scanner…" />}>
              <LazyBarcodeScanner
                onDetected={handleBarcode}
                onManual={() => {
                  setManualInitial(undefined);
                  setTab('manual');
                }}
              />
            </Suspense>
          ) : null}

          {tab === 'manual' ? (
            <FoodForm
              key={manualInitial?.barcode ?? manualInitial?.name ?? 'blank'}
              initial={manualInitial}
              withServings
              busy={!!busy}
              saveLabel={`Save & log to ${MEAL_LABELS[meal].toLowerCase()}`}
              onSave={(v) => saveManual(v, 'log')}
              secondary={{ label: 'Save to library only', onSave: (v) => saveManual(v, 'library') }}
            />
          ) : null}
        </>
      )}
    </Sheet>
  );
}
