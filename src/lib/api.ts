import { supabase } from './supabase';
import { round } from './format';
import type { Food, FoodDraft, LogEntry, Meal, Settings } from './types';

const unwrap = <T>({ data, error }: { data: T | null; error: unknown }): T => {
  if (error) throw error;
  return data as T;
};

/* ---------- foods ---------- */

export async function listFoods(): Promise<Food[]> {
  return unwrap(
    await supabase.from('foods').select('*').order('is_favorite', { ascending: false }).order('name'),
  );
}

export async function createFood(draft: FoodDraft): Promise<Food> {
  return unwrap(await supabase.from('foods').insert(draft).select().single());
}

export async function updateFood(id: string, patch: Partial<FoodDraft>): Promise<Food> {
  return unwrap(await supabase.from('foods').update(patch).eq('id', id).select().single());
}

export async function deleteFood(id: string): Promise<void> {
  const { error } = await supabase.from('foods').delete().eq('id', id);
  if (error) throw error;
}

/** Spec §7 step 2: own library is checked before Open Food Facts, so repeat scans
 *  are instant and work without the network. */
export async function findFoodByBarcode(barcode: string): Promise<Food | null> {
  const rows = unwrap(
    await supabase.from('foods').select('*').eq('barcode', barcode).limit(1),
  ) as Food[];
  return rows[0] ?? null;
}

/* ---------- log entries ---------- */

export async function listEntries(fromDate: string, toDate: string): Promise<LogEntry[]> {
  return unwrap(
    await supabase
      .from('log_entries')
      .select('*')
      .gte('logged_date', fromDate)
      .lte('logged_date', toDate)
      .order('created_at'),
  );
}

export interface LogInput {
  date: string;
  meal: Meal;
  food: Food | null;
  name: string;
  servings: number;
  /** Per-serving macros; multiplied by servings into the entry snapshot. */
  per: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
}

/** Entries snapshot their macros (spec §4) so editing a food never rewrites history. */
export async function logEntry(input: LogInput): Promise<LogEntry> {
  const s = input.servings;
  return unwrap(
    await supabase
      .from('log_entries')
      .insert({
        logged_date: input.date,
        meal: input.meal,
        food_id: input.food?.id ?? null,
        name: input.name,
        servings: round(s, 2),
        calories: round(input.per.calories * s, 2),
        protein_g: round(input.per.protein_g * s, 2),
        carbs_g: round(input.per.carbs_g * s, 2),
        fat_g: round(input.per.fat_g * s, 2),
      })
      .select()
      .single(),
  );
}

/** Rescales an entry's snapshot to a new serving count, keeping its own per-serving
 *  macros (not the food's current ones). */
export async function updateEntryServings(entry: LogEntry, newServings: number): Promise<LogEntry> {
  const factor = newServings / Number(entry.servings || 1);
  return unwrap(
    await supabase
      .from('log_entries')
      .update({
        servings: round(newServings, 2),
        calories: round(Number(entry.calories) * factor, 2),
        protein_g: round(Number(entry.protein_g) * factor, 2),
        carbs_g: round(Number(entry.carbs_g) * factor, 2),
        fat_g: round(Number(entry.fat_g) * factor, 2),
      })
      .eq('id', entry.id)
      .select()
      .single(),
  );
}

export async function moveEntry(id: string, meal: Meal, date: string): Promise<LogEntry> {
  return unwrap(
    await supabase.from('log_entries').update({ meal, logged_date: date }).eq('id', id).select().single(),
  );
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from('log_entries').delete().eq('id', id);
  if (error) throw error;
}

export interface Usage {
  /** food id → times logged in the window. */
  total: Record<string, number>;
  /** meal → food id → times logged to that meal, for per-meal quick adds. */
  byMeal: Record<Meal, Record<string, number>>;
}

/** How often each food has been logged recently — drives "most-logged first". */
export async function foodUsage(sinceDate: string): Promise<Usage> {
  const rows = unwrap(
    await supabase.from('log_entries').select('food_id, meal').gte('logged_date', sinceDate),
  ) as { food_id: string | null; meal: Meal }[];
  const usage: Usage = {
    total: {},
    byMeal: { breakfast: {}, lunch: {}, dinner: {}, snack: {} },
  };
  for (const r of rows) {
    if (!r.food_id) continue;
    usage.total[r.food_id] = (usage.total[r.food_id] ?? 0) + 1;
    const meal = usage.byMeal[r.meal];
    if (meal) meal[r.food_id] = (meal[r.food_id] ?? 0) + 1;
  }
  return usage;
}

/* ---------- settings ---------- */

export async function getSettings(userId: string): Promise<Settings> {
  const rows = unwrap(await supabase.from('settings').select('*').limit(1)) as Settings[];
  if (rows[0]) return rows[0];
  // First sign-in: create the row so defaults are editable from Settings.
  return unwrap(await supabase.from('settings').insert({ user_id: userId }).select().single());
}

export async function saveSettings(
  userId: string,
  patch: Pick<Settings, 'calorie_target' | 'protein_min_g' | 'protein_max_g'>,
): Promise<Settings> {
  return unwrap(
    await supabase
      .from('settings')
      .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() })
      .select()
      .single(),
  );
}

/* ---------- export ---------- */

export async function exportAll(): Promise<{
  exported_at: string;
  foods: Food[];
  log_entries: LogEntry[];
  settings: Settings[];
}> {
  const [foods, entries, settings] = await Promise.all([
    supabase.from('foods').select('*').order('created_at'),
    supabase.from('log_entries').select('*').order('logged_date'),
    supabase.from('settings').select('*'),
  ]);
  for (const r of [foods, entries, settings]) if (r.error) throw r.error;
  return {
    exported_at: new Date().toISOString(),
    foods: (foods.data ?? []) as Food[],
    log_entries: (entries.data ?? []) as LogEntry[],
    settings: (settings.data ?? []) as Settings[],
  };
}
