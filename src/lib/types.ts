export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

export interface Food {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  serving_desc: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  is_favorite: boolean;
  created_at: string;
}

/** Everything the user supplies when creating or editing a food. */
export type FoodDraft = Pick<
  Food,
  'name' | 'brand' | 'barcode' | 'serving_desc' | 'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g' | 'is_favorite'
>;

export interface LogEntry {
  id: string;
  user_id: string;
  logged_date: string; // YYYY-MM-DD
  meal: Meal;
  food_id: string | null;
  name: string;
  servings: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  created_at: string;
}

export interface Settings {
  user_id: string;
  calorie_target: number;
  protein_min_g: number;
  protein_max_g: number;
  updated_at: string;
}

export interface Totals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export const emptyTotals = (): Totals => ({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });

export function sumEntries(entries: LogEntry[]): Totals {
  return entries.reduce<Totals>(
    (acc, e) => ({
      calories: acc.calories + Number(e.calories),
      protein_g: acc.protein_g + Number(e.protein_g),
      carbs_g: acc.carbs_g + Number(e.carbs_g),
      fat_g: acc.fat_g + Number(e.fat_g),
    }),
    emptyTotals(),
  );
}
