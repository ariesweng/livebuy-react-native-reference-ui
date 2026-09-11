// productImagePrefetch — pure URL resolution for the VOD/LIVE product-image prefetch warm-up
// (rb-rn-product-image-loading-polish).
//
// `PlayerShellView.tsx` prefetches every product's primary photo as soon as the FULL
// (unfiltered) product list arrives (`PlayerShellModel.products`), well before any single
// product's [beginTime,endTime) window (`vodActiveProducts`) or narrate-status window
// (`liveActiveProducts`) makes it "currently introducing" — see this change's design.md D1/D2.
// This file only resolves WHICH urls to prefetch; the actual `Image.prefetch(...)` calls stay
// in `PlayerShellView.tsx` (a side effect does not belong in a pure module).
//
// Pure, deterministic, zero-render — unit-testable without mounting a component
// (`docs/unit-test-discipline.md` 純函式抽出原則).

import { referenceUiHttpsUpgraded } from '../referenceUiImageUrl';
import type { LBProduct } from 'livebuy-react-native';

/**
 * The primary photo URL for one product: `photos[0]` when non-empty, else `pic`. Mirrors the
 * SAME fallback `PlayerShellView.tsx` already uses when building `nowIntroducingPeeks`
 * (`p.photos.length > 0 ? p.photos[0]! : p.pic`) — this is not a second, independently-invented
 * convention.
 */
function primaryPhoto(product: LBProduct): string {
  return product.photos.length > 0 ? product.photos[0]! : product.pic;
}

/**
 * Resolve the ordered, de-duplicated, https-upgraded prefetch-candidate photo URLs for
 * `products`. A blank result (empty / whitespace-only after trim) is skipped — there is
 * nothing to prefetch. De-duplication keeps first-occurrence order. No I/O — callers are
 * responsible for actually invoking `Image.prefetch` on each returned URL.
 */
export function productImagePrefetchUrls(products: readonly LBProduct[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const product of products) {
    const trimmed = primaryPhoto(product).trim();
    if (trimmed.length === 0) continue;
    const upgraded = referenceUiHttpsUpgraded(trimmed);
    if (seen.has(upgraded)) continue;
    seen.add(upgraded);
    urls.push(upgraded);
  }
  return urls;
}
