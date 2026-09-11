// FloatingWidget — family-5 widget surface 3 (LBPFloatingWidget).
//
// Spec: `reference-ui-rendering/spec.md` (family-5 widget surfaces — the standalone
// 懸浮直播預覽視窗). Phase-4 RN sibling of the DONE iOS `FloatingWidgetView.swift`
// (rb-ios-widget), Android `FloatingWidgetView.kt` (rb-android-widget), and the
// authoritative Flutter blueprint `floating_widget.dart` (rb-flutter-widget),
// translated here 1:1. Design: `design/templates/minimal/sdk-components.jsx`
// `LBPFloatingWidget` (lines 590-710) — the CURRENT canonical component. The same-named
// carousel-card variant that used to live in `design/templates/minimal/widgets.jsx`
// (taking `{video, onTap, width, height}`) was REMOVED on 2026-06-09; see
// `design/contract/claude-design-sync.md` §2 R5 and the guard note at
// `widgets.jsx:426-436`. Never cite `widgets.jsx` as this component's design source.
//
// The standalone 懸浮直播預覽視窗 (`LBWidgetContentMode.Floating`): a self-contained,
// dismissible floating window that previews a single LIVE stream. Unlike the carousel
// / video-shop surfaces (which embed many videos in a host page), this is instantiated
// standalone by 3rd-party hosts and floats over their own content. It REUSES the
// shared `CarouselCardView` primitive for the 9:16 live thumbnail (so the brand
// language matches the carousel / grid cards) and overlays a close button INSIDE the
// card's top-right corner (floating-only).
//
// SUB-VIEW INPUT PATTERN (parity with families 1-4; matches the call site the
// container `WidgetOverlayView` uses verbatim): theme FIRST → by-value snapshot
// (`liveVideo` + optional `goods`) → trailing optional callbacks (`onTap` / `onClose`,
// each defaulting to a no-op).
//   1. `theme`                       — FIRST, always. Passed straight through to the
//      reused `CarouselCardView`.
//   2. `liveVideo: LBVideoItem | null` — the single floating preview video
//      (`WidgetModel.liveVideo`). When NULL → render NOTHING (`return null`), parity
//      with the iOS `EmptyView` / Flutter `SizedBox.shrink` (the container passes
//      `model.liveVideo`, which may be null before a live stream). NOTE the design
//      source: the literal `if (!video) return null` belonged to the REMOVED
//      carousel-card variant; the current canonical component has no `video` prop (its
//      early return is `if (!shown) return null`, `sdk-components.jsx:655`, which gates
//      the entrance delay). The equivalence is recorded in the R5 guard note at
//      `widgets.jsx:426-436`.
//   3. `goods?: WidgetGoods | null`  — optional product overlay (reference-ui value —
//      the RN core `LBVideoItem` has NO `goods` field). Forwarded to the reused card;
//      null → no overlay.
//   4. action callbacks (LAST, each optional → no-op):
//      • `onTap: (item: LBVideoItem) => void` — whole-window tap → `onTap(liveVideo)`
//        (canonical `videoTap`). Host-wired exit → host → core open player for the
//        live `liveVideo.id`. This layer NEVER opens the player itself.
//      • `onClose: () => void`               — top-right close button → `onClose`
//        (canonical `close`, floating-only). Host owns re-mount; this layer just
//        forwards the dismiss intent. The close tap MUST NOT also fire `onTap`.
//
// LIVE TREATMENT: the design treats the floating preview as a LIVE card visually. The
// current canonical component has NO `video` prop at all — it drives the LIVE look from
// an explicit `isLive` flag (`sdk-components.jsx:682-692`: the cover tone plus the
// top-left LIVE tag). (The removed carousel-card variant did it by forcing
// `kind: video.kind || 'live'`; that line no longer exists anywhere.) The core `LBVideoItem`
// is a read-only value carrying only `liveStatus: number`, and the reused
// `WidgetModel.isLive` / `CarouselCardView` key on `liveStatus === 1`. We pass
// `liveVideo` STRAIGHT THROUGH to the card (we never build a live-forced copy —
// `LBVideoItem` is immutable and we must not mutate the host's model). The card
// therefore reads LIVE iff `liveVideo.liveStatus === 1`; in practice the container only
// routes a genuine live stream (`WidgetModel.liveVideo`) into this surface, so it reads
// LIVE. A non-live `liveVideo` would render as a plain VOD card (no kind badge at all,
// rb-rn-carousel-card-pin-viewers-duration-removal — design R33 retired the「▶ mm:ss」
// duration pill) instead — an accepted approximation (documented in `CarouselCardView`'s
// kind mapping). NO separate upcoming / replay handling.
//
// CLOSE-TAP ISOLATION (design `sdk-components.jsx:695-696` — the close `<button>` calls
// `e.stopPropagation()` on both `onPointerDown` and `onClick`): the close button is a
// SEPARATE front-most `Pressable` overlaid ON TOP of the reused card. RN hit-testing
// routes the press to the front-most pressable, so a tap on the close button fires ONLY
// `onClose` and never the card's `onTap`. The card tap is wired through
// `CarouselCardView`'s own `onTap` (its whole-card `Pressable`), so the two exits stay
// cleanly separated without a custom gesture.
//
// TITLE SUPPRESSION (rb-rn-floating-widget-hide-title): the reused `CarouselCardView` is
// constructed with `showTitle={false}` (deliberately, matching the existing `NO
// productCard` comment at the call site below). The design source's `LBPFloatingWidget`
// (`sdk-components.jsx` 590-712) has NO title element at all — the title on the reused
// card is purely an artifact of reusing `CarouselCardView` as this surface's body (an
// existing A-2 "整體替換" decision, see the REUSES paragraph above), never something the
// design asked this surface to draw. Suppressing it here is a design-alignment fix, not a
// new deviation. `CarouselView` / `VideoShopGridView` (the other two `CarouselCardView`
// consumers) are unaffected — they never pass `showTitle`, so they keep the title exactly
// as before.
//
// VIEWER COUNT VISIBILITY (rb-rn-live-entry-hide-viewer-count): UNLIKE `showTitle` above (which
// this surface hardcodes to `false` for every caller), `showViewerCount` is threaded through as
// its OWN optional prop on `FloatingWidgetProps` and forwarded BY VALUE (not hardcoded) to the
// reused `CarouselCardView`'s same-named prop. This surface has THREE callers —
// `LivebuyLiveEntry.tsx` (the turnkey「現正直播」entry container), `WidgetOverlayView.tsx`'s
// `LBWidgetContentMode.Floating` branch, and `ReferenceUIDesign.tsx`'s minimized/collapsible
// preview card — and only `LivebuyLiveEntry` wants the viewer-count badge hidden; the other two
// must keep showing it unchanged. Hardcoding `false` here (the `showTitle` shape) would have
// silently removed the badge from all three, which is wrong. Omitted / `true` (the two
// unaffected callers) forwards `true` (or omits, defaulting the same way) to `CarouselCardView`,
// so its own existing three-factor gate (`isLive && showPvNum > 0 && watchNum > 0`) is the sole
// decider — unchanged behavior. `false` (only `LivebuyLiveEntry`'s call) forwards `false`, which
// `CarouselCardView` ANDs onto that gate, suppressing the badge regardless of the other three
// factors.
//
// One-way data flow: this surface reads ONLY its passed-in `liveVideo` + `goods` +
// `theme`; it never reaches back into `WidgetModel` / `DefaultWidgetTemplate`, holds NO
// second copy of state, calls NO core `simulate*` / `requestLoadMore`, and NEVER opens
// the player / closes itself. It renders correctly with `onTap` / `onClose` omitted (so
// demo / golden / structural-snapshot tests construct it action-free).
//
// EMBED COLORS — DELIBERATELY EXCLUDED (rb-rn-widget-embed-colors): unlike `Carousel` /
// `VideoShopGrid`, this surface does NOT take `widgetColor` / `widgetBgcolor` and MUST
// NOT interpret them; it keeps the UNDERIVED `ReferenceUITheme`, matching its existing
// `product_card` exclusion. Note the leak this guards against is NOT primarily "someone
// adds the props here" — it is deriving one level up, in `WidgetOverlayView` or on
// `WidgetSurfaceContext.theme`, both of which feed this surface the same shared theme
// object. The tests assert this surface receives that object BY REFERENCE.
//
// RENDER DISCIPLINE: plain View/Text/Pressable
// only (NO ScrollView / FlatList / SectionList / VirtualizedList), NO network-uri Image
// (the reused card draws a deterministic placeholder), NO animation / randomness.

import type { ReactElement } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ReferenceUITheme } from '../theme';
import { LBTestIDs } from '../testing/LBTestIDs';
import { CarouselCardView, DEFAULT_CARD_WIDTH } from './CarouselCardView';
import { CloseGlyph } from './CloseGlyph';
import type { WidgetGoods } from './WidgetModel';

import type { LBVideoItem } from 'livebuy-react-native';

/** Props for the family-5 standalone floating live-preview window. */
export interface FloatingWidgetProps {
  /**
   * The resolved reference-ui theme (FIRST — SUB-VIEW INPUT PATTERN). Passed straight
   * through to the reused {@link CarouselCardView}.
   */
  readonly theme: ReferenceUITheme;
  /**
   * The single floating preview video (`WidgetModel.liveVideo`). `null` → render
   * NOTHING (`return null`), parity with iOS `EmptyView` / Flutter `SizedBox.shrink`
   * (design source: the R5 guard note at `widgets.jsx:426-436` — the canonical
   * component itself carries no `video` prop). Read-only.
   */
  readonly liveVideo: LBVideoItem | null;
  /**
   * Optional product overlay (reference-ui {@link WidgetGoods} — the RN core
   * `LBVideoItem` has no `goods` field). Forwarded to the reused card; null/omitted →
   * no overlay.
   */
  readonly goods?: WidgetGoods | null;
  /**
   * Live-flag gate forwarded to the reused {@link CarouselCardView}. `false` (default —
   * snapshot / demo) → placeholder cover only; `true` (host runtime) → the real
   * `liveVideo.cover` photo loads over the placeholder.
   */
  readonly live?: boolean;
  /**
   * Whether the reused card's VIEWER BADGE (watch-count pill) is allowed to render, forwarded
   * BY VALUE to {@link CarouselCardView}'s same-named prop (rb-rn-live-entry-hide-viewer-count).
   * **Defaults to `true`** — omitted (the `WidgetOverlayView` FLOATING content mode and
   * `ReferenceUIDesign` minimized-preview callers) leaves `CarouselCardView`'s own existing gate
   * (`isLive && showPvNum > 0 && watchNum > 0`) as the sole decider, unchanged from before this
   * prop existed. `false` (the `LivebuyLiveEntry` entry-container caller only) suppresses the
   * badge even when that gate would otherwise pass. UNLIKE `showTitle` below, this value is
   * forwarded per-caller, not hardcoded — see VIEWER COUNT VISIBILITY in the file header.
   */
  readonly showViewerCount?: boolean;
  /**
   * Whole-window tap → host-wired `onTap(liveVideo)` → host → core open player for the
   * live `liveVideo.id` (canonical `videoTap`). Omitted for demo / golden instances —
   * the window is inert. This layer NEVER opens the player itself.
   */
  readonly onTap?: (item: LBVideoItem) => void;
  /**
   * Close button (inside the card's top-right corner) → host-wired `onClose` (canonical
   * `close`, floating-only).
   * Host owns re-mount. Omitted for demo / golden instances. The close tap MUST NOT
   * also fire `onTap` (separate front-most `Pressable` — RN hit-testing isolates it).
   */
  readonly onClose?: () => void;
}

/**
 * The family-5 standalone floating live-preview window (`LBPFloatingWidget`). When
 * `liveVideo == null` it renders NOTHING (`return null`). When non-null it draws ONE
 * reused {@link CarouselCardView} (the live preview) with a round close button overlaid
 * INSIDE the card's top-right corner. Whole-window tap → `onTap(liveVideo)`; close → `onClose` (the
 * close tap never also fires `onTap`). All exits are host-wired; this layer never opens
 * / closes itself.
 */
export function FloatingWidget(props: FloatingWidgetProps): ReactElement | null {
  const { theme, liveVideo, goods = null, live = false, showViewerCount = true, onTap, onClose } = props;

  // liveVideo == null → render NOTHING (see the prop doc for the design source).
  if (liveVideo == null) return null;
  const video = liveVideo;

  // Floating window (reused card + close button). Mirrors `LBPFloatingWidget`
  // (sdk-components.jsx 657-709): a `position: relative` box of the reused
  // `LBPCarouselCard` (whole-window tap → videoTap) plus a round close button pinned
  // INSIDE its top-right corner. The window box is exactly the card box — it carries NO
  // padding, because nothing overflows it (design `sdk-components.jsx:666`: the widget box IS the media
  // box). Parity with the iOS `ZStack(alignment: .topTrailing)`, whose measured size is
  // likewise the card's.
  return (
    <View testID={LBTestIDs.floatingWidget} style={styles.window}>
      {/* Reuse the shared 9:16 card primitive (DO NOT re-draw a card). Its own
          whole-card Pressable carries the videoTap exit → forward the bound `video`.
          NO `productCard` here, deliberately (rb-rn-widget-product-card-modes): the
          floating surface is bound to `content.liveVideo`, whose data comes from
          `/sdk/widget/live` — a payload that does NOT carry `product_card`. This surface
          also takes a bare `LBVideoItem` + by-value `goods`, with no `WidgetModel` to read
          from. Leaving the prop off means the card falls back to `'inside'`, i.e. exactly
          today's pixels. Same decision as iOS `FloatingWidgetView.swift` and Android
          `FloatingWidgetView.kt`.
          NO title here, deliberately (rb-rn-floating-widget-hide-title): the design
          source's `LBPFloatingWidget` (`sdk-components.jsx` 590-712) has no title element
          — `showTitle={false}` aligns this surface with that fact. Same decision as iOS
          `FloatingWidgetView.swift` and Android `FloatingWidgetView.kt`.
          `showViewerCount` forwarded BY VALUE, not hardcoded (rb-rn-live-entry-hide-viewer-count)
          — see VIEWER COUNT VISIBILITY in the file header: only the `LivebuyLiveEntry` caller
          passes `false`; the other two callers omit the prop and keep showing the badge. */}
      <CarouselCardView
        theme={theme}
        video={video}
        goods={goods}
        width={DEFAULT_CARD_WIDTH}
        live={live}
        showTitle={false}
        showViewerCount={showViewerCount}
        onTap={onTap == null ? undefined : () => onTap(video)}
      />

      {/* Round close button (floating-only), pinned INSIDE the card's top-right corner
          at `top/right: 4` (design `sdk-components.jsx:698`). A SEPARATE front-most
          Pressable — a tap here fires ONLY `onClose`, never the card's `onTap` (design
          `:695-696` `e.stopPropagation()`). */}
      <Pressable
        testID={LBTestIDs.floatingClose}
        accessibilityRole="button"
        onPress={() => onClose?.()}
        style={styles.closeButton}
      >
        <CloseGlyph color={WHITE} size={14} />
      </Pressable>
    </View>
  );
}

// GLYPH MECHANISM (rb-rn-icon-parity-widget-close-glyph): the close button draws a
// self-drawn `CloseGlyph` (`react-native-svg`'s `<Svg><Path/></Svg>`, `d="M5 5l14 14M19
// 5L5 19"`, copied verbatim from Android `IconGlyphs.kt`'s `D_CLOSE` ↔ iOS
// `Image(systemName: "xmark")`), NOT a bare `Text` character. `react-native-svg` is NOT
// banned in this layer — it is a declared `peerDependency` (`package.json`) and already
// used by several existing `widget/` glyphs (`PinGlyph.tsx`, `LockGlyph.tsx`,
// `ShareFillGlyph.tsx`, `CartFillGlyph.tsx`, `CcGlyph.tsx`, `DetailGlyph.tsx`) — an
// earlier version of this comment claimed otherwise; that claim was wrong and this
// close button's bare-character rendering was leftover history, not a deliberate
// layer limitation. `size={14}` is unchanged from the prior fixed
// `styles.closeGlyph.fontSize: 14` (design R32's enlarged close button, `Icons.close
// size={14}`); `FloatingCloseButtonLayout.test.tsx` asserts the sibling
// `MinimizedWidgetView` close button stays identical (`color`/`size` props + the
// underlying `Path`'s `d`).

// Decorative design tokens (literal sdk-components.jsx values — FIXED, NOT theme-derived;
// the close button is the same regardless of the host theme, parity with the family-2/3/4
// surfaces' fixed-token approach + iOS/Flutter `closeGlass`).
//
// `blur(6px)` IS NOT IMPLEMENTED — a KNOWN, DELIBERATE gap, not an oversight. The design's
// close button is `background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)'`
// (sdk-components.jsx 699). React Native core has NO backdrop-blur style; the only way to
// get one is an external native module (`@react-native-community/blur` / `expo-blur`), and
// this package's peerDependencies deliberately stay at `livebuy-react-native-ui` / `react` /
// `react-native` / `react-native-video` — a 20pt decorative button does not justify making
// hosts link a native blur module. This is the WHOLE-LAYER convention, not a one-off: all 33
// `backdropFilter` declarations across the five `design/templates/minimal/*.jsx` files
// (sdk-components 13 / moments 11 / live-chrome 4 / screens 3 / widgets 2) are rendered here
// as plain translucent fills; see `MinimizedWidgetView`, `CartToastView`, `MiniCartPeekView`,
// `PlayerHeaderBarView`, `OperationRailView`. NOTE this gap is INVISIBLE to
// `react-test-renderer` structural snapshots, so this comment (and the spec carve-out) is the
// only mechanism that will tell the next reader.
const CLOSE_GLASS = 'rgba(0,0,0,0.55)'; // LBPFloatingWidget close-button fill (sdk-components.jsx:699).
const WHITE = '#FFFFFF';

const styles = StyleSheet.create({
  window: {
    // The window box IS the card box — no padding. (It used to carry `paddingTop/Right: 8`
    // solely so a close button nudged OUTSIDE the card would not be clipped; the button now
    // sits inside, so the padding has no reason to exist and the card sits flush at the
    // window origin, matching the design's own box — `sdk-components.jsx:666` — and the iOS
    // ZStack, whose measured size has always been the card's.)
    //
    // NOTE the design's `boxShadow: '0 8px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.08)'`
    // (sdk-components.jsx:668) is NOT drawn here — a pre-existing gap, out of scope for the close-button
    // alignment. Both segments are DEBT for this surface (spec class B): the drop-shadow and the hairline
    // are the visual language of "this is a standalone window floating over the host's content", which the
    // 招攬 state and the PIP state BOTH ought to have.
    //
    // The two segments have DIFFERENT carriers in the sibling `MinimizedWidgetView`, so do not cite one for
    // both: the drop-shadow lives on `styles.pill` (`shadowColor`/`shadowOpacity: 0.35`/`shadowRadius: 12`/
    // `shadowOffset`), while the hairline is a SEPARATE absolutely-positioned `styles.hairline` overlay
    // `<View>` (`borderWidth: 1` + `borderColor: 'rgba(255,255,255,0.08)'`). That sibling proves RN CAN do
    // both — which only rules out "platform limit" as the explanation. It does NOT discharge the debt here.
    // `MinimizedWidgetView` is the PIP surface and is NOT on this surface's composition path (container
    // `LivebuyLiveEntry` → `FloatingWidget` → the reused `CarouselCardView`), so it is never evidence that
    // an attribute is SATISFIED here. Nothing on that path draws either segment (grep for
    // shadow/elevation/borderWidth over `container/LivebuyLiveEntry.tsx` and `widget/CarouselCardView.tsx`
    // both exit 1) — that is what makes it debt. "The platform can do it" and "this surface owes it" are
    // ORTHOGONAL facts and are both true today.
    position: 'relative',
    alignSelf: 'flex-start',
  },
  closeButton: {
    // Inside the card's top-right corner (design `top: 4, right: 4`, sdk-components.jsx ≈709-717).
    // 28×28 round (rb-rn-live-replay-more-menu-and-video-info-live-copy, design R32 — enlarged
    // from the prior 20×20; `top`/`right` inset UNCHANGED at 4), no border (design `border:
    // 'none'`), no shadow of its own (the design has no `box-shadow` on this button, and this
    // style has never had one — keep it that way).
    position: 'absolute',
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: CLOSE_GLASS,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
