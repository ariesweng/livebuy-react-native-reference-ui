// VideoShopGridView — family-5 widget surface 2 (影音商城 / LBPVideoShop).
//
// Spec: `reference-ui-rendering/spec.md` (family-5 widget surfaces). Phase-4 RN
// sibling of the DONE iOS `VideoShopGridView.swift` (rb-ios-widget), Android
// `VideoShopGridView.kt` (rb-android-widget), and Flutter `video_shop_grid.dart`
// (rb-flutter-widget — the authoritative blueprint translated here 1:1). Design:
// `design/templates/minimal/widgets.jsx` `LBPVideoShop` (lines 290-355).
//
// The 影音商城 widget surface: a 2-COLUMN grid of shared `CarouselCardView` cells
// plus a centered load-more / end-of-list footer. It is the second of the four
// family-5 widget surfaces composed by `WidgetOverlayView` (selected when
// `content.mode === LBWidgetContentMode.Grid`). It implements the frozen SUB-VIEW
// INPUT PATTERN documented verbatim in `WidgetOverlayView.tsx`:
//
//   VideoShopGrid(props: {
//       theme: ReferenceUITheme;                              // 1. theme FIRST, always.
//       videos: readonly LBVideoItem[];                       // 2. bound SNAPSHOT VALUES by value.
//       currentPage: number;
//       lastPage: number;
//       goodsFor?: (item: LBVideoItem) => WidgetGoods | null; //    per-card overlay.
//       onTapVideo?: (item: LBVideoItem) => void;             // 3. action callbacks
//       onLoadMore?: () => void;                              //    LAST, each optional.
//   }): ReactElement
//
// REUSED PRIMITIVE: every grid cell is a shared `CarouselCardView` (the family-5
// 9:16 card — LBPCarouselCard). This surface NEVER re-draws a card from scratch; it
// only arranges `CarouselCardView`s into rows of TWO + draws the footer. The cell
// width is a FIXED half-column ({@link CELL_WIDTH}) so the two columns split the
// fixed snapshot canvas evenly (the design passes `width="100%"` to the card inside a
// `repeat(2, 1fr)` grid). `CarouselCardView` takes an explicit `width`, so each cell
// is handed the resolved half-column rather than a flexible cell (a flexible cell +
// a fixed card width would fight / overflow), parity with the iOS / Android / Flutter
// `cellWidth`.
//
// ⚠️ RENDER DISCIPLINE — NO ScrollView / FlatList / SectionList / VirtualizedList in
// rendered content (the verified family-1..4 + iOS / Android / Flutter lesson). The
// design's `LBPVideoShop` is an INFINITE-SCROLL grid inside an `overflowY: auto`
// container; here it is drawn as a PLAIN Column (`View`) of `Row` (`View`) rows (TWO
// cards per row) over a FIXED SMALL set of `videos` (capped at {@link MAX_GRID_CARDS}).
// The real scroll / pagination is NOT implemented at this layer — the load-more intent
// is forwarded to the host-wired `onLoadMore`.
//
// FOOTER (LBPVideoShop 344-351): a centered footer row. When more pages remain
// (`currentPage < lastPage`) it shows the「載入更多影片...」load-more affordance (a
// host-wired exit → `onLoadMore`); when the last page has been reached
// (`currentPage >= lastPage`, inclusive — Key Invariant: the widget list uses
// `current_page == last_page`) it shows the terminal「已顯示全部影片」label (inert).
// The design auto-loads via an `IntersectionObserver` sentinel; this layer instead
// forwards the intent through the host-wired `onLoadMore` (no auto-scroll / no
// pagination here).
//
// One-way data flow: this surface reads ONLY its passed-in `videos` / `currentPage` /
// `lastPage` snapshot + `theme`; it never reaches back into `WidgetModel` /
// `DefaultWidgetTemplate`, holds NO second copy of the list, and NEVER loads /
// paginates / opens the player itself. Card tap → `onTapVideo(item)` (host-wired);
// footer load-more → `onLoadMore` (host-wired). It renders correctly with all actions
// omitted (so demo / golden / widget tests construct it action-free). Plain View / Text /
// Pressable only; deterministic placeholders; NO network-uri Image; NO animation /
// randomness.
//
// ── EMBED COLORS (rb-rn-widget-embed-colors) ─────────────────────────────────────
// This IS one of the widget surfaces that INTERPRET `widgetColor` / `widgetBgcolor`: the
// body below paints with `theme`, derived from the caller-supplied `resolvedTheme` via
// `ReferenceUIWidgetEmbedTheme.derive`. Scope is strictly this surface —
// `ReferenceUIThemeResolver` still never sees these two values, and the player / sheets /
// floating / minimized keep the underived theme.
//
// This surface's render path paints `theme.background` (the container style below).
// `Carousel` also paints its own root container's `theme.background`
// (rb-rn-carousel-bgcolor) — `widget_bgcolor` is therefore visible on both family-5
// widget surfaces, not just this one.

import type { ReactElement } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../TightText';

import type { ReferenceUITheme } from '../theme';
import { ReferenceUIWidgetEmbedTheme } from '../widgetEmbedTheme';
import { LBTestIDs, gridCard } from '../testing/LBTestIDs';
import { CarouselCardView } from './CarouselCardView';
import { widgetGoodsFromFeatured } from './WidgetModel';
import type { WidgetGoods } from './WidgetModel';

import type { LBVideoItem } from 'livebuy-react-native';

// MARK: - Layout tokens (LBPVideoShop literal spacing)

/** Outer grid padding (`padding: '12px 12px 8px'`, LBPVideoShop 333). */
const GRID_PADDING = 12;

/** Inter-cell / inter-row gap (`gap: 10`, LBPVideoShop 332). */
const GRID_GAP = 10;

/**
 * FIXED SMALL grid cap — a PLAIN Column of a bounded N (NEVER lazy / scroll). The real
 * infinite scroll is host-driven via {@link VideoShopGridProps.onLoadMore}. Parity
 * with iOS / Android / Flutter `maxGridCards`.
 */
const MAX_GRID_CARDS = 6;

/**
 * The per-cell half-column width. `CarouselCardView` uses a FIXED `width`, so we pin a
 * concrete half-column rather than a flexible cell (a flexible cell + a fixed card
 * width would fight). On the fixed 393-wide golden canvas the usable half-column is
 * `(393 - GRID_PADDING*2 - GRID_GAP) / 2 ≈ 179.5` — parity with Android `cellWidth =
 * 179.dp` / iOS `cellWidth(forContainerWidth:)` / Flutter `_cellWidth = 179`.
 */
const CELL_WIDTH = 179;

// MARK: - Fixed presentation strings

const LOAD_MORE_LABEL = '載入更多影片...';
const END_OF_LIST_LABEL = '已顯示全部影片';

/** Props for the family-5 影音商城 widget surface (mirrors the skeleton call site). */
export interface VideoShopGridProps {
  /**
   * The resolved reference-ui theme (FIRST — SUB-VIEW INPUT PATTERN), AS SUPPLIED by the
   * caller (`ReferenceUIThemeResolver` output), before this surface overlays the
   * `/sdk/widget` embed colors. The footer end-of-list label uses the DERIVED dimmed
   * `theme.text`; the load-more affordance uses `theme.accent`; cards paint their own
   * theme-driven title color (via {@link CarouselCardView}). The grid sits on the DERIVED
   * `theme.background`.
   */
  readonly theme: ReferenceUITheme;
  /**
   * The republished read-only widget video snapshot (the grid cells —
   * `content.videos`). This layer MUST NOT slice / merge / re-sort beyond the
   * {@link MAX_GRID_CARDS} snapshot cap. Read-only.
   */
  readonly videos: readonly LBVideoItem[];
  /**
   * Current page (`content.currentPage`). Combined with {@link lastPage} it gates the
   * footer copy.
   */
  readonly currentPage: number;
  /**
   * Last page (`content.lastPage`). `currentPage < lastPage` →「載入更多影片...」else
   * →「已顯示全部影片」.
   */
  readonly lastPage: number;
  /**
   * Optional per-card product overlay resolver (reference-ui {@link WidgetGoods}).
   * OMITTED (the most common case, `rb-rn-video-linked-goods-auto-render`) → each
   * cell's overlay is DERIVED BY DEFAULT from the core `item.goods`
   * (`video-linked-goods-core-rn`) via {@link widgetGoodsFromFeatured} — `item.goods
   * == null` → no overlay on that cell, non-null → the four fields are converted
   * verbatim. PROVIDED → the resolver's return value is a full OVERRIDE for every
   * cell, taking precedence over `item.goods` (including an explicit `null` return,
   * which hides that cell's overlay even when `item.goods` is non-null). The
   * container passes `WidgetSeeds.goodsFor` for the demo / golden path.
   */
  readonly goodsFor?: (item: LBVideoItem) => WidgetGoods | null;
  /**
   * Live-flag gate forwarded to every {@link CarouselCardView} cell. `false` (default —
   * snapshot / demo) → placeholder covers only; `true` (host runtime) → real
   * `video.cover` photos load over the placeholders.
   */
  readonly live?: boolean;
  /**
   * RAW `product_card` wire value (`WidgetModel.productCard`), forwarded VERBATIM to every
   * grid cell's {@link CarouselCardView} — this surface does NOT normalize it (the single
   * fallback entry point lives on the card: `normalizeProductCardMode`). Omitted → the
   * cells fall back to `'inside'`, i.e. today's pixels. Reaches here from
   * `WidgetOverlayView` via {@link ScrollableVideoShopView} (grid mode's only upstream).
   */
  readonly productCard?: string | null;
  /**
   * RAW `widget_color` wire value (`WidgetModel.widgetColor`) — the web-embed TEXT COLOR
   * MODE. `2`（色彩反轉）turns every `theme.text` paint site in this surface `#FFFFFF`;
   * `1`（預設色彩）and any other value leave the resolved text untouched. Omitted → `1`,
   * i.e. today's pixels. Reaches here from `WidgetOverlayView` via
   * {@link ScrollableVideoShopView} (grid mode's only upstream).
   */
  readonly widgetColor?: number;
  /**
   * RAW `widget_bgcolor` wire value (`WidgetModel.widgetBgcolor`) — the web-embed
   * BACKGROUND COLOR, painted by this surface's container. Overrides `theme.background`
   * only when it parses as hex; `''` (the backend's "transparent"), `null` and
   * unparseable values all leave it alone and MUST NOT be read as transparent. `Carousel`
   * also paints its own root container's `theme.background` (rb-rn-carousel-bgcolor).
   */
  readonly widgetBgcolor?: string | null;
  /**
   * Card tap → host-wired exit (→ host → core open player for `item.id`). Omitted for
   * demo / golden instances. This layer NEVER opens the player itself.
   */
  readonly onTapVideo?: (item: LBVideoItem) => void;
  /**
   * Footer「載入更多影片...」→ host-wired exit (→ host → core `requestLoadMore()`).
   * Omitted for demo / golden instances — the affordance is inert. This layer NEVER
   * loads / paginates itself.
   */
  readonly onLoadMore?: () => void;
  /**
   * LAZY-LOAD wrapper support (rb-rn-widget-grid-lazy-load): {@link MAX_GRID_CARDS}
   * (default) bounds the PLAIN Column to a fixed golden-stable set; `null` renders ALL
   * videos (used by the scroll wrapper, which is never structural-snapshotted).
   */
  readonly maxCards?: number | null;
  /**
   * `true` (the scroll wrapper drives auto-load on scroll) → the footer drops its
   * tappable button for a dim caption. `false` (default) keeps the existing pixels /
   * snapshots / callers.
   */
  readonly autoLoadOnScroll?: boolean;
}

/** Whether more pages remain (LBPVideoShop's `hasMore`): `currentPage < lastPage`. */
function hasMore(currentPage: number, lastPage: number): boolean {
  return currentPage < lastPage;
}

/**
 * Chunk the FIXED SMALL set of videos into rows of TWO. Bounded to {@link MAX_GRID_CARDS}
 * so the PLAIN Column stays golden-stable (the design's infinite scroll is host-driven
 * via `onLoadMore`, not rendered here). Parity with iOS `rows` / Android
 * `videos.take(maxGridCards).chunked(2)` / Flutter `_rows`.
 */
function chunkRows(videos: readonly LBVideoItem[], maxCards: number | null): LBVideoItem[][] {
  const cap = maxCards ?? videos.length;
  const capped = videos.length > cap ? videos.slice(0, cap) : videos.slice();
  const out: LBVideoItem[][] = [];
  for (let i = 0; i < capped.length; i += 2) {
    out.push(capped.slice(i, Math.min(i + 2, capped.length)));
  }
  return out;
}

/**
 * The family-5 影音商城 widget surface (`LBPVideoShop`): a 2-column grid of shared
 * {@link CarouselCardView}s over a FIXED SMALL set of {@link VideoShopGridProps.videos},
 * plus a centered footer that shows「載入更多影片...」(host-wired `onLoadMore`) while
 * more pages remain, else the terminal「已顯示全部影片」. Card tap forwards
 * `onTapVideo(item)`; this layer never scrolls / paginates / opens the player itself.
 *
 * SUB-VIEW INPUT PATTERN: `theme` first → bound snapshot values by value (`videos` /
 * `currentPage` / `lastPage` + the per-card `goodsFor` resolver) → trailing action
 * callbacks, each optional (defaulting to a no-op exit).
 */
export function VideoShopGrid(props: VideoShopGridProps): ReactElement {
  const {
    theme: resolvedTheme,
    videos,
    currentPage,
    lastPage,
    goodsFor,
    live = false,
    productCard,
    widgetColor = 1,
    widgetBgcolor = null,
    onTapVideo,
    onLoadMore,
  } = props;

  // EMBED COLORS (rb-rn-widget-embed-colors): overlay the two `/sdk/widget` values onto
  // the caller-supplied theme. Every paint site below — including the container's
  // `theme.background`, the one place `widget_bgcolor` is visible on any widget surface —
  // reads this derived value. Unconfigured → `derive` hands back `resolvedTheme` itself,
  // so today's pixels (and every existing baseline) are untouched.
  const theme = ReferenceUIWidgetEmbedTheme.derive(resolvedTheme, widgetColor, widgetBgcolor);

  const maxCards = props.maxCards === undefined ? MAX_GRID_CARDS : props.maxCards;
  const autoLoadOnScroll = props.autoLoadOnScroll ?? false;
  const rows = chunkRows(videos, maxCards);
  const more = hasMore(currentPage, lastPage);

  return (
    <View testID={LBTestIDs.widgetGrid} style={[styles.container, { backgroundColor: theme.background }]}>
      {/* 2-column grid: PLAIN Column of Row rows (TWO cards per row) — NEVER a grid /
          FlatList. Each cell is handed the fixed half-column CELL_WIDTH so the two
          columns split the canvas evenly; CarouselCardView fills its cell. */}
      {rows.map((row, rowIndex) => (
        <View
          key={`grid-row-${rowIndex}`}
          style={[styles.row, rowIndex < rows.length - 1 ? styles.rowGap : null]}
        >
          {row.map((item, cellIndex) => (
            <View key={item.id} testID={gridCard(rowIndex * 2 + cellIndex)} style={styles.cell}>
              <CarouselCardView
                theme={theme}
                video={item}
                goods={goodsFor ? goodsFor(item) : widgetGoodsFromFeatured(item.goods)}
                width={CELL_WIDTH}
                live={live}
                // Raw hand-off — the card owns the single fallback (`normalizeProductCardMode`).
                productCard={productCard}
                onTap={onTapVideo ? () => onTapVideo(item) : undefined}
              />
            </View>
          ))}
          {/* Keep the 2-col grid rhythm when the final row has a single (odd) cell. */}
          {row.length === 1 ? <View style={styles.cell} /> : null}
        </View>
      ))}

      {/* Footer (載入更多影片... / 已顯示全部影片) — centered. */}
      <View style={styles.footer}>
        {more && autoLoadOnScroll ? (
          // Lazy-load drop-in (the scroll wrapper auto-loads): a NON-interactive dim caption —
          // no manual button (onLoadMore is fired by the wrapper's scroll detection, not a tap).
          <Text
            style={[styles.endOfListLabel, { color: theme.text, fontSize: 12 * theme.fontScale }]}
          >
            {LOAD_MORE_LABEL}
          </Text>
        ) : more ? (
          <Pressable testID={LBTestIDs.gridLoadMoreFooter} onPress={() => onLoadMore?.()} style={styles.footerHit}>
            <Text style={[styles.loadMoreLabel, { color: theme.accent, fontSize: 12 * theme.fontScale }]}>
              {LOAD_MORE_LABEL}
            </Text>
          </Pressable>
        ) : (
          <Text testID={LBTestIDs.gridEndLabel} style={[styles.endOfListLabel, { color: theme.text, fontSize: 12 * theme.fontScale }]}>
            {END_OF_LIST_LABEL}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: GRID_PADDING,
    paddingTop: GRID_PADDING,
    alignItems: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rowGap: {
    marginBottom: GRID_GAP,
  },
  cell: {
    width: CELL_WIDTH,
    marginRight: GRID_GAP,
  },
  footer: {
    width: '100%',
    paddingTop: 14,
    paddingBottom: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerHit: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreLabel: {
    fontWeight: '600',
    textAlign: 'center',
  },
  endOfListLabel: {
    // Dimmed end-of-list label — parity with iOS / Android / Flutter `text.opacity(0.5)`.
    opacity: 0.5,
    textAlign: 'center',
  },
});
