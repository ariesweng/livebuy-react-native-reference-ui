// WidgetOverlayView — family-5 embedded-widget container (RN SKELETON).
//
// Spec: `reference-ui-rendering/spec.md` (family-5 widget — 1 shared card primitive
// + 4 embedded widget surfaces). Phase-4 RN sibling of the DONE iOS
// `WidgetOverlayView.swift` (rb-ios-widget), Android `WidgetOverlayView.kt`
// (rb-android-widget), and Flutter `widget_overlay_view.dart` (rb-flutter-widget —
// the authoritative blueprint translated here 1:1).
//
// The top-level family-5 container. It binds the WIDGET template's host-bindable
// content (`DefaultWidgetTemplate.content`, a `DefaultWidgetContent`) via the
// template's coalesced `subscribe()`, re-reads the immutable snapshot
// (`content.current` → `LBWidgetContent`) on every notify via {@link WidgetModel},
// and DISPATCHES the matching surface by `content.mode`:
//
//   • carousel  → Carousel        (header row + a PLAIN Row of cards)
//   • grid      → VideoShopGrid   (2-col PLAIN Column-of-Rows grid + load-more footer)
//   • floating  → FloatingWidget  (single live card + close; null liveVideo → nothing)
//   • minimized → MinimizedWidget (96-wide pill + LIVE tag + close)
//
// ── widget host-bindable entry (DIFFERENT from player — binds the WIDGET template) ─
//   The host obtains the bound `DefaultWidgetTemplate` via `widgetTemplate(widgetKey)`
//   (react-native-ui/src/TemplateAttachment.ts; `undefined` when not installed / not
//   attached) and passes it here. `template == null`/omitted → the container uses the
//   deterministic {@link WidgetSeeds} (nothing to subscribe to), so the demo / golden /
//   structural-snapshot path renders without a live widget.
//
// ─────────────────────────────────────────────────────────────────────────────
// HOST-WIRED ACTION CALLBACKS (Model is PURE read-only — NO template forwarders)
// ─────────────────────────────────────────────────────────────────────────────
// The widget exits (cardTap / tapVideo / loadMore / floating close / minimized
// expand / minimized close) are NOT template methods — mirrors iOS / Android /
// Flutter widget surfaces (pure read-only, NO mutating forwarder). So they are
// HOST-WIRED CONTAINER callbacks. The host wires them to the core widget exits it
// owns, e.g.:
//   • onTapVideo(v)      → host → core open full-screen Player for v.id
//                          (NOT this layer — reference-ui NEVER opens the player)
//   • onSeeMore          → host → navigate to the full video list
//   • onLoadMore         → host → core `LivebuyWidget.requestLoadMore()` (NOT here)
//   • onTapFloating(v)   → host → core open full-screen Player for v.id
//   • onCloseFloating    → host → core `simulateClose()` / dismiss (host self-manages re-mount)
//   • onExpand           → host → core restore full-screen from the minimized pill
//   • onCloseMinimized   → host → core dismiss the minimized pill
//
// Every callback is optional, so the container renders correctly action-free
// (demo / golden / structural-snapshot tests construct it without host wiring). This
// layer NEVER calls core `simulate*` (`simulateCardTap` / `simulateClose`) /
// `requestLoadMore`, and {@link WidgetModel} carries NO mutating forwarder.
//
// ─────────────────────────────────────────────────────────────────────────────
// EMBED COLORS (`widget_color` / `widget_bgcolor`) — forwarded RAW, derived NOWHERE HERE
// ─────────────────────────────────────────────────────────────────────────────
// This container reads `model.widgetColor` / `model.widgetBgcolor` and forwards them RAW
// to the CAROUSEL and GRID branches only; the two surfaces own the derivation
// (`ReferenceUIWidgetEmbedTheme.derive`, rb-rn-widget-embed-colors).
//
// ⚠️ THE RN TRAP (design RD2): this container MUST NOT derive. It is the SINGLE
// dispatcher for all four widget surfaces and hands the SAME `theme` prop to each branch,
// so `const theme = derive(...)` at the top of the body would be one tidy line — and
// would tint the floating card and the minimized pill, which
// `widget-embed-colors` §"RN 浮動與最小化表面不受 widget 顏色影響" forbids. The same goes
// for `WidgetSurfaceContext.theme` one level up: that IS the object handed to this
// component. `MinimizedWidget` only ever reads `theme.fontScale`, so that leak would be
// invisible in every structural snapshot — the guard is the test asserting both excluded
// surfaces receive the caller's theme object BY REFERENCE.
//
// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT-CARD MODE (`product_card`) — this container is the SINGLE source for BOTH paths
// ─────────────────────────────────────────────────────────────────────────────
// `model.productCard` (raw `product_card`, never normalized here) is forwarded to the
// carousel and grid surfaces, which hand it down verbatim to every `CarouselCardView`; the
// card owns the ONE fallback entry point (`normalizeProductCardMode`).
//
// Both RN entry points converge HERE — the manual assembly renders this container
// directly, and the turnkey drop-in `LivebuyWidget` reaches it through
// `ReferenceUIDesign.widgetSurface`, which hands over the `widgetTemplate` itself (this
// container then builds its own `WidgetModel`). So `WidgetSurfaceContext` deliberately
// carries NO `productCard` field: a host-supplied design already receives
// `context.widgetTemplate` and can read the same value via
// `new WidgetModel(context.widgetTemplate).productCard`. (This is where RN differs from
// Android, whose drop-in composes the surfaces directly and therefore does need a context
// field.) The floating surface is deliberately NOT fed — see the switch below.
//
// ─────────────────────────────────────────────────────────────────────────────
// SUB-VIEW INPUT PATTERN — the contract the 4 Surfaces agents MUST follow
// ─────────────────────────────────────────────────────────────────────────────
// Every family-5 surface is a function component
// `(props: { theme: ReferenceUITheme; ...byValueSnapshot; ...trailingCallbacks })`
// returning `ReactElement` (or `null` for the floating "render NOTHING" case), with
// props IN THIS ORDER:
//
//   1. `theme` (ReferenceUITheme)   — FIRST, always.
//   2. its bound SNAPSHOT VALUE(S)  — read-only state, passed BY VALUE from the
//                                      WidgetModel (never the model, never the template).
//   3. optional action callbacks    — trailing, EACH defaulting to a no-op.
//
// A surface reads ONLY its passed-in values — it MUST NOT reach back into the
// WidgetModel / DefaultWidgetTemplate (one-way data flow), MUST NOT hold a second
// copy of state, MUST NOT call core `simulate*` / `requestLoadMore`, MUST render
// correctly with all callbacks omitted (so golden / structural-snapshot tests construct
// it action-free), and MUST use plain View/Text/Pressable only (NO ScrollView /
// FlatList / SectionList / VirtualizedList; NO network-uri Image). The carousel row
// is a PLAIN Row FIXED SMALL set; the video-shop grid is a PLAIN Column of 2-col Rows
// FIXED SMALL set; pagination / infinite-scroll is the HOST's job (onLoadMore
// forwards). The shared `CarouselCardView` primitive is built by this skeleton and
// re-exported below.
//
// The four Surfaces agents implement EXACTLY these prop signatures (see the call
// sites in the render body below):
//
//   Carousel(props: {
//       theme: ReferenceUITheme;
//       videos: readonly LBVideoItem[];
//       title?: string;                                 // header title (default「精選影片」)
//       subtitle?: string;                              // optional header subtitle
//       goodsFor?: (item: LBVideoItem) => WidgetGoods | null;  // per-card overlay (demo: WidgetSeeds.goodsFor)
//       productCard?: string | null;                    // RAW product_card → each card (see below)
//       widgetColor?: number;                           // RAW widget_color  → derived HERE (embed colors)
//       widgetBgcolor?: string | null;                  // RAW widget_bgcolor → derived HERE (not visible: no bg)
//       onTapVideo?: (item: LBVideoItem) => void;       // card tap → host (open player)
//       onSeeMore?: () => void;                         // header「查看更多 ›」→ host
//   }): ReactElement
//
//   VideoShopGrid(props: {
//       theme: ReferenceUITheme;
//       videos: readonly LBVideoItem[];
//       currentPage: number;
//       lastPage: number;
//       goodsFor?: (item: LBVideoItem) => WidgetGoods | null;
//       productCard?: string | null;                    // RAW product_card → each cell (see below)
//       widgetColor?: number;                           // RAW widget_color  → derived HERE (embed colors)
//       widgetBgcolor?: string | null;                  // RAW widget_bgcolor → derived HERE (the ONE visible spot)
//       onTapVideo?: (item: LBVideoItem) => void;       // card tap → host (open player)
//       onLoadMore?: () => void;                        // footer →「載入更多影片…」(currentPage<lastPage) / else「已顯示全部影片」
//   }): ReactElement
//
//   FloatingWidget(props: {
//       theme: ReferenceUITheme;
//       liveVideo: LBVideoItem | null;                  // null → render NOTHING (null)
//       goods?: WidgetGoods | null;
//       onTap?: (item: LBVideoItem) => void;            // whole-card tap → host (open player)
//       onClose?: () => void;                           // top-right round close → host
//   }): ReactElement | null
//
//   MinimizedWidget(props: {
//       theme: ReferenceUITheme;
//       isLive: boolean;                                // derived from liveVideo?.liveStatus (no isLive field)
//       onExpand?: () => void;                          // pill tap → host (restore full-screen)
//       onClose?: () => void;                           // top-right close → host
//   }): ReactElement
//
// The container passes the deterministic per-card goods overlay via
// `WidgetSeeds.goodsFor` (the RN core `LBVideoItem` has no `goods` field). The host
// path supplies its own `goodsFor` (or `() => null` → no overlay).

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import type { ReferenceUITheme } from '../theme';
import { WidgetModel, WidgetSeeds } from './WidgetModel';
import type { WidgetGoods } from './WidgetModel';
import { externalLiveAwareTap } from './ExternalLive';

import { Carousel } from './CarouselView';
import { ScrollableVideoShopView } from './ScrollableVideoShopView';
import { FloatingWidget } from './FloatingWidgetView';
import { MinimizedWidget } from './MinimizedWidgetView';

import type { LBVideoItem } from 'livebuy-react-native';
import type { DefaultWidgetTemplate } from 'livebuy-react-native-ui';
import { LBWidgetContentMode } from 'livebuy-react-native-ui';

// Re-export the shared card primitive + the four embedded widget surfaces so hosts
// (and the family barrel) can pull them from the container module (parity with the
// iOS/Android/Flutter family barrels).
export { CarouselCardView } from './CarouselCardView';
export { Carousel } from './CarouselView';
export { VideoShopGrid } from './VideoShopGridView';
export { FloatingWidget } from './FloatingWidgetView';
export { MinimizedWidget } from './MinimizedWidgetView';

/** Props for the family-5 embedded-widget container. */
export interface WidgetOverlayViewProps {
  /**
   * Live WIDGET template (host-supplied via `widgetTemplate(widgetKey)`).
   * `null`/omitted → deterministic demo seeds.
   */
  readonly widgetTemplate?: DefaultWidgetTemplate | null;

  /** The resolved reference-ui theme. */
  readonly theme: ReferenceUITheme;

  /**
   * Optional per-card product overlay resolver (reference-ui {@link WidgetGoods} — the
   * RN core `LBVideoItem` has no `goods` field). Defaults to {@link WidgetSeeds.goodsFor}
   * (deterministic demo overlays). Pass `() => null` for no overlay.
   */
  readonly goodsFor?: (item: LBVideoItem) => WidgetGoods | null;

  /**
   * Live-flag gate (parity iOS `live`). `false` (snapshot / demo — the DEFAULT) → every
   * card draws ONLY the deterministic cover placeholder (NO network-uri `<Image>` in the
   * tree → structural snapshots unchanged). `true` (host runtime, real widget surface) →
   * the real `video.cover` photo loads over each placeholder (via the cards'
   * {@link RemoteImage}). Threaded into the carousel / grid / floating surfaces (the
   * minimized pill carries no `LBVideoItem`, so it is unaffected). The container
   * (`LivebuyWidget`) passes `WidgetSurfaceContext.live` ← `LivebuyWidgetConfig.live`.
   */
  readonly live?: boolean;

  // Host-wired interaction callbacks. The container owns NO core action — each is
  // forwarded to the host (which wires it to the core widget exit). All optional; an
  // omitted callback means an inert exit. The Model carries NO forwarder for these
  // (widget actions are NOT template methods — mirrors iOS / Android / Flutter widget
  // surfaces).

  /** Card tap (carousel / grid) → host → core open full-screen Player for the video. */
  readonly onTapVideo?: (item: LBVideoItem) => void;
  /** Carousel header「查看更多 ›」→ host (navigate to the full video list). */
  readonly onSeeMore?: () => void;
  /** Grid load-more footer → host → core `requestLoadMore()`. NEVER paginates here. */
  readonly onLoadMore?: () => void;
  /** Floating card tap → host → core open full-screen Player for the live video. */
  readonly onTapFloating?: (item: LBVideoItem) => void;
  /** Floating close → host → core `simulateClose()` / dismiss (host self-manages re-mount). */
  readonly onCloseFloating?: () => void;
  /** Minimized pill tap → host → core restore full-screen from the minimized state. */
  readonly onExpand?: () => void;
  /** Minimized close → host → core dismiss the minimized pill. */
  readonly onCloseMinimized?: () => void;
}

/**
 * The family-5 embedded-widget container. Subscribes to the bound widget template's
 * coalesced `subscribe()` notification, re-reads the read-only {@link WidgetModel} on
 * each notify (via a `useState` tick), and DISPATCHES the single surface matching
 * `content.mode` (carousel / grid / floating / minimized — mutually exclusive) by
 * passing snapshot values BY VALUE to the surface components. Paints with the resolved
 * {@link ReferenceUITheme}. All widget actions are host-wired container callbacks (no
 * template widget intents exist; the Model is PURE read-only).
 *
 * `widgetTemplate == null` → the container reads the deterministic {@link WidgetSeeds}
 * (nothing to subscribe to); the host normally supplies a live
 * {@link DefaultWidgetTemplate}.
 */
export function WidgetOverlayView(props: WidgetOverlayViewProps): ReactElement | null {
  const {
    widgetTemplate = null,
    theme,
    goodsFor,
    live = false,
    onTapVideo,
    onSeeMore,
    onLoadMore,
    onTapFloating,
    onCloseFloating,
    onExpand,
    onCloseMinimized,
  } = props;

  // Coalesced re-read tick (parity with the family-1/2/3/4 containers + the Flutter
  // ListenableBuilder re-read). On each template notify we bump the tick so React
  // re-renders and re-reads every getter off a freshly-constructed read-only model
  // (the model holds no state of its own). The demo path (widgetTemplate == null) has
  // nothing to subscribe to and renders the seeds.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (widgetTemplate == null) return;
    const unsubscribe = widgetTemplate.subscribe(() => setTick((t) => t + 1));
    return unsubscribe;
  }, [widgetTemplate]);

  const model = new WidgetModel(widgetTemplate);

  // Redirect external-platform lives (Facebook) out to their platform on tap instead of
  // opening the in-app player (external-live-watch); non-external lives forward to the host
  // callbacks unchanged. Wrap BOTH the card tap (carousel / grid) and the floating tap.
  const routedTapVideo = externalLiveAwareTap(onTapVideo);
  const routedTapFloating = externalLiveAwareTap(onTapFloating);

  // Per-card goods overlay resolver (host-supplied or the deterministic demo). The RN
  // core `LBVideoItem` has no `goods` field, so the overlay is supplied BY VALUE here.
  const resolveGoods = (item: LBVideoItem): WidgetGoods | null =>
    (goodsFor ?? WidgetSeeds.goodsFor)(item);

  switch (model.mode) {
    case LBWidgetContentMode.Carousel:
      return (
        // Turnkey carousel SCROLLS horizontally over ALL videos (parity iOS
        // ScrollableCarouselView); the embedded/golden `Carousel` default stays windowed.
        <Carousel
          theme={theme}
          videos={model.videos}
          goodsFor={resolveGoods}
          live={live}
          scrollable
          productCard={model.productCard}
          // RAW embed colors — the surface derives them (never this container: it feeds
          // floating / minimized from the same `theme`, see the trap note above).
          widgetColor={model.widgetColor}
          widgetBgcolor={model.widgetBgcolor}
          onTapVideo={routedTapVideo}
          onSeeMore={onSeeMore}
        />
      );
    case LBWidgetContentMode.Grid:
      return (
        // Grid mode uses the lazy-load wrapper (rb-rn-widget-grid-lazy-load): it scrolls +
        // AUTO-loads the next page on scroll-to-bottom (no manual button).
        <ScrollableVideoShopView
          theme={theme}
          videos={model.videos}
          currentPage={model.currentPage}
          lastPage={model.lastPage}
          goodsFor={resolveGoods}
          live={live}
          productCard={model.productCard}
          // RAW embed colors — passed through the wrapper to the grid, which derives.
          widgetColor={model.widgetColor}
          widgetBgcolor={model.widgetBgcolor}
          onTapVideo={routedTapVideo}
          onLoadMore={onLoadMore}
        />
      );
    case LBWidgetContentMode.Floating: {
      // liveVideo == null → FloatingWidget renders NOTHING (null). (Named `liveVideo`,
      // distinct from the `live` real-cover flag prop above.)
      // NO `productCard` here, deliberately: the floating surface is fed by
      // `/sdk/widget/live`, whose wire payload does NOT carry `product_card` (the value
      // would always be null → 'inside' anyway). Same decision as iOS / Android.
      // NO `widgetColor` / `widgetBgcolor` here either, deliberately: the floating card
      // keeps the UNDERIVED theme (`widget-embed-colors` §"RN 浮動與最小化表面不受
      // widget 顏色影響"). `FloatingWidget` does not even take those props — adding them
      // here would not compile, which is the cheap half of the guard; the test asserting
      // it receives `theme` BY REFERENCE is the half that also covers deriving upstream.
      const liveVideo = model.liveVideo;
      return (
        <FloatingWidget
          theme={theme}
          liveVideo={liveVideo}
          goods={liveVideo == null ? null : resolveGoods(liveVideo)}
          live={live}
          onTap={routedTapFloating}
          onClose={onCloseFloating}
        />
      );
    }
    case LBWidgetContentMode.Minimized:
      return (
        // NO embed colors here either — same exclusion as the floating branch above. This
        // pill only reads `theme.fontScale`, so a leak would be invisible in every
        // structural snapshot; the by-reference assertion in the tests is what catches it.
        <MinimizedWidget
          theme={theme}
          isLive={model.minimizedIsLive}
          onExpand={onExpand}
          onClose={onCloseMinimized}
        />
      );
    default:
      return null;
  }
}
