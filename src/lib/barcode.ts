import * as api from './api';
import { lookupBarcode } from './off';
import type { Food, FoodDraft } from './types';

export type BarcodeResolution =
  /** Already in the library — log or edit it, never create a duplicate. */
  | { kind: 'known'; food: Food; message: string }
  /** Not ours yet: a draft to put in front of the user, prefilled or blank. */
  | { kind: 'new'; draft: Partial<FoodDraft>; message: string };

/**
 * The spec §7 ladder in one place, shared by "add food" and "new food": own library
 * first, then Open Food Facts, then a blank form with the barcode attached. A miss
 * and a network failure both land on that last rung — neither is an error state.
 */
export async function resolveBarcode(
  barcode: string,
  onProgress?: (message: string) => void,
): Promise<BarcodeResolution> {
  onProgress?.('Checking your library…');
  const known = await api.findFoodByBarcode(barcode);
  if (known) return { kind: 'known', food: known, message: 'Already in your library' };

  onProgress?.('Looking up Open Food Facts…');
  const result = await lookupBarcode(barcode);
  if (result.kind === 'hit') {
    return {
      kind: 'new',
      draft: result.draft,
      message: result.draft.name ? `Found: ${result.draft.name}` : 'Found — check the numbers',
    };
  }
  return {
    kind: 'new',
    draft: { barcode },
    message:
      result.kind === 'miss'
        ? 'Not in Open Food Facts — add it once and it is yours forever'
        : 'Lookup unavailable — enter it manually',
  };
}
