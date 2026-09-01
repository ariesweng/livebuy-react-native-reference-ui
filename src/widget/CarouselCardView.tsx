// CarouselCardView — family-5 shared 9:16 widget card primitive (LBPCarouselCard).
//
// Spec: `reference-ui-rendering/spec.md` (family-5 widget surfaces — "渲染共用
// CarouselCardView 卡片 primitive，綁 LBVideoItem"). Phase-4 RN sibling of the DONE
// iOS `CarouselCardView.swift` (rb-ios-widget) + Android `CarouselCardView.kt`
// (rb-android-widget) + Flutter `carousel_card.dart` (rb-flutter-widget — the
// authoritative blueprint translated here 1:1). Design:
// `design/templates/minimal/widgets.jsx` `LBPCarouselCard`.
//
// The single 9:16 thumbnail card shared by ALL four family-5 widget surfaces
// (carousel row, video-shop grid, floating live card, and — at a smaller scale —
// the minimized pill). It reproduces `LBPCarouselCard`'s structure:
//
//   • a 9:16 thumbnail placeholder (deterministic fill + monogram — NO network-uri
//     Image; the design's <ProductMock> becomes a solid fill + title monogram),
//   • a KIND BADGE top-left:
//       - LIVE → a red「LIVE」tag (static pulse dot) when the item is live
//                (`WidgetModel.isLive` — `liveStatus === 1`),
//       - VOD  → a「▶ mm:ss」duration pill (from `LBVideoItem.duration` SECONDS)
//                otherwise,
//   • a PRODUCT CARD whose placement depends on `product_card` (see below), drawn from a
//     reference-ui {@link WidgetGoods} value (the RN core `LBVideoItem` has NO `goods`
//     field; supplied BY VALUE): thumb chip + `goods.name` +「NT$ price」(+ an optional
//     struck-through `goods.originalPrice` in `below` mode),
//   • the `LBVideoItem.title` BELOW the thumbnail — gated by `showTitle`
//     (rb-rn-floating-widget-hide-title, see TITLE VISIBILITY FLAG below); every
//     pre-existing consumer (carousel / grid) omits the prop and keeps the title,
//     unchanged.
//
// (That is an ELEMENT LIST, not a top-to-bottom order — where the product card sits
// relative to the title is decided by `product_card`; see PRODUCT-CARD PLACEMENT.)
//
// PRODUCT-CARD MODES (rb-rn-widget-product-card-modes, design R14 —
// `design/templates/minimal/widgets.jsx` `normalizeProductCardMode` / `LBPCardProductRow`
// / `LBPCardProductOverlay`). `POST /sdk/widget` carries a root `product_card` String
// (`inside` / `below` / `hidden`, backend default `inside`), raw-passed through the RN
// bridge (`LBWidgetSettings.productCard`) → `LBWidgetContent.productCard` →
// `WidgetModel.productCard` → this card's `productCard?: string | null` prop:
//
//     inside (default)  the dark-glass overlay INSIDE the 9:16 thumbnail (the historical,
//                       unconditional rendering — pixels unchanged). `goods == null` → the
//                       whole block is not drawn.
//     below             the product card moves OUTSIDE the thumbnail, landing UNDER THE
//                       TITLE, at the very BOTTOM of the card (design ledger R17, see
//                       PRODUCT-CARD PLACEMENT below). Off the dark video backdrop it
//                       switches to the design's surface vocabulary (bgElev fill + stroke
//                       border + `theme.text` name + sale price + textFaint struck-through
//                       original price). `goods == null` → an EQUAL-HEIGHT TRANSPARENT
//                       PLACEHOLDER so cards in the same row / grid cell stay the same height.
//     hidden            no product card at all (neither overlay nor row, and NO placeholder
//                       — every card in the surface is equally card-less).
//
// The LIVE tag / duration pill / upcoming veil / title are IDENTICAL in all three modes.
// Equal height comes from the FIXED constant `BELOW_ROW_HEIGHT` (design
// `LB_BELOW_ROW_H = 44`), NOT from the content.
//
// PRODUCT-CARD PLACEMENT (rb-rn-widget-product-card-below-slot-reposition, design ledger
// R17 — `design/contract/claude-design-sync.md`). The card's children are declared in the
// order 縮圖 → 標題 → (`below` only) 商品列, i.e. the `below` product row / its
// equal-height placeholder sits UNDER THE TITLE, at the very bottom of the card, matching
// `LBPCarouselCard`. This REVERSED the 2026-08-05 arrangement (R14 decision 1), which had
// the row between the thumbnail and the title and forbade it under the title; the upstream
// design overturned its own decision on 2026-08-11 and this layer followed. The card is a
// plain column (`styles.card` sets NO `flexDirection`, so RN's default `'column'` applies
// and declaration order IS top-to-bottom order) — do not reintroduce `column-reverse` or
// absolute positioning here, or the fixed 44pt would stop contributing to card height and
// the equal-height rule / carousel window height would drift.
//
// FALLBACK IS THIS LAYER'S JOB: core deliberately does NOT substitute the backend default
// (`null` means "the backend sent nothing", which is a different fact from `"inside"`), and
// neither does the view-model layer. `normalizeProductCardMode(...)` is the SINGLE pure
// entry point that maps anything that is not exactly `'below'` / `'hidden'` (including
// `null`, `undefined`, `''`, whitespace-padded and differently-cased spellings, and any
// unknown string) to `'inside'`. It MUST NOT be duplicated in the component body, and the
// normalized value MUST NOT be written back into `WidgetModel` / `LBWidgetContent` / core.
//
// THREE-WAY KIND DERIVATION (LIVE → UPCOMING → VOD): the core `LBVideoItem` carries
// `liveStatus: number` + `type: number` + `publishAt: string` (UTC+8), enough to render
// LIVE / UPCOMING / VOD (RN parity of iOS / Android / Flutter `CarouselCardView`):
//   `liveStatus === 1`                       → LIVE (red LIVE tag, NO duration pill).
//   `liveStatus === 0` && `type === 2`       → UPCOMING (直播預告): rgba(0,0,0,0.25)
//      && publishAt parses                     mask + centred date + big time (the
//                                             design's upcoming treatment, replacing
//                                             the duration pill).
//   otherwise (regular VOD `type === 1`,     → VOD  (duration pill from `duration`).
//      empty/unparseable publishAt, replay)
// `type === 2` is the backend's canonical scheduled-live signal (rb-rn-widget-upcoming-
// type，問題 6); it replaces the prior `publishAtInFuture` time-heuristic, which depended
// on the wall clock and conflated regular VOD (`type === 1`) with scheduled live whose
// start time had already passed but is still `liveStatus === 0`. A `liveStatus === 0`,
// `type === 2` card whose scheduled time is in the PAST now CORRECTLY stays UPCOMING; a
// regular VOD (`type === 1`) is never UPCOMING regardless of `publishAt`. The `publishAt`
// parse-guard (`scheduledDate(...).length > 0`) keeps an empty / malformed date on VOD.
//
// ★ The goods overlay / below row is a READ-ONLY TAG ONLY — it MUST NOT render the
//   family-3 product sheet stack (no detail / variant / qty / cart here). It is a
//   passive label that the host's own product flow may pick up on a card tap.
//
// TITLE VISIBILITY FLAG (`showTitle`, rb-rn-floating-widget-hide-title, parity iOS
// `CarouselCardView.showTitle` / Android `CarouselCardView.showTitle`). The design source
// `design/templates/minimal/sdk-components.jsx`'s `LBPFloatingWidget` (≈590-712) draws NO
// title at all; the title on today's floating surface is purely an artifact of reusing
// this shared primitive as the floating card's body (an existing, already-classified A-2
// "整體替換" decision — see `FloatingWidgetView.tsx`'s header doc comment). `showTitle`
// (optional, DEFAULTS to `true`) gates the title `Text` element: `true` / omitted (every
// pre-existing consumer — `CarouselView` / `VideoShopGridView` — never passes this prop)
// renders the title exactly as before; `false` (the floating consumer only) suppresses it
// entirely — the `Text` element is NOT built at all (not merely styled invisible), so
// changing `video.title`'s content produces zero observable difference in the render tree
// when suppressed. This is a presentation axis fully independent of `productCard`.
//
// SUB-VIEW INPUT PATTERN (parity with families 1-4): theme FIRST → snapshot values by
// value (`video`, optional `goods`, optional `width`, optional `productCard`, optional
// `showTitle`) → interaction callback (`onTap`)
// trailing (defaulting to a no-op). One-way data flow: this primitive reads ONLY its
// passed-in values; it never reaches back into `WidgetModel` / `DefaultWidgetTemplate`,
// holds NO second copy of state, calls NO core `simulate*`, uses NO ScrollView /
// FlatList / SectionList / VirtualizedList, uses NO network-uri Image. The tap exit
// is host-wired (`onTap`); the card NEVER opens the player itself.

import type { ReactElement } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../TightText';

import type { ReferenceUITheme } from '../theme';
import { LBTestIDs } from '../testing/LBTestIDs';
import type { WidgetGoods } from './WidgetModel';
import { WidgetModel } from './WidgetModel';
import { scheduledDate, scheduledTime } from '../playershell/UpcomingCountdownView';
// rb-rn-widget-upcoming-type（問題 6）：upcoming 改用後端 `type === 2`，移除 publishAtInFuture 時間 heuristic。
import { RemoteImage } from '../productsheets/RemoteImage';
import { LoopingVideoView } from './LoopingVideoView';

import type { LBVideoItem } from 'livebuy-react-native';

/** The design's default card width (logical px). The minimized surface scales down. */
export const DEFAULT_CARD_WIDTH = 132;

// MARK: - LBProductCardMode — the single fallback entry point (normalizeProductCardMode)

/**
 * Where (and whether) the widget card draws its product card. The RN counterpart of the
 * design's `LB_PRODUCT_CARD_MODES` + `normalizeProductCardMode`
 * (`design/templates/minimal/widgets.jsx`), of iOS `LBProductCardMode` and of Android
 * `LBProductCardMode`.
 *
 * TypeScript's analogue of the Swift / Kotlin enum is a STRING UNION: the member values
 * ARE the wire values, so there is no `rawValue` / `wireValue` mapping layer. The wire
 * value (`product_card`) is a raw passthrough `string | null` all the way from core; this
 * type is where it becomes a closed set.
 */
export type LBProductCardMode = 'inside' | 'below' | 'hidden';

/**
 * THE ONLY place a raw `product_card` value becomes a mode. Mirrors the design's
 * `normalizeProductCardMode(raw)` (`raw === 'below' || raw === 'hidden' ? raw : 'inside'`)
 * EXACTLY — the comparison is STRICT, with NO trimming and NO case folding, so `' below '`
 * / `'BELOW'` fall back to `'inside'` just like any other unknown string. Being
 * deliberately as strict as the design keeps the four platforms' fallback boundary
 * identical precisely when the backend emits something malformed, which is when a
 * divergence would be hardest to spot.
 *
 * Accepts `undefined` as well as `null` because the RN call sites are OPTIONAL props (an
 * omitted prop is `undefined`) while the view-model delivers `string | null`; both mean
 * "the backend sent nothing" and both fall back to `'inside'`.
 *
 * The normalized value MUST NOT be written back into `WidgetModel` / `LBWidgetContent` /
 * core — the `null` there means "the backend sent nothing", a DIFFERENT fact from the
 * backend sending `'inside'`.
 */
export function normalizeProductCardMode(raw: string | null | undefined): LBProductCardMode {
  return raw === 'below' || raw === 'hidden' ? raw : 'inside';
}

/**
 * Whether the mode draws the dark-glass overlay INSIDE the 9:16 thumbnail.
 *
 * A `Record<LBProductCardMode, boolean>` rather than a chain of `===` in the view body:
 * the mapped type demands a key for EVERY union member, so growing the domain turns into
 * a COMPILE ERROR here (the TS equivalent of iOS's `default`-less `switch` / Kotlin's
 * `else`-less `when` expression). A lookup with an out-of-domain key (only reachable if a
 * caller casts) yields `undefined` → falsy → nothing is drawn; it never throws, so an
 * unexpected value can never blank the screen or crash.
 */
const DRAWS_INSIDE_OVERLAY: Record<LBProductCardMode, boolean> = {
  inside: true,
  below: false,
  hidden: false,
};

/** Whether the mode draws the surface-styled product row OUTSIDE the thumbnail — under the title, at the bottom of the card (see PRODUCT-CARD PLACEMENT in the file header). Same shape / same reasoning as {@link DRAWS_INSIDE_OVERLAY}. */
const DRAWS_BELOW_ROW: Record<LBProductCardMode, boolean> = {
  inside: false,
  below: true,
  hidden: false,
};

/**
 * Format `number` seconds → `mm:ss` (for `LBVideoItem.duration`, which IS seconds).
 * Clamps negative / nullish / non-finite to `"00:00"`; floors fractional seconds.
 * Parity with the family-4 `formatSeconds` (e.g. `28` → `"00:28"`).
 */
export function formatSeconds(seconds: number | null | undefined): string {
  const n = typeof seconds === 'number' && Number.isFinite(seconds) ? Math.floor(seconds) : 0;
  const s = n < 0 ? 0 : n;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * De-duplicate the currency prefix on a raw wire price (parity iOS `displayPrice`): trim; empty →
 * `""`; prefix「NT$ 」ONLY when the first char is a digit (a bare number) — otherwise the value
 * already carries a currency symbol (e.g. `NT$590`) → render verbatim (never `NT$ NT$590`).
 */
function displayPrice(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return '';
  return /[0-9]/.test(trimmed[0]) ? PRICE_PREFIX + trimmed : trimmed;
}

/**
 * The `below` row's struck-through original price, or `null` when there is nothing to
 * draw. Runs the raw value through the SAME {@link displayPrice} currency de-duplication
 * and maps "empty after trim" (including a missing / null `originalPrice` — the field is
 * OPTIONAL on the reference-ui `WidgetGoods`) to `null`, so the caller omits the element
 * entirely instead of rendering an empty `Text` placeholder. Only `below` has an original
 * price; the `inside` overlay never draws one (the design's `LBPCardProductOverlay` has no
 * `was`). Parity with Android `strikePrice(raw)`.
 */
export function strikePrice(raw: string | null | undefined): string | null {
  const shown = displayPrice(raw ?? '');
  return shown.length === 0 ? null : shown;
}

/** First non-whitespace character of a title, uppercased, for the placeholder monogram. */
function monogram(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length === 0) return '▶';
  return trimmed.slice(0, 1).toUpperCase();
}

/** Props for the shared family-5 widget card primitive. */
export interface CarouselCardViewProps {
  /** The resolved reference-ui theme (FIRST — SUB-VIEW INPUT PATTERN). */
  readonly theme: ReferenceUITheme;
  /**
   * The video this card renders (read-only — `title` / `duration` / `liveStatus` /
   * `cover`). The deterministic placeholder (fill + monogram) always renders; at
   * RUNTIME (`live === true`, see {@link CarouselCardViewProps.live}) the real
   * `video.cover` loads OVER it via {@link RemoteImage}. This layer never mutates /
   * re-fetches.
   */
  readonly video: LBVideoItem;
  /**
   * Live-flag gate (parity iOS `live`). `false` (snapshot / demo — the DEFAULT) → the
   * card draws ONLY the deterministic cover placeholder (NO network-uri `<Image>` in
   * the tree — structural snapshots unchanged). `true` (host runtime, real widget
   * surface) + a non-empty `video.cover` → the real cover photo loads OVER the
   * placeholder via {@link RemoteImage}; on a load error it self-hides back to the
   * placeholder. Threaded down from `WidgetOverlayView` ← `WidgetSurfaceContext.live`
   * ← `LivebuyWidgetConfig.live`.
   */
  readonly live?: boolean;
  /**
   * Optional product card data (reference-ui {@link WidgetGoods} — the RN core
   * `LBVideoItem` has no `goods` field). When non-null the product card is drawn WHERE
   * {@link CarouselCardViewProps.productCard} says; null/omitted → no product card (a
   * live `LBVideoItem` carries none), except that `below` still reserves an equal-height
   * transparent placeholder. READ-ONLY TAG ONLY — NEVER the family-3 product sheet stack.
   */
  readonly goods?: WidgetGoods | null;
  /**
   * RAW `product_card` wire value (`WidgetModel.productCard`), carried verbatim — this
   * card does NOT expect a pre-normalized value, so every call site is a plain hand-off
   * and the fallback stays in ONE place ({@link normalizeProductCardMode}).
   *
   * Omitted (`undefined`, the DEFAULT — and what every pre-existing call site passes) or
   * `null` (the backend sent nothing) → `'inside'`, i.e. the historical unconditional
   * dark-glass overlay, pixel-for-pixel unchanged. `'below'` moves the product card
   * outside the thumbnail, under the title at the bottom of the card (see PRODUCT-CARD
   * PLACEMENT in the file header); `'hidden'` draws none at all. Anything else falls back
   * to `'inside'`.
   *
   * The normalized value is NEVER written back into `WidgetModel` / `LBWidgetContent` /
   * core.
   */
  readonly productCard?: string | null;
  /**
   * Whether to render the title `Text` below the thumbnail (see TITLE VISIBILITY FLAG in
   * the file header). **Defaults to `true`** — omitted (every pre-existing consumer,
   * `CarouselView` / `VideoShopGridView`) renders the title exactly as before this prop
   * existed. `false` (the floating consumer only) suppresses the title element entirely
   * — NOT a blank placeholder; the `Text` node is not built, so the card's render tree
   * has one fewer node and changing `video.title`'s content produces zero observable
   * difference. Independent of {@link CarouselCardViewProps.productCard}.
   */
  readonly showTitle?: boolean;
  /**
   * Card width (logical px). Defaults to the design's {@link DEFAULT_CARD_WIDTH}
   * (132). The thumbnail height is derived 9:16. The minimized surface passes a
   * smaller width (e.g. 96).
   */
  readonly width?: number;
  /**
   * Card tap → host-wired exit (→ host → core open player for `video.id`). Omitted for
   * demo / golden instances — the card is inert. NEVER opens the player / calls core
   * `simulate*` itself.
   */
  readonly onTap?: () => void;
}

/**
 * The shared family-5 widget card (`LBPCarouselCard`): a 9:16 thumbnail placeholder +
 * LIVE / VOD kind badge + an optional bottom dark-glass product overlay + the title
 * below. `onTap` is a host-wired exit (the card never opens the player itself); it
 * renders correctly with `onTap` omitted (demo / golden).
 */
export function CarouselCardView(props: CarouselCardViewProps): ReactElement {
  const {
    theme,
    video,
    goods = null,
    width = DEFAULT_CARD_WIDTH,
    live = false,
    showTitle = true,
    onTap,
  } = props;
  // The ONE call of `normalizeProductCardMode` in this card — every branch below reads the
  // resolved `mode` through the two exhaustive lookup tables, never the raw string.
  const mode = normalizeProductCardMode(props.productCard);
  const isLive = WidgetModel.isLive(video);
  // UPCOMING (直播預告): NOT live AND the backend scheduled-live signal `type === 2`
  // AND a parseable `publishAt` (date guard). A scheduled live whose start time has
  // PASSED but is still `liveStatus === 0` stays UPCOMING; a regular VOD (`type === 1`)
  // is never UPCOMING. Decoupled from the wall clock (RN parity of iOS / Android /
  // Flutter `isUpcoming`, rb-rn-widget-upcoming-type，問題 6).
  const isUpcoming =
    !isLive && video.type === 2 && scheduledDate(video.publishAt).length > 0;
  const thumbHeight = (width * 16) / 9;

  return (
    <Pressable onPress={() => onTap?.()} style={[styles.card, { width }]}>
      {/* 9:16 thumbnail (placeholder fill + kind badge + product overlay) */}
      <View style={[styles.thumb, { width, height: thumbHeight, borderRadius: 12 }]}>
        {/* deterministic cover placeholder (solid fill + title monogram) */}
        <View style={styles.cover}>
          <Text
            style={[styles.coverMonogram, { fontSize: 28 * theme.fontScale }]}
            numberOfLines={1}
          >
            {monogram(video.title)}
          </Text>
        </View>

        {/* Media layer (host runtime only), priority preview → cover → placeholder, parity
            iOS `mediaThumbnail` / Android `CarouselCardView`. rb-rn-widget-card-looping-preview:
            `live === true` + a non-empty `video.preview` → a muted, looping `LoopingVideoView`
            (animated preview) fills over the placeholder. Otherwise the existing
            `RemoteImage(live, cover)` path: `live === false` (snapshot / demo — the DEFAULT) →
            RemoteImage renders NOTHING (placeholder shows through; NO video/Image in the tree →
            structural snapshots unchanged); `live === true` + non-empty `video.cover` → the real
            cover photo over the placeholder (self-hides to placeholder on error). Sits BELOW the
            kind badge / upcoming mask / product overlay so those still composite on top. */}
        {live && video.preview !== '' ? (
          <LoopingVideoView uri={video.preview} borderRadius={12} />
        ) : (
          <RemoteImage live={live} uri={video.cover} borderRadius={12} resizeMode="contain" />
        )}

        {/* UPCOMING (直播預告): a full-bleed rgba(0,0,0,0.25) dark mask + a centred date
            (small) + big time, REPLACING the top-left kind badge (the centre overlay IS
            the indicator). Date / time are pure string reformats of publishAt (shared
            with UpcomingCountdownView) → deterministic. Else the LIVE / VOD kind badge. */}
        {isUpcoming ? (
          <View testID={LBTestIDs.cardUpcomingOverlay} style={styles.upcomingMask}>
            {scheduledDate(video.publishAt).length > 0 ? (
              <Text
                style={[styles.upcomingDate, { fontSize: 11 * theme.fontScale }]}
                numberOfLines={1}
              >
                {scheduledDate(video.publishAt)}
              </Text>
            ) : null}
            {scheduledDate(video.publishAt).length > 0 ? <View style={{ height: 8 }} /> : null}
            <Text
              style={[styles.upcomingTime, { fontSize: 26 * theme.fontScale }]}
              numberOfLines={1}
            >
              {scheduledTime(video.publishAt)}
            </Text>
          </View>
        ) : (
          <View testID={LBTestIDs.cardKindBadge} style={styles.badgeSlot}>
            {isLive ? (
              <View testID={LBTestIDs.cardLiveBadge} style={styles.liveTag}>
                <View style={styles.liveDot} />
                <Text style={[styles.liveLabel, { fontSize: 10 * theme.fontScale }]}>
                  {LIVE_LABEL}
                </Text>
              </View>
            ) : (
              <View testID={LBTestIDs.cardDurationPill} style={styles.durationPill}>
                <Text style={[styles.playGlyph, { fontSize: 8 * theme.fontScale }]}>▶</Text>
                <Text style={[styles.durationText, { fontSize: 10 * theme.fontScale }]}>
                  {formatSeconds(video.duration)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* bottom dark-glass product overlay — `inside` mode ONLY (READ-ONLY tag, and only
            when goods != null). `below` / `hidden` draw nothing here. */}
        {DRAWS_INSIDE_OVERLAY[mode] && goods != null ? (
          <View style={styles.goodsOverlay}>
            {/* 24×24 product chip: gradient placeholder + (live) the real goods.pic over it
                (parity iOS productThumb). live===false (snapshot/demo) → RemoteImage renders null. */}
            <View style={styles.goodsThumb}>
              <RemoteImage live={live} uri={goods.pic} borderRadius={5} resizeMode="contain" />
            </View>
            <View style={styles.goodsTextCol}>
              <Text
                style={[styles.goodsName, { fontSize: 10 * theme.fontScale }]}
                numberOfLines={1}
              >
                {goods.name}
              </Text>
              <Text
                style={[styles.goodsPrice, { fontSize: 10 * theme.fontScale }]}
                numberOfLines={1}
              >
                {displayPrice(goods.price)}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* title below the thumbnail (1-line clamp, painted with theme.text) — gated by
          `showTitle` (TITLE VISIBILITY FLAG, rb-rn-floating-widget-hide-title). `false`
          (floating consumer only) means the Text element is not built at all, not merely
          styled invisible. */}
      {showTitle && (
        <Text
          style={[styles.title, { width, color: theme.text, fontSize: 12 * theme.fontScale }]}
          numberOfLines={1}
        >
          {video.title}
        </Text>
      )}

      {/* `below` slot (LBPCardProductRow, widgets.jsx 66-103) — the surface-styled product
          row OUTSIDE the thumbnail, landing UNDER THE TITLE, at the very BOTTOM of the card.
          The design reversed this placement on 2026-08-11 (design ledger R17 — it overturned
          its own 2026-08-05 decision, which had put the row between the thumbnail and the
          title and forbidden it under the title); `LBPCarouselCard` now declares
          縮圖 → 標題 → `LBPCardProductRow`, and this card follows. Off the dark video backdrop the
          dark-glass + white-text vocabulary no longer holds, so this row uses the design's
          surface tokens. When the card has NO goods it still reserves an EQUAL-HEIGHT
          TRANSPARENT placeholder (the design's `aria-hidden` empty div) so cards in the same
          row / grid cell stay the same height. `inside` / `hidden` render nothing here at
          all. */}
      {DRAWS_BELOW_ROW[mode] ? (
        goods != null ? (
          <View
            testID={LBTestIDs.cardBelowProductRow}
            style={[styles.belowRow, { width, height: BELOW_ROW_HEIGHT }]}
          >
            {/* 32×32 product chip: gradient placeholder + (live) the real goods.pic over it. */}
            <View style={styles.belowRowThumb}>
              <RemoteImage live={live} uri={goods.pic} borderRadius={5} resizeMode="contain" />
            </View>
            <View style={styles.belowRowTextCol}>
              <Text
                style={[styles.belowRowName, { color: theme.text, fontSize: 11 * theme.fontScale }]}
                numberOfLines={1}
              >
                {goods.name}
              </Text>
              <View style={styles.belowRowPriceLine}>
                {/* Sale price is NOT shrinkable: at the design's 132pt card width the two
                    prices together can exceed the text column, and RN cannot overflow. Without
                    this both prices would truncate and the card would show no readable figure.
                    The secondary struck-through original price absorbs the squeeze instead
                    (parity iOS `.layoutPriority(1)` / Android `weight(1f, fill = false)`). */}
                <Text
                  style={[styles.belowRowPrice, { fontSize: 11 * theme.fontScale }]}
                  numberOfLines={1}
                >
                  {displayPrice(goods.price)}
                </Text>
                {strikePrice(goods.originalPrice) != null ? (
                  <Text
                    style={[styles.belowRowStrike, { fontSize: 10 * theme.fontScale }]}
                    numberOfLines={1}
                  >
                    {strikePrice(goods.originalPrice)}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        ) : (
          <View
            testID={LBTestIDs.cardBelowProductSpacer}
            style={[styles.belowRowSpacer, { width, height: BELOW_ROW_HEIGHT }]}
          />
        )
      ) : null}
    </Pressable>
  );
}

// Fixed presentation strings.
const LIVE_LABEL = 'LIVE';
const PRICE_PREFIX = 'NT$ ';

// Decorative design tokens (literal widgets.jsx colors — FIXED, NOT theme-derived;
// the dark-glass treatment composites over the dark thumbnail).
const LIVE_RED = '#F03246'; // LBPCarouselCard brand-red LIVE tag surface.
const COVER_FILL = '#26262E'; // dark 9:16 cover placeholder fill.
const PILL_DARK = 'rgba(0,0,0,0.55)'; // VOD duration pill capsule.
const PRODUCT_GLASS = 'rgba(20,20,24,0.78)'; // bottom product overlay surface.
const GLASS_BORDER = 'rgba(255,255,255,0.10)';
const GOODS_THUMB = '#E8A87C'; // product thumb chip placeholder fill.
const WHITE = '#FFFFFF';

// `below` mode surface vocabulary (LBPCardProductRow). Off the dark video backdrop the
// dark-glass tokens above no longer apply, so this row follows the design's SURFACE
// tokens. RN's `ReferenceUITheme` is the same 5-token thin palette as iOS / Android
// (accent / background / text / cornerRadius / fontScale) and carries no
// `surface.*` / `sale` entry, so — exactly like the decorative tokens above — these are
// pinned as design light-mode literals here. The four values are BYTE-IDENTICAL to the
// iOS `CarouselCardView.swift` and Android `CarouselCardView.kt` constants (all three
// read `design/brands/livebuy/tokens.jsx` light mode). The product NAME deliberately uses
// the RESOLVED `theme.text` (= the design's `theme.surface.text`), matching how the card's
// own `title` is painted.
const BELOW_ROW_BG = '#FAFAFA'; // theme.surface.bgElev — the below row's elevated fill.
const BELOW_ROW_BORDER = '#ECECEF'; // theme.surface.stroke — the below row's hairline border.
const SALE_RED = '#F03246'; // theme.sale — the below row's sale price.
const TEXT_FAINT = '#9A9BA5'; // theme.surface.textFaint — the struck-through original price.

/**
 * Fixed height of the `below` product row AND of its no-goods transparent placeholder
 * (design `LB_BELOW_ROW_H = 44`). Equal card height comes from THIS constant, not from how
 * much content the row happens to hold (product-name length / presence of an original
 * price never change it).
 */
const BELOW_ROW_HEIGHT = 44;

const styles = StyleSheet.create({
  card: {
    alignItems: 'flex-start',
  },
  thumb: {
    overflow: 'hidden',
    position: 'relative',
  },
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COVER_FILL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverMonogram: {
    fontWeight: '900',
    color: 'rgba(255,255,255,0.85)',
  },
  badgeSlot: {
    position: 'absolute',
    top: 6,
    left: 6,
  },
  // UPCOMING (直播預告): full-bleed dark mask + centred date + big time (replaces the
  // kind badge). black @ 0.25.
  upcomingMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  upcomingDate: {
    color: WHITE,
    fontWeight: '600',
    textAlign: 'center',
  },
  upcomingTime: {
    color: WHITE,
    fontWeight: '900',
    textAlign: 'center',
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: LIVE_RED,
  },
  liveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: WHITE,
    marginRight: 4,
  },
  liveLabel: {
    fontWeight: '900',
    color: WHITE,
    letterSpacing: 0.6,
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    paddingRight: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: PILL_DARK,
  },
  playGlyph: {
    color: WHITE,
    marginRight: 4,
  },
  durationText: {
    fontWeight: '600',
    color: WHITE,
  },
  goodsOverlay: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS_BORDER,
    backgroundColor: PRODUCT_GLASS,
  },
  goodsThumb: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: GOODS_THUMB,
    marginRight: 6,
  },
  goodsTextCol: {
    flex: 1,
  },
  goodsName: {
    fontWeight: '600',
    color: WHITE,
  },
  goodsPrice: {
    marginTop: 1,
    fontWeight: '900',
    color: WHITE,
  },
  title: {
    marginTop: 8,
    fontWeight: '600',
  },
  // `below` mode (LBPCardProductRow). `marginTop: 8` reproduces the same rhythm the title
  // already uses, so the card reads 縮圖 →(8)→ 標題 →(8)→ 商品列 (parity iOS
  // `VStack(spacing: 8)` / Android `Arrangement.spacedBy(8.dp)`). Width/height are supplied
  // inline (the card's own `width` prop + BELOW_ROW_HEIGHT) — every child of this card takes
  // an explicit width, never `'100%'`.
  belowRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BELOW_ROW_BORDER,
    backgroundColor: BELOW_ROW_BG,
  },
  belowRowThumb: {
    width: 32,
    height: 32,
    borderRadius: 5,
    backgroundColor: GOODS_THUMB,
    marginRight: 7,
  },
  belowRowTextCol: {
    flex: 1,
  },
  belowRowName: {
    fontWeight: '600',
  },
  belowRowPriceLine: {
    marginTop: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  belowRowPrice: {
    fontWeight: '800',
    color: SALE_RED,
  },
  belowRowStrike: {
    marginLeft: 4,
    // Only the SECONDARY price shrinks — the sale price above stays fully readable.
    flexShrink: 1,
    fontWeight: '600',
    color: TEXT_FAINT,
    textDecorationLine: 'line-through',
  },
  // No-goods equal-height placeholder: NO fill, NO border, NO text — it exists purely to
  // keep same-row / same-cell cards the same height.
  belowRowSpacer: {
    marginTop: 8,
  },
});
