import type { FoodDraft } from './types';

/**
 * Turns a spoken phrase into form fields. No LLM and no network: this handles the
 * shape you actually say out loud — "chicken breast, 220 calories, 40 grams of
 * protein, 5 carbs, 8 fat" — and leaves anything it cannot read for the user to
 * type. Every parsed value lands in the form as an editable default, never a
 * silent save.
 */

type Nutrient = 'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g';

/** Longest synonyms first, so "carbohydrates" wins before "carb". */
const SYNONYMS: Record<Nutrient, string[]> = {
  calories: ['calories', 'calorie', 'kcals', 'kcal', 'cals', 'cal'],
  protein_g: ['proteins', 'protein'],
  carbs_g: ['carbohydrates', 'carbohydrate', 'carbs', 'carb'],
  fat_g: ['fats', 'fat'],
  fiber_g: ['fibre', 'fiber'],
};

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const UNIT = String.raw`(?:\s*(?:g|gs|gram|grams|grammes)\b)?`;

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5,
};

const MEASURES = [
  'cups', 'cup', 'tablespoons', 'tablespoon', 'tbsp', 'teaspoons', 'teaspoon', 'tsp',
  'slices', 'slice', 'pieces', 'piece', 'scoops', 'scoop', 'bars', 'bar',
  'bowls', 'bowl', 'cans', 'can', 'bottles', 'bottle', 'servings', 'serving',
  'grams', 'gram', 'ounces', 'ounce', 'oz', 'ml', 'millilitres', 'milliliters', 'g',
];

const QTY = String.raw`(?:\d+(?:[.,]\d+)?|${Object.keys(WORD_NUMBERS).join('|')})`;

const asCount = (raw: string): number => {
  const key = raw.toLowerCase();
  return WORD_NUMBERS[key] ?? toNumber(raw);
};

const asServing = (qty: string | undefined, measure: string): string =>
  `${qty ? asCount(qty) : 1} ${measure.toLowerCase()}`;

const toNumber = (raw: string): number => Number(raw.replace(',', '.'));

interface Span {
  start: number;
  end: number;
}

/** Matches both "40 grams of protein" and "protein is 40 grams". */
function findNutrient(text: string, nutrient: Nutrient): { value: number; span: Span } | null {
  for (const word of SYNONYMS[nutrient]) {
    const before = new RegExp(`${NUM}${UNIT}\\s*(?:of\\s+)?${word}\\b`, 'i');
    const after = new RegExp(`${word}\\b\\s*(?:is|are|:|=|of)?\\s*${NUM}${UNIT}`, 'i');
    for (const re of [before, after]) {
      const m = re.exec(text);
      if (m && m.index !== undefined) {
        return { value: toNumber(m[1]), span: { start: m.index, end: m.index + m[0].length } };
      }
    }
  }
  return null;
}

/** An explicitly announced serving: "per 100 grams", "serving is 1 cup", "per bar".
 *  The marker word is what makes a bare measure safe to read here. */
function findServing(text: string): { serving: string; span: Span } | null {
  const re = new RegExp(
    `\\b(?:per|for|each|serving(?:\\s+(?:is|of|size))?)\\s+(?:(${QTY})\\s+)?(${MEASURES.join('|')})\\b`,
    'i',
  );
  const m = re.exec(text);
  if (!m || m.index === undefined) return null;
  return {
    serving: asServing(m[1], m[2]),
    span: { start: m.index, end: m.index + m[0].length },
  };
}

/** A measure folded into the name: "one cup of brown rice" or "greek yogurt one
 *  cup" -> serving "1 cup". A quantity is required in both positions — without
 *  it, "protein bar" would be read as one bar of "protein". */
function splitServing(name: string): { serving?: string; rest: string } {
  const leading = new RegExp(`^(${QTY})\\s+(${MEASURES.join('|')})\\b\\s*(?:of\\s+)?`, 'i');
  const lead = leading.exec(name);
  if (lead) {
    const rest = name.slice(lead[0].length).trim();
    // "two eggs" is the food itself, not a serving of something — keep it whole.
    if (rest) return { serving: asServing(lead[1], lead[2]), rest };
  }

  const trailing = new RegExp(`\\s+(${QTY})\\s+(${MEASURES.join('|')})$`, 'i');
  const trail = trailing.exec(name);
  if (trail && trail.index !== undefined) {
    const rest = name.slice(0, trail.index).trim();
    if (rest) return { serving: asServing(trail[1], trail[2]), rest };
  }

  return { rest: name };
}

/** A connector word or stray punctuation, as a whole token — \b keeps "Ofada
 *  rice" from being shortened to "ada rice". */
const EDGE = String.raw`(?:(?:and|with|of|plus|comma)\b|[,.;:—-])`;

/** Trims connectors from the edges only — "macaroni and cheese" has to survive,
 *  so nothing is ever stripped from the middle. */
function tidy(fragment: string): string {
  return fragment
    .replace(/\s+/g, ' ')
    .trim() // before the edge strips, or a trailing space hides the comma
    .replace(new RegExp(`^(?:${EDGE}\\s*)+`, 'i'), '')
    .replace(new RegExp(`(?:\\s*${EDGE})+$`, 'i'), '')
    .trim();
}

/** The name is whatever precedes the first parsed value — people say the food
 *  first and the numbers after, so the prefix wins whenever there is one. When
 *  the phrase opens with a number or a serving instead ("220 calories of
 *  oatmeal", "serving is 2 slices of toast"), fall back to the longest run of
 *  words left between the parsed spans. */
function extractName(text: string, spans: Span[]): string {
  if (spans.length === 0) return tidy(text);
  const sorted = [...spans].sort((a, b) => a.start - b.start);

  const prefix = tidy(text.slice(0, sorted[0].start));
  if (prefix) return prefix;

  const gaps: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const from = sorted[i].end;
    const to = i + 1 < sorted.length ? sorted[i + 1].start : text.length;
    if (to > from) gaps.push(tidy(text.slice(from, to)));
  }
  return gaps.sort((a, b) => b.length - a.length)[0] ?? '';
}

export interface SpokenFood {
  draft: Partial<FoodDraft>;
  /** Which fields the phrase actually supplied — the rest are left untouched. */
  found: string[];
}

export function parseSpokenFood(transcript: string): SpokenFood {
  const text = transcript.trim();
  if (!text) return { draft: {}, found: [] };

  const draft: Partial<FoodDraft> = {};
  const found: string[] = [];
  const spans: Span[] = [];

  const labels: Record<Nutrient, string> = {
    calories: 'calories',
    protein_g: 'protein',
    carbs_g: 'carbs',
    fat_g: 'fat',
    fiber_g: 'fiber',
  };

  for (const nutrient of Object.keys(SYNONYMS) as Nutrient[]) {
    const hit = findNutrient(text, nutrient);
    if (!hit) continue;
    draft[nutrient] = hit.value;
    spans.push(hit.span);
    found.push(labels[nutrient]);
  }

  // An announced serving is cut out before the name is read, so "paneer per 100
  // grams" does not end up named "paneer per 100 grams".
  const announced = findServing(text);
  if (announced) {
    draft.serving_desc = announced.serving;
    spans.push(announced.span);
    found.push('serving');
  }

  const leftover = extractName(text, spans);
  if (leftover) {
    const { serving, rest } = announced ? { serving: undefined, rest: leftover } : splitServing(leftover);
    draft.name = rest.charAt(0).toUpperCase() + rest.slice(1);
    found.unshift('name');
    if (serving) {
      draft.serving_desc = serving;
      found.push('serving');
    }
  }

  return { draft, found };
}
