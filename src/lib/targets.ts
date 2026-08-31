import { parseNum } from './format';

/** Sane guard rails, not medical advice: they catch typos (18500 for 1850) and keep
 *  the values inside the `int` columns the schema declares (spec §4). */
export const TARGET_LIMITS = {
  calorieMin: 500,
  calorieMax: 10000,
  proteinMin: 1,
  proteinMax: 500,
} as const;

export interface Targets {
  calorie_target: number;
  protein_min_g: number;
  protein_max_g: number;
}

export type TargetValidation =
  | { ok: true; values: Targets }
  | { ok: false; message: string; field: 'calories' | 'proteinMin' | 'proteinMax' };

const KCAL_PER_G_PROTEIN = 4;

/** Validates the Settings form. Whole numbers only — all three columns are `int`. */
export function validateTargets(calories: string, proteinMin: string, proteinMax: string): TargetValidation {
  const cal = parseNum(calories);
  const lo = parseNum(proteinMin);
  const hi = parseNum(proteinMax);
  const { calorieMin, calorieMax, proteinMin: pLo, proteinMax: pHi } = TARGET_LIMITS;

  if (cal === null) return { ok: false, field: 'calories', message: 'Enter a daily calorie target.' };
  if (!Number.isInteger(cal))
    return { ok: false, field: 'calories', message: 'Calorie target must be a whole number.' };
  if (cal < calorieMin || cal > calorieMax)
    return {
      ok: false,
      field: 'calories',
      message: `Calorie target must be between ${calorieMin.toLocaleString()} and ${calorieMax.toLocaleString()} kcal.`,
    };

  if (lo === null) return { ok: false, field: 'proteinMin', message: 'Enter a protein minimum.' };
  if (hi === null) return { ok: false, field: 'proteinMax', message: 'Enter a protein maximum.' };
  if (!Number.isInteger(lo))
    return { ok: false, field: 'proteinMin', message: 'Protein minimum must be a whole number.' };
  if (!Number.isInteger(hi))
    return { ok: false, field: 'proteinMax', message: 'Protein maximum must be a whole number.' };
  if (lo < pLo)
    return { ok: false, field: 'proteinMin', message: `Protein minimum must be at least ${pLo} g.` };
  if (hi > pHi)
    return { ok: false, field: 'proteinMax', message: `Protein maximum must be ${pHi} g or less.` };
  if (lo > hi)
    return {
      ok: false,
      field: 'proteinMin',
      message: `Protein minimum (${lo} g) cannot be above the maximum (${hi} g).`,
    };

  // A band you cannot reach inside the calorie target is a typo, not a goal:
  // protein alone would blow the budget.
  if (lo * KCAL_PER_G_PROTEIN > cal)
    return {
      ok: false,
      field: 'proteinMin',
      message: `${lo} g of protein is ${(lo * KCAL_PER_G_PROTEIN).toLocaleString()} kcal on its own — more than the ${cal.toLocaleString()} kcal target.`,
    };

  return { ok: true, values: { calorie_target: cal, protein_min_g: lo, protein_max_g: hi } };
}
