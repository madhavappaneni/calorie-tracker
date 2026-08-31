import { lazy } from 'react';

/** The decoder is ~370 kB, so it stays out of the main bundle. Both the add-food
 *  flow and the library's new-food sheet import it from here to share one chunk. */
export const LazyBarcodeScanner = lazy(() =>
  import('./BarcodeScanner').then((m) => ({ default: m.BarcodeScanner })),
);
