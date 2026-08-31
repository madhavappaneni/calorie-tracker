import type { Usage } from './api';
import type { Food } from './types';

export const perServing = (f: Food) => ({
  calories: Number(f.calories),
  protein_g: Number(f.protein_g),
  carbs_g: Number(f.carbs_g),
  fat_g: Number(f.fat_g),
});

const haystack = (f: Food) => `${f.name} ${f.brand ?? ''} ${f.serving_desc}`.toLowerCase();

/** Picker order (spec §6): favourites, then most-logged, then alphabetical.
 *  Search is a simple all-terms substring match — the library is one person's. */
export function rankFoods(foods: Food[], usage: Usage, query = ''): Food[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matched = terms.length
    ? foods.filter((f) => {
        const h = haystack(f);
        return terms.every((t) => h.includes(t));
      })
    : foods.slice();

  return matched.sort((a, b) => {
    if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
    const ua = usage.total[a.id] ?? 0;
    const ub = usage.total[b.id] ?? 0;
    if (ua !== ub) return ub - ua;
    return a.name.localeCompare(b.name);
  });
}

/** The handful of foods worth offering as one-tap chips for a given meal:
 *  what actually gets eaten at that meal, then favourites. */
export function quickPicks(foods: Food[], usage: Usage, meal: keyof Usage['byMeal'], limit = 3): Food[] {
  const forMeal = usage.byMeal[meal] ?? {};
  return foods
    .map((f) => ({ f, n: forMeal[f.id] ?? 0 }))
    .filter(({ f, n }) => n > 0 || f.is_favorite)
    .sort((a, b) => b.n - a.n || Number(b.f.is_favorite) - Number(a.f.is_favorite) || a.f.name.localeCompare(b.f.name))
    .slice(0, limit)
    .map(({ f }) => f);
}
