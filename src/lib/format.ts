/** Round to `places` decimals — used before writing numerics to Postgres. */
export const round = (n: number, places = 2): number => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

export const kcal = (n: number): string => Math.round(n).toLocaleString();

/** Grams: whole numbers unless the value is small enough that a decimal matters. */
export const grams = (n: number): string => {
  const r = round(n, 1);
  return Math.abs(r) < 10 && !Number.isInteger(r) ? r.toFixed(1) : String(Math.round(r));
};

/** Servings render as "1", "1.5", "0.75" — never "1.00". */
export const servings = (n: number): string => String(round(n, 2));

export const pct = (n: number): string => `${Math.round(n * 100)}%`;

/** Parses a user-typed number; returns null for blank/garbage rather than NaN.
 *  Tolerates grouped thousands ("1,850") but only in that exact shape, so a decimal
 *  comma ("1,5") is still rejected rather than silently read as fifteen. */
export const parseNum = (v: string): number | null => {
  const t = v.trim();
  if (!t) return null;
  const ungrouped = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t) ? t.replace(/,/g, '') : t;
  const n = Number(ungrouped);
  return Number.isFinite(n) ? n : null;
};

export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
