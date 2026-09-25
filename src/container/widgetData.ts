// widgetData — pure, injectable data-driving helpers for the drop-in
// `LivebuyWidget` container (introduce-dropin-widget-container-rn).
//
// Parity source: iOS `LivebuyWidget.swift`'s pure guards
// (`lbWidgetShouldUseDemoFallback` / `lbWidgetShouldAutoRefreshTick`) + the
// controller's load lifecycle. On RN the widget data is HOST-WIRED (design D7):
// the `WidgetTemplateAttachment` has NO reload / requestLoadMore, so the container
// fetches each page itself via core `LivebuySDK.fetchWidget` and feeds the result
// into `handleWidgetSnapshot` / `handleWidgetColors` (the latter takes the whole
// `/sdk/widget` ROOT SETTINGS snapshot: web-embed colors + `product_card`). These
// helpers isolate that
// logic from React so it is unit-testable with fakes (mirrors the player
// container's pure `seams.ts`).

import { decodeWidgetSnapshot } from 'livebuy-react-native-ui';
import type { LBWidgetSnapshot, WidgetTemplateAttachment } from 'livebuy-react-native-ui';
import type { LBVideoItem, LBWidgetSettings } from 'livebuy-react-native';

import { WidgetSeeds, widgetGoodsFromFeatured } from '../widget/WidgetModel';
import type { WidgetGoods } from '../widget/WidgetModel';

/** Container layout mode. carousel / grid only (floating / minimized need a single live). */
export type WidgetContainerMode = 'carousel' | 'grid';

/**
 * Demo-fallback decision: show fixtures only when the live fetch is empty AND the
 * host opted in. Pure (parity with iOS `lbWidgetShouldUseDemoFallback`).
 */
export function lbWidgetShouldUseDemoFallback(videosEmpty: boolean, enabled: boolean): boolean {
  return videosEmpty && enabled;
}

/**
 * Auto-refresh tick guard: skip while showing demo fixtures, and skip once a grid
 * has paged forward (`currentPage > 1`) — re-fetching page 1 would collapse the
 * accumulated pages. Pure (parity with iOS `lbWidgetShouldAutoRefreshTick`).
 */
export function lbWidgetShouldAutoRefreshTick(usingDemo: boolean, currentPage: number): boolean {
  return !usingDemo && currentPage <= 1;
}

/**
 * Non-external card-tap routing (dropin-widget-default-open-player-rn, parity Android
 * `lbWidgetEffectiveTap` / iOS `effectiveOnTapVideo`): the host's `hostTap` when wired (full
 * override — the default never runs), else `openDefaultPlayer` (opens the in-app player). A host
 * wanting tap to be a true no-op passes `onTapVideo = () => {}`. Pure so the container and jest
 * share one implementation. External-platform lives never reach here (handled by the enclosing
 * `externalLiveAwareTap` in `WidgetOverlayView`, highest precedence).
 */
export function lbWidgetEffectiveTap(
  hostTap: ((item: LBVideoItem) => void) | undefined,
  openDefaultPlayer: (item: LBVideoItem) => void,
): (item: LBVideoItem) => void {
  return hostTap ?? openDefaultPlayer;
}

/**
 * Resolve the effective per-card goods overlay function for the turnkey
 * `LivebuyWidget` container (`rb-rn-video-linked-goods-auto-render`, RN sibling of
 * Flutter's `lbWidgetResolvedGoodsFor`): host-supplied `hostGoodsFor` (config.goodsFor)
 * takes FULL priority when provided (a complete override, including a per-item
 * explicit `null` return to hide that card); else, while showing the opted-in demo
 * fixtures (`usingDemo`), the deterministic {@link WidgetSeeds.goodsFor} seed overlay
 * (unchanged — the demo fixtures never carry `.goods`); else (the common real-host
 * case: no `goodsFor` wired, live data) each card's overlay is derived from its own
 * core `item.goods` (`video-linked-goods-core-rn`) via {@link widgetGoodsFromFeatured}
 * — `item.goods == null` → no card, same as before this default existed. Pure — no
 * React dependency — so the container and its tests share one implementation.
 */
export function lbWidgetResolvedGoodsFor(
  hostGoodsFor: ((item: LBVideoItem) => WidgetGoods | null) | undefined,
  { usingDemo }: { usingDemo: boolean },
): (item: LBVideoItem) => WidgetGoods | null {
  if (hostGoodsFor != null) return hostGoodsFor;
  if (usingDemo) return WidgetSeeds.goodsFor;
  return (item: LBVideoItem) => widgetGoodsFromFeatured(item.goods);
}

/**
 * Build the host-bindable {@link LBWidgetSettings} — the `/sdk/widget` response ROOT
 * SETTINGS — from a raw `fetchWidget` map: the two web-embed colors PLUS the carousel
 * product-card mode (`product_card`). Raw passthrough — no semantics are interpreted here
 * and the backend's own `product_card` default (`'inside'`) is NOT substituted (applying
 * that fallback is the card layer's job: `normalizeProductCardMode`).
 *
 * Returns `null` only when NONE of the THREE keys is present (nothing to forward — the
 * view-model keeps its current values). The presence test MUST cover `product_card` too:
 * gating on the two colors alone silently DROPPED a response that carried `product_card`
 * but no color key, because the caller skips `handleWidgetColors` entirely on `null`
 * (rb-rn-widget-product-card-modes D8).
 *
 * A key whose type does not match is treated as "the backend sent nothing" and lands on
 * that field's view-model default. That is not a patch-vs-snapshot compromise: the
 * `handleWidgetColors` contract takes ONE response's COMPLETE root-settings snapshot, and
 * this builder already behaved that way for a response carrying only one of the two colors.
 */
export function buildWidgetSettings(raw: Record<string, unknown>): LBWidgetSettings | null {
  const hasColor = typeof raw.widget_color === 'number';
  const hasBg = typeof raw.widget_bgcolor === 'string';
  const hasProductCard = typeof raw.product_card === 'string';
  if (!hasColor && !hasBg && !hasProductCard) return null;
  return {
    widgetColor: hasColor ? (raw.widget_color as number) : 1,
    widgetBgcolor: hasBg ? (raw.widget_bgcolor as string) : null,
    productCard: hasProductCard ? (raw.product_card as string) : null,
  };
}

/**
 * Grid pagination accumulation. `append` → concat the new page onto the prior
 * accumulated list (grid load-more); else → replace (first load / carousel / refresh).
 */
export function accumulateGridVideos(
  prev: readonly LBVideoItem[],
  decoded: readonly LBVideoItem[],
  append: boolean,
): readonly LBVideoItem[] {
  return append ? [...prev, ...decoded] : decoded;
}

/**
 * The deterministic demo snapshot fed (via `handleWidgetSnapshot`) when the live
 * fetch is empty AND the host opted in. Built from {@link WidgetSeeds} for the
 * chosen `mode` (parity with iOS `demoModel(for:)`).
 */
export function lbWidgetDemoSnapshot(mode: WidgetContainerMode): LBWidgetSnapshot {
  return {
    videos: WidgetSeeds.videos,
    mode,
    currentPage: WidgetSeeds.gridCurrentPage,
    lastPage: WidgetSeeds.gridLastPage,
  };
}

/** Injectable side-effect deps for {@link loadWidgetPage} (fake-able in tests). */
export interface LoadWidgetPageDeps {
  /** core `LivebuySDK.fetchWidget` (raw snake_case map). */
  fetchWidget: (shopId: string, page: number) => Promise<Record<string, unknown>>;
  /** The attached widget template's snapshot / colors forwarders. */
  attachment: Pick<WidgetTemplateAttachment, 'handleWidgetSnapshot' | 'handleWidgetColors'>;
  shopId: string;
  mode: WidgetContainerMode;
  /** Prior accumulated videos (for grid append). */
  accumulated: readonly LBVideoItem[];
  /**
   * Whether THIS call should toggle `isLoading` around the fetch
   * (rb-rn-widget-loading-placeholder). Has no effect when the caller's `append`
   * argument to {@link loadWidgetPage} is `true` (a grid load-more never touches
   * `isLoading`, regardless of this flag). Only the very-first page-1 load — before
   * ANY page has ever successfully loaded for this attachment — should pass `true`;
   * a periodic same-page refresh of an already-loaded widget MUST pass `false`, or the
   * placeholder would re-cover already-visible content. See
   * {@link lbWidgetShouldAnnounceLoading}.
   */
  announceLoading: boolean;
}

/** Decoded pagination result the container stores to drive load-more / refresh. */
export interface LoadWidgetPageResult {
  videos: readonly LBVideoItem[];
  currentPage: number;
  lastPage: number;
}

/**
 * Whether a {@link loadWidgetPage} call should announce `isLoading` around its fetch
 * (rb-rn-widget-loading-placeholder). `true` only while no page has EVER successfully
 * loaded for the calling attachment — once a page has loaded, later calls (a periodic
 * same-page refresh, or a grid load-more) MUST NOT re-cover already-visible content
 * with the first-load placeholder. Pure (parity with the other guards in this file);
 * the caller tracks `hasLoadedOnce` itself (see `LivebuyWidget.tsx`'s load effect).
 */
export function lbWidgetShouldAnnounceLoading(hasLoadedOnce: boolean): boolean {
  return !hasLoadedOnce;
}

/**
 * Fetch ONE page of widget content and feed it into the attached template:
 * `fetchWidget` → `decodeWidgetSnapshot` → accumulate → inject `mode` →
 * `handleWidgetSnapshot`; raw ROOT SETTINGS (the two web-embed colors + `product_card`) →
 * `handleWidgetColors`. Returns the decoded pagination so the container updates its page /
 * accumulated state. Pure of React (all side effects injected) so it is unit-testable with
 * fakes.
 *
 * `isLoading` (rb-rn-widget-loading-placeholder): when `!append && deps.announceLoading`,
 * this function toggles `isLoading` around the fetch — `true` right before
 * `fetchWidget`, merged back to `false` in the SAME `handleWidgetSnapshot` call that
 * carries the decoded page on success (one coalesced notification), or set back to
 * `false` (then rethrown) if `fetchWidget` rejects — a failed fetch MUST NOT leave the
 * placeholder stuck forever. Any other call (`append` — grid load-more — or
 * `announceLoading === false` — a periodic refresh of an already-loaded page) never
 * touches `isLoading` at all. The pre-fetch announce ALSO carries `mode: deps.mode` —
 * without it, a `LivebuyWidget mode="grid"`'s very-first load would dispatch through
 * `WidgetOverlayView` on the content model's stale default mode (`'carousel'`, until
 * the first real snapshot arrives) and briefly show the CAROUSEL-shaped placeholder
 * before flipping to the grid shape once the fetch resolves.
 */
export async function loadWidgetPage(
  deps: LoadWidgetPageDeps,
  page: number,
  append: boolean,
): Promise<LoadWidgetPageResult> {
  const announce = !append && deps.announceLoading;
  if (announce) {
    deps.attachment.handleWidgetSnapshot({ isLoading: true, mode: deps.mode });
  }

  let raw: Record<string, unknown>;
  try {
    raw = await deps.fetchWidget(deps.shopId, page);
  } catch (error) {
    if (announce) {
      deps.attachment.handleWidgetSnapshot({ isLoading: false });
    }
    throw error;
  }

  const decoded = decodeWidgetSnapshot(raw);
  const videos = accumulateGridVideos(deps.accumulated, decoded.videos ?? [], append);
  const currentPage = decoded.currentPage ?? page;
  const lastPage = decoded.lastPage ?? currentPage;
  deps.attachment.handleWidgetSnapshot({
    videos,
    mode: deps.mode,
    currentPage,
    lastPage,
    ...(announce ? { isLoading: false } : {}),
  });
  const settings = buildWidgetSettings(raw);
  if (settings != null) deps.attachment.handleWidgetColors(settings);
  return { videos, currentPage, lastPage };
}
