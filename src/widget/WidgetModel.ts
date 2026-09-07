// WidgetModel — family-5 embedded-widget read-only snapshot bridge (RN).
//
// Spec: `reference-ui-rendering/spec.md` (family-5 widget — 1 shared card primitive
// + 4 embedded widget surfaces). Phase-4 RN sibling of the DONE iOS `WidgetModel
// .swift` (rb-ios-widget), Android `WidgetModel.kt` (rb-android-widget), and Flutter
// `widget_model.dart` (rb-flutter-widget — the authoritative blueprint translated
// here 1:1).
//
// It bridges the headless WIDGET template's host-bindable content view-model exposed
// by `DefaultWidgetTemplate.content` (a `DefaultWidgetContent`, see
// react-native-ui/src/WidgetContent.ts) into a read-only snapshot the family-5 RN
// surface components read. It is a pure read-only MIRROR — IDENTICAL pattern to
// family-1 `PlayerShellModel` / family-2 `FeedWinModel` / family-3
// `ProductSheetsModel` / family-4 `MomentsModel`:
//
//   - It owns NO second copy of authoritative state. Every getter reads the
//     template's own public snapshot (`content.current`, an immutable
//     `LBWidgetContent`) each call, so there is nothing to drift from the template.
//   - It adds NO pixels and adds NO accessor / view-model to `livebuy-react-native-ui`
//     (a template-layer concern, out of scope here).
//
// ── widget host-bindable entry (DIFFERENT from player — family-5 binds the WIDGET
//    template, NOT the player template) ─────────────────────────────────────────
//   The host obtains the bound `DefaultWidgetTemplate` via
//   `widgetTemplate(widgetKey)` (react-native-ui/src/TemplateAttachment.ts; returns
//   `undefined` when not installed / not attached, symmetric with iOS
//   `LivebuyUI.widgetTemplate(for:)` / Android `LivebuyUI.widgetTemplate(widget)` /
//   Flutter `LivebuyUI.widgetTemplate(controller)`), then passes it to the container
//   `WidgetOverlayView`, which constructs this model. The model reads
//   `template.content.current` (`LBWidgetContent`):
//     videos / mode / currentPage / lastPage / liveVideo / widgetColor / widgetBgcolor.
//
// ── CRITICAL: NO mutating forwarders (mirrors family-4) ──────────────────────────
//   The widget exits (cardTap / tapVideo / loadMore / floating close / minimized
//   expand / minimized close) are NOT template methods — they are HOST-WIRED
//   CONTAINER callbacks (mirrors iOS / Android / Flutter widget surfaces: pure
//   read-only, NO mutating forwarder). So this model is a PURE read-only snapshot; it
//   carries NO mutating methods. The container (`WidgetOverlayView`) holds the
//   host-wired exits (`onTapVideo` / `onLoadMore` / `onTapFloating` / `onCloseFloating`
//   / `onExpand` / `onCloseMinimized`). This layer MUST NOT call core `simulate*`
//   (`simulateCardTap` / `simulateClose`) / `requestLoadMore`.
//
// ── widgetColor / widgetBgcolor / productCard are RAW PASSTHROUGH ────────────────
//   `widgetColor` / `widgetBgcolor` are web-embed raw passthrough — THIS MODEL mirrors
//   them verbatim and MUST NOT interpret their semantics. The interpretation lives one
//   layer out, in the widget SURFACES (`ReferenceUIWidgetEmbedTheme.derive`,
//   rb-rn-widget-embed-colors); the global `ReferenceUIThemeResolver` still never sees
//   them, and neither do the floating / minimized surfaces.
//   `productCard` (`product_card`) is the SAME KIND of raw passthrough: mirrored as a
//   plain getter, NEVER normalized here. Unlike the two colors it DOES drive pixels —
//   but only after `CarouselCardView`'s single pure fallback entry point
//   (`normalizeProductCardMode`) resolves it; this model MUST NOT normalize, and the
//   normalized value MUST NOT be written back here.
//
// ── goods overlay (video-linked-goods-core-rn closed the RN parity gap;
//    rb-rn-video-linked-goods-auto-render wires the default here) ────────────────
//   The design's `LBPCarouselCard` carries a bottom dark-glass product overlay
//   (`item.product` → name / price). iOS / Android core `LBVideoItem` has long exposed
//   `goods: LBFeaturedGood?`; the RN core `LBVideoItem` (`react-native/src/
//   LivebuySDK.ts`) now carries the SAME field (`goods?: LBFeaturedGood`,
//   `video-linked-goods-core-rn`, 2026-09) — the earlier "RN core has no `goods` field"
//   note here is stale. The reference-ui layer still carries a tiny READ-ONLY value type
//   {@link WidgetGoods} (`name` / `pic` / `price` / `originalPrice`) supplied BY VALUE to
//   the shared `CarouselCardView` primitive (SUB-VIEW INPUT PATTERN — the primitive
//   itself is source-agnostic and MUST NOT read `LBVideoItem.goods` directly; this is a
//   deliberate design choice, not a core-capability workaround). {@link
//   widgetGoodsFromFeatured} converts the core `LBFeaturedGood | undefined` into this
//   by-value type. The family-5 surfaces (`Carousel` / `VideoShopGrid`, see
//   `CarouselView.tsx` / `VideoShopGridView.tsx`) and the turnkey `LivebuyWidget`
//   container now DEFAULT to deriving each card's overlay from `item.goods` via this
//   function when the host omits `goodsFor`; a host-supplied `goodsFor` remains a full
//   OVERRIDE escape hatch (including explicitly returning `null` to hide a card), taking
//   precedence over the derived value. This model's own demo path (`template == null`)
//   is UNCHANGED — the deterministic {@link WidgetSeeds} videos never populate `.goods`,
//   so {@link WidgetSeeds.goodsFor} remains the demo / golden overlay source.
//
// No react / react-native import here — pure reads + plain-literal demo seeds, so it
// stays unit-testable in a plain node environment (parity with the family-1/2/3/4
// Models).

import type { LBFeaturedGood, LBVideoItem } from 'livebuy-react-native';
import { LBWidgetContentMode } from 'livebuy-react-native-ui';
import type { DefaultWidgetTemplate, LBWidgetContent } from 'livebuy-react-native-ui';
import { visibleVideos, visibleLive } from './widgetVisibility';

/**
 * A tiny read-only product-overlay value for the shared {@link CarouselCardView}'s
 * bottom dark-glass overlay (`LBPCarouselCard` `item.product`). Mirrors the
 * iOS / Android `LBFeaturedGood` overlay fields (`name` / `pic` / `price` /
 * `originalPrice`). Historically this existed to work around the RN core
 * `LBVideoItem` not carrying a `goods` field at all; that gap is now closed
 * (`video-linked-goods-core-rn`) and {@link widgetGoodsFromFeatured} converts the
 * core `LBFeaturedGood | undefined` into this type — but `WidgetGoods` itself still
 * exists, so the shared `CarouselCardView` primitive keeps a by-value,
 * source-agnostic input (SUB-VIEW INPUT PATTERN) rather than reaching into
 * `LBVideoItem` itself. `price` is a raw string (rendered verbatim after the「NT$ 」
 * prefix); `pic` is a URL the reference-ui NEVER fetches (deterministic placeholder
 * only). Supplied BY VALUE. RN sibling of the Flutter `WidgetGoods` value type.
 */
export interface WidgetGoods {
  /** Product name (1-line clamp in the overlay). */
  readonly name: string;
  /** Product thumbnail URL — NEVER fetched here (deterministic placeholder chip). */
  readonly pic?: string;
  /** Raw price string, rendered verbatim after the「NT$ 」prefix. */
  readonly price: string;
  /**
   * OPTIONAL raw original price — the source for the struck-through「was」price the
   * `product_card === 'below'` product row draws (design `LBPCardProductRow`'s
   * `product.was`). Mirrors the iOS / Android `LBFeaturedGood.originalPrice` field
   * (the RN core `LBFeaturedGood` now carries the same field,
   * `video-linked-goods-core-rn` — {@link widgetGoodsFromFeatured} copies it
   * verbatim). Omitted / empty after trim → NO struck-through price is drawn at
   * all. The `inside` overlay never draws one (the design's `LBPCardProductOverlay` has no
   * `was`). Raw passthrough — it runs through the same currency de-duplication as `price`.
   */
  readonly originalPrice?: string;
}

/**
 * Converts the core `LBFeaturedGood | undefined` (`LBVideoItem.goods`,
 * `video-linked-goods-core-rn`) into this layer's by-value {@link WidgetGoods} — the
 * DEFAULT data source the family-5 surfaces (`Carousel` / `VideoShopGrid`) and the
 * turnkey `LivebuyWidget` container now derive a card's product overlay from when the
 * host omits `goodsFor` (`rb-rn-video-linked-goods-auto-render`). `undefined` → `null`
 * (a video with no linked product renders no card, same as an unbound demo card).
 * `soldOut` / `stock` / `status` are NOT mapped — this primitive never consumed those
 * three raw flags (parity iOS / Android `CarouselCardView`, which likewise ignore
 * them for this overlay). Pure — no rounding / currency reformatting / trimming (the
 * existing `strikePrice` consumer already handles the "empty after trim → no
 * strikethrough" convention; this function does not duplicate that trim).
 */
export function widgetGoodsFromFeatured(featured: LBFeaturedGood | undefined): WidgetGoods | null {
  if (featured == null) return null;
  return {
    name: featured.name,
    pic: featured.pic,
    price: featured.price,
    originalPrice: featured.originalPrice,
  };
}

/**
 * Read-only snapshot bridge for the family-5 widget surfaces. Wraps a live
 * {@link DefaultWidgetTemplate}; every accessor reads `template.content.current`
 * (`LBWidgetContent`) each call (no stored mirror). For demos / previews / structural
 * snapshot tests, construct with `template = null`/omitted — the getters then return
 * the deterministic {@link WidgetSeeds} values (a fully-populated content snapshot),
 * so a snapshot does NOT depend on a live widget. Mirrors the Flutter
 * `WidgetModel(template: null)`.
 *
 * ★ CRITICAL: this model carries NO mutating forwarder. Widget actions (cardTap /
 *   tapVideo / loadMore / floating close / minimized expand / minimized close) are
 *   HOST-WIRED container callbacks, NOT template methods — mirrors iOS / Android /
 *   Flutter `WidgetModel`.
 */
export class WidgetModel {
  /** The bound widget template, or `null` for demo / golden instances. */
  readonly template: DefaultWidgetTemplate | null;

  /**
   * Bridge a live widget template (host-supplied via `widgetTemplate(widgetKey)`) —
   * or `null`/omitted for the deterministic demo seeds (previews / structural
   * snapshot tests).
   */
  constructor(template?: DefaultWidgetTemplate | null) {
    this.template = template ?? null;
  }

  /**
   * The current host-bindable widget content snapshot (`template.content.current`).
   * For the demo path (`template == null`) it returns the deterministic
   * {@link WidgetSeeds.content}. Read-only; never mutated here.
   */
  get content(): LBWidgetContent {
    return this.template?.content ?? WidgetSeeds.content;
  }

  // -- Surface-bound projections (read each call off `content`) -----------------

  /**
   * Card-row data for carousel / grid (`content.videos`). Demo default: a mixed
   * VOD + LIVE set ({@link WidgetSeeds.videos}).
   */
  get videos(): readonly LBVideoItem[] {
    // Hide in-app-unplayable lives (`type===2 && liveStatus===1 && liveurl===''`)
    // from the card list (rb-rn-widget-hide-urlless-live). Applied ONLY on the live
    // template path; the demo seeds (which legitimately contain such combinations)
    // render unchanged so structural snapshots stay byte-identical (parity iOS D4).
    return this.template != null ? visibleVideos(this.content.videos) : this.content.videos;
  }

  /** Layout mode (`content.mode`): carousel / grid / floating / minimized. */
  get mode(): LBWidgetContentMode {
    return this.content.mode;
  }

  /** Pagination cursor — current page (`content.currentPage`). */
  get currentPage(): number {
    return this.content.currentPage;
  }

  /** Pagination cursor — last page (`content.lastPage`). */
  get lastPage(): number {
    return this.content.lastPage;
  }

  /**
   * The single floating live card (`content.liveVideo`); null when not floating /
   * no live card.
   */
  get liveVideo(): LBVideoItem | null {
    // Same in-app-unplayable-live hiding for the floating preview (live path only):
    // a urlless live resolves to null (floating renders nothing; minimized reports
    // not-live). Demo seeds unchanged. rb-rn-widget-hide-urlless-live.
    return this.template != null ? visibleLive(this.content.liveVideo) : this.content.liveVideo;
  }

  /**
   * Web-embed text color MODE — RAW PASSTHROUGH (`content.widgetColor`). `1`=預設色彩,
   * `2`=色彩反轉 (web renders `2` as `#ffffff` and `1` as no override); these are MODES,
   * not color swatches. THIS layer MUST NOT interpret it — the widget surfaces do, via
   * `ReferenceUIWidgetEmbedTheme.derive`.
   */
  get widgetColor(): number {
    return this.content.widgetColor;
  }

  /**
   * Web-embed background color — RAW PASSTHROUGH (`content.widgetBgcolor`). Transparent
   * is the EMPTY STRING `''`, never Int `1`. THIS layer MUST NOT interpret it — the
   * widget surfaces do, treating `''` / `null` / unparseable alike as "leave it alone".
   */
  get widgetBgcolor(): string | null {
    return this.content.widgetBgcolor;
  }

  /**
   * Carousel product-card display mode (`product_card`) — RAW PASSTHROUGH
   * (`content.productCard`). The SAME kind of passthrough as `widgetColor` /
   * `widgetBgcolor`: this model MUST NOT normalize / rewrite it, and `null` (the backend
   * sent nothing) MUST stay distinguishable from the backend sending `'inside'`. The
   * UI-layer fallback lives in exactly one pure function
   * (`normalizeProductCardMode` in `CarouselCardView.tsx`), consumed by the cards; the
   * normalized value is NEVER written back here.
   *
   * Like the two colors this is a getter that re-reads `content` on every call — no stored
   * mirror to drift from the template.
   */
  get productCard(): string | null {
    return this.content.productCard;
  }

  // -- Shared LIVE derivation (single source for ALL family-5 surfaces) ----------

  /**
   * Whether an {@link LBVideoItem} is a LIVE card. Core `LBVideoItem` carries only
   * `liveStatus: number` (no distinct upcoming / replay flag). Parity with iOS /
   * Android / Flutter `WidgetModel.isLive` (`liveStatus === 1`) — any other value →
   * VOD. This is the SINGLE source of LIVE truth shared by `CarouselCardView` (kind
   * badge), `FloatingWidget`, and `MinimizedWidget` (which has no `isLive` field and
   * derives it from `liveVideo?.liveStatus`). Documented approximation
   * (spec §family-5): upcoming / replay collapse into VOD.
   */
  static isLive(item: LBVideoItem): boolean {
    return item.liveStatus === WidgetSeeds.liveSentinel;
  }

  /**
   * The minimized pill's derived LIVE flag (`liveVideo?.liveStatus` indicates live).
   * `LBWidgetContent` has NO `isLive` field — derive it from `liveVideo` (same source
   * as the `CarouselCardView` kind badge). Null `liveVideo` → false.
   */
  get minimizedIsLive(): boolean {
    const v = this.liveVideo;
    return v != null && WidgetModel.isLive(v);
  }
}

// MARK: - Deterministic demo seeds (previews / structural snapshot tests)

/** Build a deterministic demo `LBVideoItem` via the full RN core 18-field shape. */
function demoVideo(args: {
  id: string;
  title: string;
  live: boolean;
  duration: number;
  publishAt?: string;
  // rb-rn-widget-upcoming-type（問題 6）：後端 `type` —— 2=直播/預告場、1=一般 VOD。
  // 預設由 `live` 推導（live → 2、VOD → 1）；upcoming 種子明確帶 2（liveStatus 0 + type 2）。
  type?: number;
  // 外部平台直播 liveurl（預設 ''，使既有種子 byte-identical；external-live-watch）。
  liveurl?: string;
}): LBVideoItem {
  return {
    id: args.id,
    type: args.type ?? (args.live ? 2 : 1),
    title: args.title,
    sessionName: undefined,
    cover: '',
    preview: '',
    duration: args.duration,
    publishAt: args.publishAt ?? '2026-06-06 20:00:00',
    watchNum: 0,
    pvNum: 0,
    liveStatus: args.live ? 1 : 0,
    pin: 0,
    showPvNum: 0,
    liveurl: args.liveurl ?? '',
    playbackurl: '',
    previewTime: '',
    showStock: false,
  };
}

const seedVideos: readonly LBVideoItem[] = [
  demoVideo({ id: 'widget-vod-001', title: '週五美妝直播・新品開箱', live: false, duration: 28 }),
  demoVideo({ id: 'widget-live-002', title: '早春保養 LIVE 開賣', live: true, duration: 0 }),
  demoVideo({ id: 'widget-vod-003', title: '主廚私房快煮鍋具', live: false, duration: 754 }),
  demoVideo({ id: 'widget-live-004', title: '週年慶必囤清單 LIVE', live: true, duration: 0 }),
];

const seedLiveVideo: LBVideoItem = demoVideo({
  id: 'widget-live-100',
  title: '今晚 8 點 · 春季新品快閃',
  live: true,
  duration: 0,
});

// An EXTERNAL (Facebook) floating live fixture (external-live-watch): a live whose
// `liveurl` host is `www.facebook.com`, so a tap routes out to Facebook instead of
// the in-app player.
const seedExternalLiveVideo: LBVideoItem = demoVideo({
  id: 'widget-live-fb-001',
  title: 'Facebook 直播・現正開賣',
  live: true,
  duration: 0,
  liveurl: 'https://www.facebook.com/870374236326161/videos/1024740573341806',
});

// The UPCOMING (直播預告) fixture for the shared `CarouselCardView` snapshot
// (`carousel-card-upcoming`): NOT live (`liveStatus === 0`) + a FAR-FUTURE
// `publishAt` (`2099-01-01 20:00:00`, always parses as future → snapshot-stable, no
// machine-clock dependency) so the card renders the UPCOMING treatment (dark mask +
// centred「1月1日」/「20:00」).
const seedUpcomingVideo: LBVideoItem = demoVideo({
  id: 'widget-upcoming-001',
  title: '週五美妝直播・新品開箱',
  live: false,
  duration: 0,
  publishAt: '2099-01-01 20:00:00',
  // rb-rn-widget-upcoming-type（問題 6）：scheduled-live 場 → `type === 2`（liveStatus 0 + type 2
  // → upcoming，去除 publishAtInFuture 時鐘 heuristic）。far-future publishAt 仍作 date 可解析 guard。
  type: 2,
});

/**
 * Plain-literal deterministic seeds for the family-5 surfaces' previews + the
 * per-surface structural snapshot tests. Constructed via the public core
 * `LBVideoItem` shape + the reference-ui {@link WidgetGoods} overlay value, so a
 * snapshot does NOT depend on a live widget. Mirrors the iOS demo data + the
 * Android / Flutter `WidgetSeeds`.
 *
 * The golden baselines each drive ONE surface from these seeds (names parity with
 * iOS / Android / Flutter):
 *   • {@link vodWithGoods} (+ {@link vodWithGoodsGoods}) — `carousel-card-vod-with-goods`.
 *   • {@link videos} — `carousel-header-and-row` (the carousel row).
 *   • {@link videos} + {@link gridCurrentPage} / {@link gridLastPage} — `video-shop-grid-load-more`.
 *   • {@link liveVideo} — `floating-widget-live-preview`.
 *   • {@link liveVideo} (minimized) — `minimized-widget-live`.
 */
export const WidgetSeeds = {
  /**
   * `liveStatus === 1` is the LIVE sentinel (parity with iOS / Android / Flutter
   * `WidgetModel.isLive` — `liveStatus === 1` → LIVE; any other value → VOD). VOD
   * cards use `liveStatus === 0`.
   */
  liveSentinel: 1 as const,
  vodSentinel: 0 as const,

  /**
   * A deterministic VOD card with a product overlay (`liveStatus === 0`,
   * `duration === 28` → formatted `00:28`). Drives `carousel-card-vod-with-goods`.
   */
  vodWithGoods: seedVideos[0]!,

  /**
   * The product overlay paired with {@link vodWithGoods} (drawn by
   * `CarouselCardView`'s bottom dark-glass overlay). Reference-ui value (NOT a core
   * type).
   */
  vodWithGoodsGoods: { name: '玫瑰精萃保濕水', pic: '', price: '880' } as WidgetGoods,

  /**
   * A deterministic mixed VOD + LIVE card set for the carousel row / grid
   * (`carousel-header-and-row` / `video-shop-grid-load-more`). FIXED SMALL set — the
   * surfaces draw the visible first N in a plain Row / Column (NO lazy / scroll). All
   * carry a goods overlay via {@link goodsFor} (deterministic).
   */
  videos: seedVideos,

  /**
   * The single floating live card (`floating-widget-live-preview` /
   * `minimized-widget-live`). `liveStatus === 1` → drawn as LIVE; carries a goods
   * overlay via {@link goodsFor}.
   */
  liveVideo: seedLiveVideo,

  /**
   * An EXTERNAL (Facebook) floating live fixture (external-live-watch): a live whose
   * `liveurl` host is `www.facebook.com`, so a tap routes out to Facebook (not the
   * in-app player).
   */
  externalLiveVideo: seedExternalLiveVideo,

  /**
   * The UPCOMING (直播預告) fixture for the shared `CarouselCardView` snapshot
   * (`carousel-card-upcoming`): `liveStatus === 0` + a far-future `publishAt`
   * (`2099-01-01 20:00:00`, always parses as future → snapshot-stable) so the card
   * renders the UPCOMING treatment (dark mask + centred「1月1日」/「20:00」). Pairs with
   * {@link vodWithGoodsGoods} for the bottom product overlay (the upcoming mask sits
   * above it). Mirrors the Flutter / Android `WidgetSeeds.upcomingVideo`.
   */
  upcomingVideo: seedUpcomingVideo,

  /**
   * Pagination seed: current page (`video-shop-grid-load-more` shows the
   * 「載入更多影片…」footer because `currentPage < lastPage`).
   */
  gridCurrentPage: 1,

  /** Pagination seed: last page. */
  gridLastPage: 3,

  /**
   * The deterministic demo widget content snapshot returned for the demo path
   * (`new WidgetModel()` / `new WidgetModel(null)`). A carousel snapshot by default;
   * the container / surfaces select the relevant fields per `mode`. Built from the
   * seed videos + pagination + live card. `widgetColor` / `widgetBgcolor` / `productCard`
   * are RAW PASSTHROUGH (core defaults `1` / `null` / `null`) — NEVER interpreted here.
   *
   * `productCard` is listed EXPLICITLY: this object is built with an `as LBWidgetContent`
   * assertion, which does NOT reject a missing property, so before it was added the demo
   * path (`new WidgetModel()`) read `undefined` rather than the contract's `null`. Both
   * normalize to `'inside'`, so demo pixels are unchanged either way — the explicit `null`
   * simply makes the seed match the type it claims to be.
   */
  content: {
    videos: seedVideos,
    mode: LBWidgetContentMode.Carousel,
    currentPage: 1,
    lastPage: 3,
    liveVideo: seedLiveVideo,
    widgetColor: 1,
    widgetBgcolor: null,
    productCard: null,
  } as LBWidgetContent,

  /**
   * A deterministic goods overlay keyed off a card's `id` (so the carousel row / grid
   * cards each show a stable, distinct product overlay in goldens without a core
   * `goods` field). Pure mapping — NO network, NO randomness. Mirrors the Flutter
   * `WidgetSeeds.goodsFor`.
   */
  goodsFor(item: LBVideoItem): WidgetGoods {
    switch (item.id) {
      case 'widget-vod-001':
        return { name: '玫瑰精萃保濕水', pic: '', price: '880' };
      case 'widget-live-002':
        return { name: '輕透氣墊粉餅', pic: '', price: '1,280' };
      case 'widget-vod-003':
        return { name: '不沾深炒鍋', pic: '', price: '1,680' };
      case 'widget-live-004':
        return { name: '保暖羊毛圍巾', pic: '', price: '990' };
      case 'widget-live-100':
        return { name: '限量春季禮盒', pic: '', price: '2,180' };
      default:
        return { name: '精選好物', pic: '', price: '680' };
    }
  },
} as const;
