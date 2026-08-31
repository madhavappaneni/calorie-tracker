import { Suspense, useMemo, useState } from 'react';
import { Sheet, ConfirmButton, Empty, Spinner } from '../components/ui';
import { LazyBarcodeScanner } from '../components/LazyScanner';
import { FoodForm } from '../components/FoodForm';
import type { FoodFormValues } from '../components/FoodForm';
import { RecipeCalculator } from '../components/RecipeCalculator';
import * as api from '../lib/api';
import { resolveBarcode } from '../lib/barcode';
import { grams, kcal } from '../lib/format';
import { rankFoods } from '../lib/foods';
import { useStore } from '../state/store';
import type { Food, FoodDraft } from '../lib/types';

export function Library() {
  const { foods, usage, refreshFoods, notify, reportError, dataReady } = useStore();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Food | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTab, setNewTab] = useState<'manual' | 'scan'>('manual');
  const [draft, setDraft] = useState<Partial<FoodDraft> | undefined>(undefined);
  const [scanning, setScanning] = useState<string | null>(null);
  const [recipe, setRecipe] = useState(false);
  const [busy, setBusy] = useState(false);

  const openNew = () => {
    setDraft(undefined);
    setNewTab('manual');
    setCreating(true);
  };

  /** Same ladder as the add-food flow: library, then Open Food Facts, then a blank
   *  form — except a barcode already on file opens that food instead of a duplicate. */
  const scanned = async (barcode: string) => {
    try {
      const result = await resolveBarcode(barcode, setScanning);
      notify(result.message);
      if (result.kind === 'known') {
        setCreating(false);
        setEditing(result.food);
        return;
      }
      setDraft(result.draft);
      setNewTab('manual');
    } catch (e) {
      reportError(e);
      setDraft({ barcode });
      setNewTab('manual');
    } finally {
      setScanning(null);
    }
  };

  const list = useMemo(() => rankFoods(foods, usage, query), [foods, usage, query]);

  const toggleFavorite = async (food: Food) => {
    try {
      await api.updateFood(food.id, { is_favorite: !food.is_favorite });
      await refreshFoods();
    } catch (e) {
      reportError(e);
    }
  };

  const save = async ({ draft }: FoodFormValues) => {
    setBusy(true);
    try {
      if (editing) {
        await api.updateFood(editing.id, draft);
        notify(`${draft.name} updated — past entries keep their old numbers`);
      } else {
        await api.createFood(draft);
        notify(`${draft.name} added to your library`);
      }
      await refreshFoods();
      setEditing(null);
      setCreating(false);
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (food: Food) => {
    try {
      await api.deleteFood(food.id);
      await refreshFoods();
      notify(`${food.name} deleted — logged entries are untouched`);
      setEditing(null);
    } catch (e) {
      reportError(e);
    }
  };

  return (
    <div className="library">
      <header className="screen-head">
        <h1>Library</h1>
        <div className="head-actions">
          <button type="button" className="btn small" onClick={() => setRecipe(true)}>
            Recipe
          </button>
          <button type="button" className="btn small primary" onClick={openNew}>
            + New food
          </button>
        </div>
      </header>

      <input
        className="search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search my foods"
        autoComplete="off"
      />

      {!dataReady ? null : list.length === 0 ? (
        <Empty>
          {foods.length === 0
            ? 'Nothing here yet. Add a food, or scan a barcode from Today.'
            : 'No food matches that.'}
        </Empty>
      ) : (
        <ul className="food-list card-list">
          {list.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                className={f.is_favorite ? 'icon-btn star on' : 'icon-btn star'}
                onClick={() => toggleFavorite(f)}
                aria-label={f.is_favorite ? `Unfavorite ${f.name}` : `Favorite ${f.name}`}
                aria-pressed={f.is_favorite}
              >
                {f.is_favorite ? '★' : '☆'}
              </button>
              <button type="button" className="food-row" onClick={() => setEditing(f)}>
                <span className="food-name">
                  {f.name}
                  {f.brand ? <span className="muted"> · {f.brand}</span> : null}
                </span>
                <span className="food-macros">
                  {kcal(f.calories)} kcal · {grams(f.protein_g)} g P · {grams(f.carbs_g)} g C ·{' '}
                  {grams(f.fat_g)} g F
                  <span className="muted"> · {f.serving_desc}</span>
                  {usage.total[f.id] ? <span className="muted"> · logged {usage.total[f.id]}×</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {creating ? (
        <Sheet title="New food" onClose={() => setCreating(false)}>
          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={newTab === 'manual'}
              className={newTab === 'manual' ? 'tab on' : 'tab'}
              onClick={() => setNewTab('manual')}
            >
              Manual
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={newTab === 'scan'}
              className={newTab === 'scan' ? 'tab on' : 'tab'}
              onClick={() => setNewTab('scan')}
            >
              Scan
            </button>
          </div>

          {scanning ? <Spinner label={scanning} /> : null}

          {newTab === 'scan' ? (
            <Suspense fallback={<Spinner label="Loading the scanner…" />}>
              <LazyBarcodeScanner onDetected={scanned} onManual={() => setNewTab('manual')} />
            </Suspense>
          ) : (
            <FoodForm
              key={draft?.barcode ?? 'blank'}
              initial={draft}
              saveLabel="Save"
              busy={busy}
              onSave={save}
            />
          )}
        </Sheet>
      ) : null}

      {editing ? (
        <Sheet
          title={editing.name}
          subtitle={editing.barcode ? `Barcode ${editing.barcode}` : 'Edit food'}
          onClose={() => setEditing(null)}
        >
          <FoodForm
            key={editing.id}
            initial={editing}
            saveLabel="Save changes"
            busy={busy}
            onSave={save}
          />
          <div className="danger-zone">
            <ConfirmButton
              label="Delete this food"
              confirmLabel="Delete for real?"
              onConfirm={() => remove(editing)}
            />
            <p className="muted small">
              Past log entries keep their own snapshot, so history stays intact.
            </p>
          </div>
        </Sheet>
      ) : null}

      {recipe ? <RecipeCalculator onClose={() => setRecipe(false)} /> : null}
    </div>
  );
}
