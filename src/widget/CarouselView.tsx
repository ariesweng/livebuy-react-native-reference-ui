// CarouselView — family-5 widget surface 1 (LBPCarousel, horizontal card row) — RN .tsx.
//
// Spec: `reference-ui-rendering/spec.md` (family-5 widget surfaces — "渲染 Carousel
// widget"). Phase-4 RN sibling of the DONE iOS `CarouselView.swift` (rb-ios-widget),
// Android `CarouselView.kt` (rb-android-widget), and Flutter `carousel.dart`
// (rb-flutter-widget — the authoritative blueprint translated here 1:1). Design:
// `design/templates/minimal/widgets.jsx` `LBPCarousel` (lines 163-248).
//
// The first of the four family-5 widget surfaces dispatched by `WidgetOverlayView`
// (selected when `content.mode === carousel`). It reproduces `LBPCarousel`'s
// structure:
//
//   • a HEADER ROW (widgets.jsx 208-219): the section `title` (heavy) with an
//     optional `subtitle` (dim) on the leading side, and a「查看更多 ›」accent link
//     on the trailing side — shown only when `title` is non-empty OR a `subtitle`
//     exists (mirrors `LBPCarousel`'s `(title || subtitle) && (...)`),
//   • a single PLAIN Row of shared `CarouselCardView`s (widgets.jsx 220-245) built
//     from the passed-in `videos`.
//
// ── NO scrollable (the verified family rule) ─────────────────────────────────────
//   The design's row is HORIZONTALLY SCROLLABLE (`overflowX: 'auto'`, drag-to-scroll).
//   The family rule (iOS `ImageRenderer` / Android Roborazzi / Flutter golden + the
//   established RN convention) FORBIDS any scrollable container — NO ScrollView /
//   FlatList / SectionList / VirtualizedList. So this surface lays a FIXED SMALL SET
//   (the visible first `MAX_CARDS`) of cards in a PLAIN `View` Row (`flexDirection:
//   'row'`). The real horizontal scroll / full-list navigation is a HOST concern — the
//   「查看更多 ›」link forwards via the host-wired `onSeeMore` exit, and each card tap
//   forwards via `onTapVideo`. This layer NEVER scrolls / paginates / opens the player
//   itself.
//
// ── CARD REUSE ───────────────────────────────────────────────────────────────────
//   Every card is the SHARED `CarouselCardView` primitive (the family-5
//   `LBPCarouselCard`) built by the skeleton — this surface MUST NOT re-draw a card
//   from scratch. The card owns the 9:16 thumbnail placeholder + LIVE / VOD kind badge
//   + product overlay + title; this surface only arranges a Row of them under a header.
//
// SUB-VIEW INPUT PATTERN (parity with families 1-4): theme FIRST → bound snapshot
// value(s) BY VALUE (`videos`, optional `title` / `subtitle`, per-card `goodsFor`, the
// two raw embed colors) → interaction callbacks (`onTapVideo` / `onSeeMore`) trailing,
// each optional / defaulting to a no-op. One-way data flow: this surface reads ONLY its
// passed-in values — it never reaches back into `WidgetModel` / `DefaultWidgetTemplate`,
// holds NO second copy of state, calls NO core `simulate*` / `requestLoadMore`, uses NO
// ScrollView / FlatList / grid / list / network-uri Image / animation / randomness, and
// renders correctly with all callbacks omitted (demo / golden / structural-snapshot
// tests).
//
// ── EMBED COLORS (rb-rn-widget-embed-colors, background layer: rb-rn-carousel-bgcolor) ──
//   This IS one of the widget surfaces that INTERPRET `widgetColor` / `widgetBgcolor`:
//   the body below paints with `theme`, which is derived from the caller-supplied
//   `resolvedTheme` via `ReferenceUIWidgetEmbedTheme.derive`. The single derivation site
//   covers BOTH the windowed and the `scrollable` branch (they share one `cardEls`), so
//   it spans two of the three logical widget surfaces on its own.
//
//   Scope is strictly this surface: `ReferenceUIThemeResolver` still never sees these
//   two values, and the player / sheets / floating / minimized keep the underived theme.
//   `widget_color` is visible here (header title / subtitle + every card title read
//   `theme.text`); `widget_bgcolor` is ALSO visible — the root container paints
//   `theme.background` (rb-rn-carousel-bgcolor, parity with `VideoShopGridView`'s
//   existing `styles.container` background paint).
//
// ── PREVIEW SCROLL SIGNAL (rb-rn-widget-preview-offscreen-decoder-release) ──────────────
//   The `scrollable` branch OWNS its horizontal `ScrollView`, so it is the one place that knows
//   the turnkey row is scrolling — and RN's `onLayout` never re-fires on an ancestor scroll, so
//   each card's `LoopingVideoView` off-screen measurement would otherwise stay at its mount-time
//   value (9 cards, 3 visible, 6 off-screen each still holding an Android decoder). That branch
//   therefore provides a `LivebuyPreviewScrollSignalContext` over its subtree and emits on
//   `onScroll` (JS-throttled, `previewScrollSignalThrottleMs()`), `onScrollEndDrag` and
//   `onMomentumScrollEnd` (always). The Provider is not a host element and the two new
//   `ScrollView` props are invisible to structural snapshots (the scrollable branch has none).
//   The WINDOWED branch is untouched: it is a plain Row and the real scroll belongs to the HOST's
//   ScrollView, whose events this surface cannot see — a host that wants the same behaviour there
//   can feed its own scroll events through the same context (see `livebuyPreviewScrollSignal.tsx`);
//   without that, those cards keep today's "measure at layout time only" behaviour.
//
// jsx automatic runtime — no `import React`. Returns `ReactElement`.

import type { ReactElement } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../TightText';

import type { ReferenceUITheme } from '../theme';
import { ReferenceUIWidgetEmbedTheme } from '../widgetEmbedTheme';
import { LBTestIDs, carouselCard } from '../testing/LBTestIDs';
import { CarouselCardView, DEFAULT_CARD_WIDTH } from './CarouselCardView';
import { widgetGoodsFromFeatured, WidgetSeeds } from './WidgetModel';
import type { WidgetGoods } from './WidgetModel';
import { LoadingMarkAnimation } from '../moments/loading-mark/LoadingMarkAnimation';
import {
  LivebuyPreviewScrollSignalContext,
  usePreviewScrollSignalEmitter,
} from './livebuyPreviewScrollSignal';

import type { LBVideoItem } from 'livebuy-react-native';

/** Default section title (the design's `LBPCarousel` default,「精選影片」). */
export const DEFAULT_CAROUSEL_TITLE = '精選影片';

/** Header「查看更多 ›」accent link label (widgets.jsx 219). */
const SEE_MORE_LABEL = '查看更多 ›';

/**
 * Max cards drawn in the FIXED static row (the rest live behind the host's real
 * horizontal scroll). Parity with iOS / Android / Flutter's capped static row.
 */
const MAX_CARDS = 6;

/** Props for the family-5 carousel surface (theme FIRST → snapshot → trailing callbacks). */
export interface CarouselProps {
  /**
   * The resolved reference-ui theme (FIRST — SUB-VIEW INPUT PATTERN), AS SUPPLIED by the
   * caller (`ReferenceUIThemeResolver` output), before this surface overlays the
   * `/sdk/widget` embed colors. The header title uses the DERIVED `theme.text`, the
   * subtitle a dim variant, the「查看更多 ›」link `theme.accent`.
   */
  readonly theme: ReferenceUITheme;
  /**
   * The card-row source (read-only — passed BY VALUE from `WidgetModel.videos`). Only
   * the visible first {@link MAX_CARDS} are drawn (FIXED SMALL set, NOT scrollable).
   * This surface never mutates / re-fetches.
   */
  readonly videos: readonly LBVideoItem[];
  /**
   * Section title (heavy, leading). Defaults to the design's「精選影片」
   * ({@link DEFAULT_CAROUSEL_TITLE}). An empty title AND a nullish subtitle hide the
   * entire header row (mirrors widgets.jsx 208).
   */
  readonly title?: string;
  /** Optional section subtitle (dim, below the title). Nullish / empty → no subtitle line. */
  readonly subtitle?: string;
  /**
   * Per-card product overlay resolver (reference-ui {@link WidgetGoods}).
   * OMITTED (the most common case, `rb-rn-video-linked-goods-auto-render`) → each
   * card's overlay is DERIVED BY DEFAULT from the core `item.goods`
   * (`video-linked-goods-core-rn`) via {@link widgetGoodsFromFeatured} — `item.goods
   * == null` → no overlay, non-null → the four fields are converted verbatim.
   * PROVIDED (host opts in, or demo / golden pass `WidgetSeeds.goodsFor`) → the
   * resolver's return value is a full OVERRIDE for every card, taking precedence
   * over `item.goods` (including an explicit `null` return, which hides that card's
   * overlay even when `item.goods` is non-null).
   */
  readonly goodsFor?: (item: LBVideoItem) => WidgetGoods | null;
  /**
   * Live-flag gate forwarded to every {@link CarouselCardView}. `false` (default —
   * snapshot / demo) → placeholder covers only; `true` (host runtime) → real
   * `video.cover` photos load over the placeholders.
   */
  readonly live?: boolean;
  /**
   * RAW `product_card` wire value (`WidgetModel.productCard`), forwarded VERBATIM to every
   * {@link CarouselCardView} in the row — this surface does NOT normalize it (the single
   * fallback entry point lives on the card: `normalizeProductCardMode`). Omitted → the
   * cards fall back to `'inside'`, i.e. today's pixels. The container
   * (`WidgetOverlayView`) passes `model.productCard`.
   */
  readonly productCard?: string | null;
  /**
   * RAW `widget_color` wire value (`WidgetModel.widgetColor`) — the web-embed TEXT COLOR
   * MODE. `2`（色彩反轉）turns every `theme.text` paint site in this surface `#FFFFFF`;
   * `1`（預設色彩）and any other value leave the resolved text untouched. Omitted → `1`,
   * i.e. today's pixels. The container (`WidgetOverlayView`) passes `model.widgetColor`.
   */
  readonly widgetColor?: number;
  /**
   * RAW `widget_bgcolor` wire value (`WidgetModel.widgetBgcolor`) — the web-embed
   * BACKGROUND COLOR, painted by this surface's root container (rb-rn-carousel-bgcolor,
   * parity with `VideoShopGridView`). Overrides `theme.background` only when it parses
   * as hex; `''` (the backend's "transparent"), `null` and unparseable values all leave
   * it alone and MUST NOT be read as transparent.
   */
  readonly widgetBgcolor?: string | null;
  /**
   * Card tap → host-wired exit (`onTapVideo(item)` → host → core open player for
   * `item.id`). Omitted for demo / golden instances — the row is inert. NEVER opens the
   * player itself.
   */
  readonly onTapVideo?: (item: LBVideoItem) => void;
  /**
   * Header「查看更多 ›」link → host-wired exit (navigate to the full video list).
   * Omitted → inert link. NEVER navigates itself.
   */
  readonly onSeeMore?: () => void;
  /**
   * Turnkey scroll mode (parity iOS `ScrollableCarouselView`). `false` (DEFAULT — embedded /
   * demo / golden) → a FIXED windowed plain Row of the first {@link MAX_CARDS} (snapshot-stable,
   * NO scroll). `true` (turnkey `WidgetOverlayView`) → a horizontal `ScrollView` over ALL
   * `videos` (uncapped), so the user can scroll through every video.
   */
  readonly scrollable?: boolean;
  /**
   * First-load-in-flight placeholder gate (rb-rn-widget-loading-placeholder, design D9).
   * `false` (DEFAULT) → existing behaviour: a non-empty `videos` draws the real card row;
   * an EMPTY `videos` now renders NOTHING at all (see the confirmed-empty return-null
   * note below — this supersedes the old "empty row + no header" shape). `true` → the
   * card row is replaced by {@link CarouselLoadingRow} (a same-height placeholder with a
   * centered brand `LoadingMarkAnimation`), regardless of `videos`; the header row keeps
   * rendering unchanged (host static copy, independent of data readiness). The container
   * (`WidgetOverlayView`) passes `model.isLoading`.
   */
  readonly loading?: boolean;
  /**
   * Header row host opt-out (`rb-rn-widget-carousel-header-visibility`). Default `true`
   * — omitted behaves exactly as today. The header row (title + optional subtitle +
   * 「查看更多 ›」link) renders only when BOTH this prop is `true` (host wants it) AND
   * there is content to draw ({@link DEFAULT_CAROUSEL_TITLE} / a non-empty `title`, or a
   * `subtitle` — the pre-existing "has content" check, internally `hasHeaderContent`).
   * `false` hides the ENTIRE header row regardless of `title` / `subtitle` content — no
   * finer-grained control (title-only / link-only). Card row rendering (`loading` / the
   * confirmed-empty `null` return) is completely unaffected by this prop.
   */
  readonly showsHeader?: boolean;
}

/**
 * First-load placeholder for the carousel card row (rb-rn-widget-loading-placeholder,
 * design `LBPCarouselLoadingRow`). Renders ONE real {@link CarouselCardView} — sized
 * exactly like a live card via the deterministic {@link WidgetSeeds.vodWithGoods} seed —
 * with `opacity: 0` + `pointerEvents: 'none'` (RN has no CSS `visibility: hidden`;
 * `opacity: 0` keeps the SAME measured footprint a real card row would occupy, unlike
 * `display: 'none'`, which collapses it to zero size) so the placeholder reserves the
 * real row's height, with the brand {@link LoadingMarkAnimation} (`size={76}`) centered
 * on top via `position: 'absolute'`. Deterministic — never reads live `videos`, so the
 * measured height never depends on the videos actually being fetched, and no
 * network-uri Image is ever pulled in.
 */
function CarouselLoadingRow(props: {
  theme: ReferenceUITheme;
  cardWidth: number;
  productCard?: string | null;
}): ReactElement {
  const { theme, cardWidth, productCard } = props;
  return (
    <View testID={LBTestIDs.widgetCarouselLoading} style={styles.loadingRoot}>
      <View
        style={styles.loadingHiddenCard}
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
      >
        <CarouselCardView
          theme={theme}
          video={WidgetSeeds.vodWithGoods}
          goods={WidgetSeeds.vodWithGoodsGoods}
          width={cardWidth}
          productCard={productCard}
        />
      </View>
      <View style={styles.loadingMarkWrap} pointerEvents="none">
        <LoadingMarkAnimation size={76} />
      </View>
    </View>
  );
}

/**
 * The family-5 `LBPCarousel` surface: a header row (title + optional subtitle +
 * 「查看更多 ›」accent link) above a PLAIN Row of a FIXED SMALL set of shared
 * `CarouselCardView`s built from `videos`. Card tap forwards via the host-wired
 * `onTapVideo` exit, the header link via `onSeeMore`; this layer never scrolls /
 * paginates / opens the player itself. Renders correctly with all callbacks omitted.
 *
 * First-load placeholder (rb-rn-widget-loading-placeholder, design D9): `loading` true →
 * the card row is replaced by {@link CarouselLoadingRow} (header unaffected); `loading`
 * false AND `videos` confirmed empty → the whole surface renders `null` (no header
 * either) — a widget with nothing to show is equivalent to the host never mounting it.
 *
 * Header host opt-out (rb-rn-widget-carousel-header-visibility): `showsHeader` (default
 * `true`) is ANDed with the pre-existing "has content" check — `showsHeader={false}`
 * hides the entire header row regardless of `title` / `subtitle`; the card row is
 * unaffected either way.
 */
export function Carousel(props: CarouselProps): ReactElement | null {
  const {
    theme: resolvedTheme,
    videos,
    title = DEFAULT_CAROUSEL_TITLE,
    subtitle,
    goodsFor,
    live = false,
    onTapVideo,
    onSeeMore,
    scrollable = false,
    productCard,
    widgetColor = 1,
    widgetBgcolor = null,
    loading = false,
    showsHeader = true,
  } = props;

  // EMBED COLORS (rb-rn-widget-embed-colors): overlay the two `/sdk/widget` values onto
  // the caller-supplied theme. ONE derivation site, deliberately above the shared
  // `cardEls` — so the windowed row AND the `scrollable` ScrollView branch below, plus
  // every `CarouselCardView` they contain, all paint with the derived value. Unconfigured
  // → `derive` hands back `resolvedTheme` itself, so today's pixels are untouched.
  const theme = ReferenceUIWidgetEmbedTheme.derive(resolvedTheme, widgetColor, widgetBgcolor);

  // Preview scroll signal (see the file header). Hook is unconditional (rules of hooks); only the
  // `scrollable` branch below provides / emits it — the windowed plain Row never touches it.
  const previewScroll = usePreviewScrollSignalEmitter();

  // Confirmed-empty (not loading, zero videos) → render NOTHING at all, including the
  // header (rb-rn-widget-loading-placeholder, design D9). MUST come after every
  // unconditional hook above (rules of hooks) but before anything else is computed.
  if (!loading && videos.length === 0) return null;

  // Has content to draw: `title` is non-empty OR a `subtitle` exists (mirrors
  // `LBPCarousel`'s `(title || subtitle) && (...)`, widgets.jsx 208). Distinct from the
  // `showsHeader` PROP above (host opt-out, rb-rn-widget-carousel-header-visibility) —
  // this is purely "is there content", not "does the host want it shown". Renamed from
  // the former same-named internal const to free `showsHeader` for the new host-facing
  // prop.
  const hasSubtitle = subtitle != null && subtitle.length > 0;
  const hasHeaderContent = title.length > 0 || hasSubtitle;

  // Windowed (default): the first N cards in a FIXED non-scroll Row (golden-safe). Turnkey
  // (`scrollable`): ALL videos in a horizontal ScrollView (parity iOS ScrollableCarouselView).
  const visible = videos.length <= MAX_CARDS ? videos : videos.slice(0, MAX_CARDS);
  const cards = scrollable ? videos : visible;
  const cardEls = cards.map((item, i) => (
    <View key={item.id} testID={carouselCard(i)} style={i > 0 ? styles.cardGap : undefined}>
      <CarouselCardView
        theme={theme}
        video={item}
        goods={goodsFor != null ? goodsFor(item) : widgetGoodsFromFeatured(item.goods)}
        width={DEFAULT_CARD_WIDTH}
        live={live}
        // Raw hand-off — the card owns the single fallback (`normalizeProductCardMode`).
        // Built ONCE here, so the windowed (plain Row) and the turnkey (`scrollable`
        // ScrollView) branches below both render these same elements: one forwarding site
        // covers both.
        productCard={productCard}
        onTap={onTapVideo != null ? () => onTapVideo(item) : undefined}
      />
    </View>
  ));

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {showsHeader && hasHeaderContent ? (
        // Header row: title (+ optional subtitle) stack leading, 查看更多 › link trailing.
        <View style={styles.header}>
          <View style={styles.headerTextCol}>
            <Text
              style={[
                styles.title,
                { color: theme.text, fontSize: 16 * theme.fontScale },
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {hasSubtitle ? (
              <Text
                style={[
                  styles.subtitle,
                  // `theme` carries no dim token — derive a dim variant of the primary
                  // text color via opacity (matches the design's `textDim`).
                  { color: theme.text, fontSize: 11 * theme.fontScale },
                ]}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
          {/* 「查看更多 ›」accent link — trailing, host-wired (onSeeMore). Rendered ONLY when
              host-wired (`onSeeMore != null`) — an un-wired link is a dead button
              (dropin-hide-unwired-affordances-rn). */}
          {onSeeMore != null ? (
            <Pressable testID={LBTestIDs.widgetSeeMore} onPress={() => onSeeMore()} style={styles.seeMore}>
              <Text
                style={[styles.seeMoreLabel, { color: theme.accent, fontSize: 12 * theme.fontScale }]}
                numberOfLines={1}
              >
                {SEE_MORE_LABEL}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Windowed (default): a PLAIN non-scroll Row of the first N cards (golden-safe). Turnkey
          (`scrollable`): a horizontal ScrollView over ALL cards (parity iOS ScrollableCarouselView).
          gap 12, leading padding 16 (mirrors the design's `padding: '0 16 6'`).
          `loading` (rb-rn-widget-loading-placeholder) takes precedence over both — the
          real card row (windowed or scrollable) is never drawn while loading. */}
      {loading ? (
        <CarouselLoadingRow theme={theme} cardWidth={DEFAULT_CARD_WIDTH} productCard={productCard} />
      ) : cards.length > 0 ? (
        scrollable ? (
          // The scrollable branch owns this ScrollView, so it also owns the preview scroll signal:
          // throttled on `onScroll`, always on drag / momentum end (see the file header).
          <LivebuyPreviewScrollSignalContext.Provider value={previewScroll.source}>
            <ScrollView
              testID={LBTestIDs.widgetCarousel}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.row}
              scrollEventThrottle={16}
              onScroll={() => previewScroll.emitThrottled()}
              onScrollEndDrag={() => previewScroll.emitNow()}
              onMomentumScrollEnd={() => previewScroll.emitNow()}
            >
              {cardEls}
            </ScrollView>
          </LivebuyPreviewScrollSignalContext.Provider>
        ) : (
          <View testID={LBTestIDs.widgetCarousel} style={styles.row}>{cardEls}</View>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'flex-start',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 4,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  headerTextCol: {
    flex: 1,
  },
  title: {
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    marginTop: 2,
    fontWeight: '400',
    opacity: 0.55,
  },
  seeMore: {
    marginLeft: 8,
    paddingTop: 1,
  },
  seeMoreLabel: {
    fontWeight: '600',
  },
  // PLAIN Row (NOT a horizontal list / ScrollView). The over-wide strip is laid in a
  // plain row; on a width-bounded host the trailing cards are clipped off-screen (the
  // host owns the real horizontal scroll). NO Lazy* / FlatList.
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 6,
  },
  cardGap: {
    marginLeft: 12,
  },
  // First-load placeholder (rb-rn-widget-loading-placeholder). `loadingRoot` reuses the
  // real row's own leading/trailing padding so the placeholder occupies the same
  // horizontal footprint as `styles.row`.
  loadingRoot: {
    position: 'relative',
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 6,
  },
  // Reserves the real card's measured footprint without drawing it (RN has no CSS
  // `visibility: hidden`) — `opacity: 0` keeps layout, unlike `display: 'none'`.
  loadingHiddenCard: {
    opacity: 0,
  },
  loadingMarkWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
