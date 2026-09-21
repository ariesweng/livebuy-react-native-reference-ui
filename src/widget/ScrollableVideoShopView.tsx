// ScrollableVideoShopView — family-5 wrapper tier (RN, lazy-load drop-in).
//
// Spec: `reference-ui-rendering/spec.md` (RN wrapper 子層 — 捲到底自動載入).
// Parity: iOS `ScrollableVideoShopView.swift` + Android `ScrollableVideoShopView.kt` +
//          Flutter `scrollable_video_shop_view.dart` (rb-*-widget-grid-lazy-load) — the drop-in
//          scrolling video-shop grid that AUTO-LOADS on scroll-to-bottom (no manual「載入更多」
//          button). Four-platform parity.
//
// A thin, ZERO-new-pixel wrapper: it composes the existing structural-snapshot `VideoShopGrid`
// (in its `maxCards = null` render-ALL + `autoLoadOnScroll = true` mode) inside a `ScrollView`
// and watches `onScroll`. When the user scrolls near the bottom (within a prefetch margin) AND
// there is a next page it AUTO-fires the host-wired `onLoadMore` (→ core `requestLoadMore`),
// per-page debounced (keyed on `currentPage`).
//
// WRAPPER TIER RULES (mirrors iOS / Android / Flutter): MAY own the scroll container; ZERO new
// pixels (all pixels come from `VideoShopGrid`); interactions pass through as host-wired
// callbacks; the auto-load decision is covered by the pure {@link shouldAutoLoadMore} unit
// test + the surface's own structural snapshots — the wrapper is NEVER snapshot-baselined.
//
// PREVIEW SCROLL SIGNAL (rb-rn-widget-preview-offscreen-decoder-release): because this wrapper
// OWNS the scroll container, it is the one place that knows the grid is scrolling — and RN's
// `onLayout` never re-fires on an ancestor scroll, so the cards' `LoopingVideoView` off-screen
// measurement would otherwise be stuck at its mount-time value. The wrapper therefore provides a
// `LivebuyPreviewScrollSignalContext` over its subtree and emits on `onScroll` (JS-throttled,
// `previewScrollSignalThrottleMs()`), `onScrollEndDrag` and `onMomentumScrollEnd` (always, so the
// final resting visibility is always re-measured). Each card re-measures on emit; on Android the
// `release` policy then keeps only the cards known to be on screen holding a decoder (the grid is
// render-ALL — page 1 is 9 cards, load-more makes it 18+, and every paused `<Video>` still holds
// a `MediaCodec`). The Provider is not a host element and the two new `ScrollView` props are
// invisible to structural snapshots (this wrapper has none). Zero new pixels still holds.

import type { ReactElement } from 'react';
import { useRef } from 'react';
import { ScrollView, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import type { LBVideoItem } from 'livebuy-react-native';

import type { ReferenceUITheme } from '../theme';
import type { WidgetGoods } from './WidgetModel';
import { VideoShopGrid } from './VideoShopGridView';
import {
  LivebuyPreviewScrollSignalContext,
  usePreviewScrollSignalEmitter,
} from './livebuyPreviewScrollSignal';

/** Auto-load prefetch margin (logical px) from the bottom — fire before the very bottom. */
const PREFETCH_MARGIN = 300;

/**
 * PURE auto-load decision (extracted for unit testing — the wrapper is never
 * snapshot-baselined). Auto-load iff there is a next page (`currentPage < lastPage`), this page
 * hasn't already triggered (`currentPage !== lastTriggeredPage`), and the scroll is within
 * `prefetch` of the bottom (`offsetY + layoutHeight >= contentHeight - prefetch`). Mirrors iOS /
 * Android / Flutter `shouldAutoLoadMore`.
 */
export function shouldAutoLoadMore(params: {
  currentPage: number;
  lastPage: number;
  lastTriggeredPage: number;
  offsetY: number;
  layoutHeight: number;
  contentHeight: number;
  prefetch: number;
}): boolean {
  const { currentPage, lastPage, lastTriggeredPage, offsetY, layoutHeight, contentHeight, prefetch } =
    params;
  if (currentPage >= lastPage) return false; // hasMore
  if (currentPage === lastTriggeredPage) return false; // this page already triggered
  return offsetY + layoutHeight >= contentHeight - prefetch; // near the bottom
}

/** Props for {@link ScrollableVideoShopView}. */
export interface ScrollableVideoShopProps {
  readonly theme: ReferenceUITheme;
  readonly videos: readonly LBVideoItem[];
  readonly currentPage: number;
  readonly lastPage: number;
  readonly goodsFor?: (item: LBVideoItem) => WidgetGoods | null;
  /** Live-flag gate forwarded to `VideoShopGrid` → cards (real cover at host runtime). */
  readonly live?: boolean;
  /**
   * RAW `product_card` wire value, a PASS-THROUGH parameter: this wrapper adds no pixels
   * and does not normalize, it only hands `WidgetOverlayView`'s `model.productCard` on to
   * `VideoShopGrid` → the cells' cards. Grid mode dispatches through this wrapper ONLY, so
   * without this hop the grid chain would break here. Omitted → the cards fall back to
   * `'inside'`.
   */
  readonly productCard?: string | null;
  /**
   * RAW `widget_color` wire value — a PASS-THROUGH parameter, exactly like
   * {@link ScrollableVideoShopProps.productCard}: this wrapper adds no pixels and does NOT
   * derive, it only hands `WidgetOverlayView`'s `model.widgetColor` on to `VideoShopGrid`,
   * which owns the single derivation (rb-rn-widget-embed-colors design RD5). Grid mode
   * dispatches through this wrapper ONLY, so without this hop the chain would break here —
   * silently, since the default is the identity value.
   */
  readonly widgetColor?: number;
  /** RAW `widget_bgcolor` wire value — the same PASS-THROUGH hop as {@link widgetColor}. */
  readonly widgetBgcolor?: string | null;
  readonly onTapVideo?: (item: LBVideoItem) => void;
  readonly onLoadMore?: () => void;
}

/**
 * The drop-in scrolling video-shop grid (wrapper tier — zero new pixels): a `ScrollView` around
 * `VideoShopGrid(maxCards={null} autoLoadOnScroll)` that auto-loads the next page when the user
 * scrolls near the bottom. Host wires `onTapVideo` / `onLoadMore`; no manual「載入更多」button.
 */
export function ScrollableVideoShopView(props: ScrollableVideoShopProps): ReactElement {
  const {
    theme,
    videos,
    currentPage,
    lastPage,
    goodsFor,
    live = false,
    productCard,
    widgetColor,
    widgetBgcolor,
    onTapVideo,
    onLoadMore,
  } = props;

  // The `currentPage` we last auto-loaded for, so the same page only triggers ONE `onLoadMore`
  // (per-page debounce). Re-armed when a new page loads (`currentPage` increments).
  const lastTriggeredPage = useRef(-1);

  // Preview scroll signal (see the file header): one stable emitter per wrapper instance.
  const previewScroll = usePreviewScrollSignalEmitter();

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    if (
      shouldAutoLoadMore({
        currentPage,
        lastPage,
        lastTriggeredPage: lastTriggeredPage.current,
        offsetY: contentOffset.y,
        layoutHeight: layoutMeasurement.height,
        contentHeight: contentSize.height,
        prefetch: PREFETCH_MARGIN,
      })
    ) {
      lastTriggeredPage.current = currentPage;
      onLoadMore?.();
    }
    // Same handler, after the load-more decision: wake the cards to re-measure (throttled).
    previewScroll.emitThrottled();
  };

  // Drag / momentum end: always emit so the resting visibility is re-measured (not throttled).
  const handleScrollEnd = (): void => {
    previewScroll.emitNow();
  };

  return (
    <LivebuyPreviewScrollSignalContext.Provider value={previewScroll.source}>
      <ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollEnd={handleScrollEnd}
      >
        <VideoShopGrid
          theme={theme}
          videos={videos}
          currentPage={currentPage}
          lastPage={lastPage}
          goodsFor={goodsFor}
          live={live}
          productCard={productCard}
          // Raw hand-off — the grid owns the single derivation
          // (`ReferenceUIWidgetEmbedTheme.derive`); this wrapper draws nothing itself.
          widgetColor={widgetColor}
          widgetBgcolor={widgetBgcolor}
          onTapVideo={onTapVideo}
          onLoadMore={onLoadMore}
          // Render ALL videos (no fixed cap) + drop the manual footer button — the wrapper drives
          // the load on scroll.
          maxCards={null}
          autoLoadOnScroll
        />
      </ScrollView>
    </LivebuyPreviewScrollSignalContext.Provider>
  );
}
