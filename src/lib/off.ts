import { round } from './format';
import type { FoodDraft } from './types';

/** Open Food Facts lookup (spec §7). Free, no API key, no account. */
const ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product';
const FIELDS = 'product_name,brands,serving_size,nutriments';

type Nutriments = Record<string, number | string | undefined>;

const num = (n: Nutriments, key: string): number | null => {
  const v = n?.[key];
  const parsed = typeof v === 'string' ? Number(v) : v;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
};

/** "30 g", "250ml", "1 bar (45 g)" → grams, when it can be read at all. */
function servingGrams(serving: string | undefined): number | null {
  if (!serving) return null;
  const m = serving.match(/([\d.,]+)\s*(g|ml)\b/i);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type OffOutcome =
  | { kind: 'hit'; draft: FoodDraft; source: 'serving' | 'per100' }
  | { kind: 'miss' }
  | { kind: 'error'; message: string };

/**
 * Returns a prefilled draft, or a miss. Both non-hit outcomes are normal: the caller
 * falls through to the blank manual form with the barcode attached (spec §7.6).
 */
export async function lookupBarcode(barcode: string, signal?: AbortSignal): Promise<OffOutcome> {
  let body: { status?: number; product?: Record<string, unknown> };
  try {
    const res = await fetch(`${ENDPOINT}/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
    // OFF answers 404 for unknown barcodes on some edges; treat it as a plain miss.
    if (res.status === 404) return { kind: 'miss' };
    if (!res.ok) return { kind: 'error', message: `Open Food Facts returned ${res.status}` };
    body = await res.json();
  } catch (e) {
    if (signal?.aborted) return { kind: 'miss' };
    return { kind: 'error', message: e instanceof Error ? e.message : 'Network error' };
  }

  // Spec §7.4: check the body, not the HTTP status — a miss is 200 with status 0.
  if (body?.status !== 1 || !body.product) return { kind: 'miss' };

  const p = body.product as { product_name?: string; brands?: string; serving_size?: string };
  const n = ((body.product as { nutriments?: Nutriments }).nutriments ?? {}) as Nutriments;
  const serving = p.serving_size?.trim() || undefined;

  // Prefer OFF's own per-serving numbers, then scale per-100 g to the stated serving,
  // and fall back to a plain 100 g serving. Every field is optional in OFF.
  const perServing = num(n, 'energy-kcal_serving');
  let draft: FoodDraft;
  let source: 'serving' | 'per100';

  if (serving && perServing !== null) {
    source = 'serving';
    draft = {
      name: p.product_name?.trim() || '',
      brand: p.brands?.split(',')[0]?.trim() || null,
      barcode,
      serving_desc: serving,
      calories: round(perServing, 1),
      protein_g: round(num(n, 'proteins_serving') ?? 0, 1),
      carbs_g: round(num(n, 'carbohydrates_serving') ?? 0, 1),
      fat_g: round(num(n, 'fat_serving') ?? 0, 1),
      fiber_g: num(n, 'fiber_serving'),
      is_favorite: false,
    };
  } else {
    const grams = servingGrams(serving);
    const scale = grams ? grams / 100 : 1;
    source = grams ? 'serving' : 'per100';
    const per100 = (key: string) => {
      const v = num(n, key);
      return v === null ? null : round(v * scale, 1);
    };
    draft = {
      name: p.product_name?.trim() || '',
      brand: p.brands?.split(',')[0]?.trim() || null,
      barcode,
      serving_desc: grams && serving ? serving : '100 g',
      calories: per100('energy-kcal_100g') ?? 0,
      protein_g: per100('proteins_100g') ?? 0,
      carbs_g: per100('carbohydrates_100g') ?? 0,
      fat_g: per100('fat_100g') ?? 0,
      fiber_g: per100('fiber_100g'),
      is_favorite: false,
    };
  }

  return { kind: 'hit', draft, source };
}
