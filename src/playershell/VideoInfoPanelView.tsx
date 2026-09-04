// VideoInfoPanelView — family-1 player-shell surface 3 (info / notice panel).
//
// Spec: `reference-ui-rendering/spec.md` (family-1 player-shell, surface 3).
// Design: `design/templates/minimal/screens.jsx` `VideoInfoSheet` +
//          `design/templates/minimal/sdk-components.jsx` `LBPBottomSheet` /
//          `LBPSheetHeader`.
// Blueprint (primary): flutter-reference-ui/lib/src/playershell/video_info_panel.dart
//   (carries the RECONCILED final state). iOS parity:
//   ios/Sources/LivebuyReferenceUI/PlayerShell/VideoInfoPanelView.swift.
//   Android parity: android/livebuy-reference-ui/.../playershell/VideoInfoPanel.kt.
//
// The bottom-sheet info/notice panel — the third of the four family-1 surface
// components composed by `PlayerShellView`. It implements the agreed RN
// SUB-VIEW INPUT PATTERN:
//
//   1. `theme` (ReferenceUITheme)            — FIRST, always.
//   2. bound SNAPSHOT VALUES (read-only, BY VALUE):
//        `fields: LBInfoTabState`, `isSubscribed: boolean` (a SEPARATE arg —
//        single subscribe truth lives on the header, mirrored here; matches the
//        Flutter sub-view's separate `isSubscribed`), `activeTab: LBInfoPanelTab`,
//        `noticeCanOpen: boolean`, `systemNotice: string`, `notice: string`.
//   3. action callback (LAST, defaulting to a no-op):
//        `onSelectTab?: (tab: LBInfoPanelTab) => void` — the host wires it to the
//        template's `selectInfoTab` navigation intent.
//
// This sub-view reads ONLY its passed-in values; it never reaches back into
// `PlayerShellModel` / `DefaultPlayerTemplate` (one-way data flow), holds NO
// second copy of state, and renders correctly with `onSelectTab` omitted.
//
// Two-tab panel (mirrors `VideoInfoSheet` + the spec's `LBInfoPanelTab`):
//   • 影片詳情 (`info`)   — ALWAYS selectable. Shows publishAt / title /
//                            shopIntro, a divider, then a shop row (logo monogram
//                            + shopName + 「這裡是 …」 subline + subscribe affordance
//                            bound to `isSubscribed`).
//   • 公告     (`notice`) — rendered ONLY when `noticeCanOpen == true`. When
//                            un-openable the tab item is NOT RENDERED AT ALL (no
//                            disabled affordance, no 「· 無」suffix — the tab bar
//                            just has one tab. rb-rn-notice-tab-hide-when-empty,
//                            RN parity of iOS/Android hide-when-empty).
//
// RECONCILED notice design (the agreed final iOS state — done directly here, no
// placeholder-tab stage): the 公告 tab renders `systemNotice` (系統公告, textDim)
// and `notice` (商城公告, accent) IN-PANEL as two blocks, with a hairline divider
// between them ONLY when both are present. When BOTH are empty it draws the dim
// disabled placeholder「目前沒有公告」.
//
// SHOP LOGO — real remote image OVER the monogram chip
// (rn-videoinfo-shop-logo-real-image-refui, RN parity of the iOS
// `videoinfo-shop-logo-real-image-refui`):
//
// The shop row's 44×44 chip is NO LONGER the final pixel. The monogram chip stays as the
// ALWAYS-DRAWN BOTTOM LAYER and the real `fields.shopLogo` image is OVERLAID on top,
// gated by the `live` runtime flag — structurally identical to what
// `PlayerHeaderBarView.renderAvatar` has been doing all along for the SAME logo.
//
// It is an OVERLAY, never an either/or: `RemoteImage` paints NO pixels while the image is
// still downloading and paints none after an `onError` (it returns `null`). If the chip
// were the `else` branch instead of the floor, both states would punch a transparent hole
// through the row. Layering makes the chip absorb the loading AND failure states, so this
// file needs ZERO error UI, ZERO spinner, ZERO extra placeholder asset.
//
// RENDER DISCIPLINE (inherited from iOS / Android / Flutter lessons): plain
// View / Text / Pressable for the content — NO FlatList / SectionList; the logo monogram is
// a deterministic gradient-like placeholder (a solid swatch, since the RN snapshot is
// structural). The ONLY network image is the `live`-gated shop-logo overlay above: with
// `live` omitted / false (demo / snapshot — the DEFAULT) `RemoteImage` returns `null`, so
// the DEFAULT path still contributes NO `<Image>` node to the structural tree and the
// package-wide「findAllByType('Image') === 0」discipline (`RemoteImage.tsx` header) holds.
// The tab content is placed inside the shared
// `SheetScaffold`'s `<ScrollView>` body (rb-rn-sheet-pinned-header-footer) so a long
// notice scrolls under the pinned header / footer CTAs. No animation / no randomness so
// the structural tree is byte-stable.

import type { ReactElement } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '../TightText';

import { RemoteImage } from '../productsheets/RemoteImage';
import { SheetHeaderCloseButton } from '../productsheets/SheetHeaderCloseButton';
import { SheetScaffold } from '../productsheets/SheetScaffold';
import { LBTestIDs } from '../testing/LBTestIDs';
import type { ReferenceUITheme } from '../theme';
import type { LBInfoTabState, LBInfoPanelTab } from 'livebuy-react-native-ui';
import { LBInfoPanelTab as InfoPanelTab } from 'livebuy-react-native-ui';

// MARK: - Decorative design tokens (literal minimal hex)
//
// accent / text / background come from the resolved [ReferenceUITheme]. These
// are FIXED decorative colors lifted verbatim from the design `screens.jsx`
// `theme.surface.*` (dim text / hairline strokes) — design-literal, not
// theme-resolved. They mirror the iOS / Android / Flutter static colors.

/** `theme.surface.textDim` (secondary / caption text). */
const TEXT_DIM = '#6B6775';
/** A further-dimmed disabled affordance color (`textFaint`). */
const TEXT_FAINT = '#B6B2BE';
/** `theme.surface.stroke` (hairline divider). */
const STROKE = '#ECEAF0';
/** `theme.surface.strokeStrong` (grab handle / stronger hairline). */
const STROKE_STRONG = '#D8D5DE';
/** `theme.surface.bgSunken` (#F4F4F6) — ghost footer-button fill (design `LBPButton`). */
const BG_SUNKEN = '#F4F4F6';
/** Logo monogram chip gradient endpoints (deterministic placeholder swatch). */
const MONOGRAM_BG = '#EBA279'; // mid of #FFD7A8 → #E27D5A (deterministic solid)

// MARK: - Fixed localized copy (static presentation strings — parity to iOS/Android/Flutter)

const PANEL_TITLE = '點播間說明';
/** `isLiveBroadcast === true` panel title (design R32). */
const LIVE_PANEL_TITLE = '直播間說明';
const INFO_TAB_TITLE = '影片詳情';
/** `isLiveBroadcast === true` info-tab label (design R32). */
const LIVE_INFO_TAB_TITLE = '直播詳情';
const NOTICE_TAB_TITLE = '公告';
const SYSTEM_NOTICE_LABEL = '系統公告';
const MALL_NOTICE_LABEL = '商城公告';
const SUBSCRIBE_LABEL = '訂閱通知';
const SUBSCRIBED_LABEL = '已訂閱';
const SHOP_SUBLINE_PREFIX = '這裡是 ';
const NOTICE_EMPTY_PLACEHOLDER = '目前沒有公告';
const CONTACT_LABEL = '與商家一對一對話';
/** Deterministic Text glyph for the footer CTA (RN convention — parity with the
 *  NotifyRestock 🖼 glyph; the structural snapshot captures the string). */
const GLYPH_CONTACT = '💬';
/** `isLiveBroadcast === true` "直播中" badge (design R32) — fixed red, not theme-derived
 *  (matches the LIVE tag color used elsewhere, e.g. `LiveOverlayChromeView`'s pinned-card tag). */
const LIVE_BADGE_BG = '#F03246';
const LIVE_BADGE_LABEL = '直播中';

/**
 * Up-to-3-char monogram from the shop name (deterministic, pure). Mirrors iOS /
 * Android / Flutter `monogram`.
 */
function monogram(shopName: string): string {
  const trimmed = shopName.trim();
  if (trimmed.length === 0) return 'LB';
  return trimmed.slice(0, Math.min(3, trimmed.length)).toUpperCase();
}

/**
 * The SHOP-LOGO OVERLAY GATE — the single predicate deciding whether the shop row draws a
 * real remote logo over its monogram chip (rn-videoinfo-shop-logo-real-image-refui).
 *
 * ⚠️ `live` here is the LIVE-RUNTIME **IMAGE GATE**, NOT the LIVE broadcast state
 * (`isLive`). Same word, different concept — the name is verbatim from
 * `RemoteImageProps.live` / `PlayerHeaderBarProps.live` / `PlayerShellViewProps.live`, and
 * cross-surface consistency there beats local readability. `VideoInfoPanel` has no
 * `isLive` notion, so there is no collision inside this file.
 *
 * Degradation ladder (parity: iOS `VideoInfoPanelView.resolvedShopLogoURL(live:urlString:)`):
 *   1. `live === false`                      → `undefined` (demo / snapshot never hit the network)
 *   2. missing / non-string / blank after trim → `undefined` (no logo → the chip IS the final pixel)
 *   3. otherwise                              → the TRIMMED url string
 *
 * ⚠️ THE RETURN TYPE IS LOAD-BEARING. Returning `boolean` would force the caller to redo the
 * trim before handing a uri to `RemoteImage` — and that second copy of the string handling is
 * exactly the divergence this function exists to make unrepresentable. The shop row MUST
 * express its overlay condition AS this return value and MUST NOT re-derive an equivalent
 * check (`live && shopLogo !== ''`) at the draw site: the moment the decision and the drawing
 * are implemented separately they drift, and the unit tests below stop saying anything at all
 * about what is actually painted. Same discipline as `resolvedProductPhoto` /
 * `resolvedPriceDisplay`（來源有效性與所繪項目同述詞）.
 */
export function resolveShopLogoUri(
  live: boolean,
  urlString: string | undefined,
): string | undefined {
  if (!live) return undefined;
  if (typeof urlString !== 'string') return undefined;
  const trimmed = urlString.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/** Props for {@link VideoInfoPanel} (SUB-VIEW INPUT PATTERN). */
export interface VideoInfoPanelProps {
  /** Resolved reference-ui theme (FIRST, always). */
  readonly theme: ReferenceUITheme;
  /**
   * Info-tab field snapshot (`infoTabState` — `LBInfoTabState`). On RN this
   * bundles `isSubscribed`, but the subscribe affordance reads the SEPARATE
   * {@link isSubscribed} arg (single header truth) for parity with the other
   * platforms.
   */
  readonly fields: LBInfoTabState;
  /** Subscribe-badge state (single header truth) — bound to the subscribe pill. */
  readonly isSubscribed: boolean;
  /** Currently selected tab (`activeInfoTab`). */
  readonly activeTab: LBInfoPanelTab;
  /** Whether the 公告 (notice) tab is selectable (`noticeTabState.canOpen`). */
  readonly noticeCanOpen: boolean;
  /** System-notice text (`noticeTabState.systemNotice`, textDim 段). */
  readonly systemNotice: string;
  /** Shop / video notice text (`noticeTabState.notice`, accent 段). */
  readonly notice: string;
  /**
   * Host-wired tab-switch intent (the shell forwards `model.selectInfoTab`).
   * Omitted for demo / snapshot instances — the panel renders action-free.
   */
  readonly onSelectTab?: (tab: LBInfoPanelTab) => void;
  /**
   * Footer「前往商城首頁」(former PRIMARY CTA) intent. RETAINED on the props for
   * SOURCE COMPATIBILITY (I6 backward-compat discipline, `docs/contract-governance.md`) —
   * a host that already passes this callback keeps compiling / type-checking unchanged.
   * `docs/contract-governance.md`'s 情境F (full deprecate-then-remove-next-major flow) governs
   * REMOVING a public parameter from the signature; this change does NOT do that — it only
   * removes the PIXEL (the button itself, a presentation-layer decision, not a public-API
   * break) while leaving the parameter itself untouched, so 情境F does not apply here. The
   * PRIMARY「前往商城首頁」button itself is REMOVED (design R32, user-decided,
   * `rb-rn-live-replay-more-menu-and-video-info-live-copy`) — this callback is **NO LONGER
   * CONSUMED** by anything in this component (there is nothing left to wire it to). MUST NOT be
   * removed from this interface without going through 情境F (it is now genuinely unused, but
   * removing the parameter itself IS the kind of change that flow governs).
   */
  readonly onOpenStorefront?: () => void;
  /**
   * Footer「與商家一對一對話」(ghost CTA) intent. The host wires this to the existing
   * side-rail serviceLink exit (`handleRailTap(LBSideRailKind.ServiceLink)`).
   * Omitted for demo / snapshot instances — the button renders inert.
   */
  readonly onContactMerchant?: () => void;
  /**
   * Header 右上角關閉 icon tap (rb-rn-sheet-header-close-unify): the 4th legal close entry
   * alongside scrim / drag / host-badge re-tap. Host wires it to close the info panel.
   * Omitted → inert (demo / snapshot).
   */
  readonly onClose?: () => void;
  /**
   * Real shop logo over the shop-row monogram chip (`true` → host runtime loads
   * `fields.shopLogo`; `false` / omitted → the chip alone, structural snapshot byte-stable).
   *
   * ⚠️ This is the live-RUNTIME **IMAGE GATE**, NOT the LIVE broadcast state (`isLive`) —
   * semantics verbatim from `RemoteImageProps.live` / `PlayerHeaderBarProps.live`. The
   * container feeds it from the SAME expression as the header call site (`live={live}`) so
   * both surfaces decide identically for the same logo; deriving it separately would
   * eventually show a real logo up top while the panel still shows letters.
   *
   * Defaulting to `false` keeps every existing call site / demo / snapshot construction
   * source-compatible, keeps those paths off the network, and makes「不確定就別載圖」the
   * safe default. Read-only.
   */
  readonly live?: boolean;

  /**
   * Whether this video is a genuine live broadcast right now (design R32, `PlayerShellModel
   * .isLive`, `liveStatus == 1`) — `true` swaps the panel title「點播間說明」→「直播間說明」,
   * the info-tab label「影片詳情」→「直播詳情」, and prefixes the `publishAt` line with a red
   * "直播中" badge (see {@link InfoContent}). **Default `false`** (existing VOD copy,
   * byte-identical to before this prop existed).
   *
   * ⚠️ DELIBERATELY named `isLiveBroadcast`, NOT `live` / `isLive` — this panel already has a
   * `live` prop above ({@link live}) whose semantics are a completely different concept: the
   * LIVE-RUNTIME **IMAGE-LOADING GATE** (`RemoteImageProps.live` / `PlayerHeaderBarProps.live`
   * — whether `RemoteImage` may hit the network for the shop logo). Naming this new flag `live`
   * would create two same-named, differently-meaning concepts in the SAME file. `isLive` alone
   * would also risk future confusion with `PlayerShellModel.isLive` itself (this component has
   * no such getter, but a reader skimming call sites could conflate the two). `isLiveBroadcast`
   * reads unambiguously as "is this a live broadcast" with no collision risk.
   *
   * The container `PlayerShellView.tsx` SHALL feed `model.isLive` (narrow `liveStatus == 1`
   * semantics), NOT the broader `usesLiveChrome` (`isLive || isFinishedLiveReplay`) concept
   * used elsewhere in this package — a finished replay is no longer "直播中", so the badge
   * correctly stays off for it.
   */
  readonly isLiveBroadcast?: boolean;

  /**
   * The panel's cap height, a fraction of screen height, forwarded VERBATIM to
   * `SheetScaffold`'s `capPct` (rb-rn-sheetkit-resize-dismiss-unify — fed by the shared
   * `BottomSheetPresenter` drag gesture). `undefined` (demo / snapshot, or ANY presentation
   * the user has not yet dragged the handle on — the floor measurement alone never reports)
   * → `SheetScaffold` falls back to its own content-sized 0.5 default, unchanged from before
   * this prop existed, and keeps tracking actual content changes (tab switches, …).
   */
  readonly heightPct?: number;

  /**
   * Whether the shop row's subscribe pill (訂閱通知 / 已訂閱) mounts at all
   * (rb-rn-subscribe-favorite-visibility-toggle — this is the SECOND render point of the same
   * subscribe feature; the FIRST is the header avatar's badge, `PlayerHeaderBarProps
   * .showSubscribe`). Presentation-only here — this pill carries no `onPress` of its own (see
   * {@link SubscribePill}'s doc comment), so this flag only decides whether it is drawn, there
   * is no tap behaviour to preserve.
   *
   * **Default `true`** — DELIBERATELY the OPPOSITE polarity of the header badge's leaf default
   * (`false`). This is the same "RN-specific baseline-protection polarity" already used for
   * `ProductDetailSheetView`'s `showsProductIntro` / `showsRecommendations`: this component's
   * OWN existing test suite (`VideoInfoPanel.test.tsx` / `VideoInfoPanelShopLogo.test.tsx`)
   * constructs `<VideoInfoPanel>` directly, WITHOUT this prop, and expects the pill to be
   * drawn — so this leaf keeps that expectation true by default. The container
   * (`PlayerShellView`'s single `<VideoInfoPanel>` construction site) is the ONE place that
   * resolves the actual PRODUCTION default: it forwards `showSubscribe ?? false` (not a raw
   * passthrough) so an omitted `LivebuyPlayerConfig.showSubscribe` hides BOTH render points
   * consistently, matching the header badge and the user's request that the whole subscribe
   * feature defaults to hidden. A host that explicitly sets `showSubscribe: true` sees both.
   */
  readonly showSubscribe?: boolean;
}

/**
 * The family-1 bottom-sheet info/notice panel. Renders a two-tab panel: an
 * always-available 影片詳情 (info) tab and a 公告 (notice) tab that is rendered ONLY
 * when `noticeCanOpen` is true — collapsing to a single tab when it is false
 * (rb-rn-notice-tab-hide-when-empty).
 */
export function VideoInfoPanel(props: VideoInfoPanelProps): ReactElement {
  const {
    theme,
    fields,
    isSubscribed,
    activeTab,
    noticeCanOpen,
    systemNotice,
    notice,
    onSelectTab,
    onContactMerchant,
    onClose,
    live = false,
    isLiveBroadcast = false,
    heightPct,
    showSubscribe = true,
  } = props;

  // Top-rounded sheet shell via the shared SheetScaffold (pinned grab handle + title +
  // tab bar / scrollable tab content / pinned footer CTAs + ½-screen cap,
  // rb-rn-sheet-pinned-header-footer). Shadows are host-owned; reference-ui keeps this
  // deterministic.
  const header = (
    <View>
      {/* Grab handle (LBPBottomSheet handle). */}
      <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
        <View
          style={{ width: 36, height: 4, borderRadius: 99, backgroundColor: STROKE_STRONG }}
        />
      </View>

      {/* Sheet header (LBPSheetHeader — centered title + 右上角共用關閉鈕，rb-rn-sheet-header-close-unify):
          close 疊右上、標題保留置中，是第四個合法關閉入口。onClose 省略 → inert。 */}
      <View
        style={{
          justifyContent: 'center',
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 14,
        }}
      >
        <Text
          style={{
            color: theme.text,
            fontSize: 15 * theme.fontScale,
            fontWeight: 'bold',
            textAlign: 'center',
          }}
        >
          {isLiveBroadcast ? LIVE_PANEL_TITLE : PANEL_TITLE}
        </Text>
        <View style={{ position: 'absolute', right: 12, top: 8 }}>
          <SheetHeaderCloseButton theme={theme} onPress={onClose} />
        </View>
      </View>

      {/* Tab bar (active = accent + 2pt underline). The 公告 tab item — and the 24px
          spacer before it — is only constructed when `noticeCanOpen` is true; when
          false, NEITHER node is rendered at all (not a disabled affordance), so the
          tab bar collapses to a single 影片詳情 tab (rb-rn-notice-tab-hide-when-empty). */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 18 }}>
        <Tab
          theme={theme}
          tab={InfoPanelTab.Info}
          title={isLiveBroadcast ? LIVE_INFO_TAB_TITLE : INFO_TAB_TITLE}
          active={activeTab === InfoPanelTab.Info}
          onSelectTab={onSelectTab}
          testID={LBTestIDs.infoTabDetail}
        />
        {noticeCanOpen ? (
          <>
            <View style={{ width: 24 }} />
            <Tab
              theme={theme}
              tab={InfoPanelTab.Notice}
              title={NOTICE_TAB_TITLE}
              active={activeTab === InfoPanelTab.Notice}
              onSelectTab={onSelectTab}
              testID={LBTestIDs.infoTabNotice}
            />
          </>
        ) : null}
      </View>

      {/* Hairline divider under the tab row. */}
      <View style={{ height: 1, backgroundColor: STROKE }} />
    </View>
  );

  // Defensive fallback (rb-rn-notice-tab-hide-when-empty): activeTab === Notice but
  // noticeCanOpen === false is never produced by the normal DefaultPlayerTemplate.selectInfoTab
  // path (a no-op when the tab can't open), but this component is a public function
  // component any caller can construct with an arbitrary prop combination — so the content
  // area falls back to InfoContent rather than showing the notice-tab empty placeholder
  // for a tab that no longer exists in the tab bar.
  const body =
    activeTab === InfoPanelTab.Info || !noticeCanOpen ? (
      <InfoContent
        theme={theme}
        fields={fields}
        isSubscribed={isSubscribed}
        live={live}
        isLiveBroadcast={isLiveBroadcast}
        showSubscribe={showSubscribe}
      />
    ) : (
      <NoticeContent theme={theme} systemNotice={systemNotice} notice={notice} />
    );

  // Footer CTA — pinned below the tab content on BOTH tabs (design `VideoInfoSheet`,
  // parity to iOS / Android footer). rb-rn-live-replay-more-menu-and-video-info-live-copy
  // (design R32): the PRIMARY「前往商城首頁」button is REMOVED (user-decided removal, see
  // proposal.md) — only the GHOST「與商家一對一對話」remains.
  const footer = <Footer theme={theme} onContactMerchant={onContactMerchant} />;

  // Panel root tagged by forwarding `testID` onto the shared SheetScaffold root (inert; no
  // wrapper node, so the structural snapshot stays a pure testID add — rb-rn-e2e-test-ids).
  // `heightPct` 轉發給 `capPct`（rb-rn-sheetkit-resize-dismiss-unify）——省略時落回既有內容自適應 0.5。
  return (
    <SheetScaffold
      testID={LBTestIDs.infoPanel}
      theme={theme}
      header={header}
      body={body}
      footer={footer}
      capPct={heightPct}
    />
  );
}

// MARK: - Footer CTA (VideoInfoSheet bottom button — present on BOTH tabs)
//
// The single bottom action button the design pins below the tab content regardless of
// tab (`screens.jsx` `VideoInfoSheet`): a ghost「與商家一對一對話」. Full-width, padding
// 0 18 18. Forwards its host-wired intent and is still drawn (inert) when omitted. Glyph is a
// deterministic Text (RN convention — parity with NotifyRestock's 🖼 glyph; the structural
// snapshot captures the string).
//
// rb-rn-live-replay-more-menu-and-video-info-live-copy (design R32): the design PREVIOUSLY also
// drew a PRIMARY「前往商城首頁」button above this one (house glyph + accent fill). Its PIXEL is
// REMOVED — a user-decided removal (2026-09-03, see `design/contract/claude-design-sync.md`
// R32): the button was verified as already implemented on all four platforms with a matching
// normative spec Requirement/Scenario each, the same class of "R8 移除守門" orphan trap as any
// upstream-removed symbol, and the user chose to follow the design's removal anyway (a
// per-instance exception, not a change to the R8 principle itself).
//
// The `onOpenStorefront` PROP ITSELF IS NOT REMOVED — see `VideoInfoPanelProps
// .onOpenStorefront`'s doc comment. Removing the button is a presentation-layer decision
// (`docs/contract-governance.md`'s 情境F full deprecate-flow governs removing a PUBLIC
// PARAMETER, not a rendered pixel), so this `Footer` simply no longer accepts / forwards that
// callback — a host that already passes it keeps compiling, the callback is just never invoked
// by anything in this component any more. iOS / Android / Flutter's equivalent buttons and
// specs are UNCHANGED by this — each platform has its own independent change.

function Footer(props: {
  theme: ReferenceUITheme;
  onContactMerchant?: () => void;
}): ReactElement {
  const { theme, onContactMerchant } = props;
  return (
    <View style={{ paddingHorizontal: 18, paddingBottom: 18, paddingTop: 4 }}>
      <FooterButton
        theme={theme}
        glyph={GLYPH_CONTACT}
        label={CONTACT_LABEL}
        primary={false}
        onPress={onContactMerchant}
        testID={LBTestIDs.infoFooterContact}
      />
    </View>
  );
}

/**
 * One full-width footer button mirroring the design `LBPButton` (radius 12, 14
 * vertical padding, 15 * fontScale / bold label, glyph + label, gap 8). Primary =
 * accent fill + white; ghost = {@link BG_SUNKEN} fill + theme text. Renders correctly
 * (and inert) when `onPress` is omitted.
 */
function FooterButton(props: {
  theme: ReferenceUITheme;
  glyph: string;
  label: string;
  primary: boolean;
  onPress?: () => void;
  testID?: string;
}): ReactElement {
  const { theme, glyph, label, primary, onPress, testID } = props;
  const bg = primary ? theme.accent : BG_SUNKEN;
  const fg = primary ? '#FFFFFF' : theme.text;
  const containerStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 12,
    backgroundColor: bg,
    paddingVertical: 14,
  };
  const content = (
    <>
      <Text style={{ color: fg, fontSize: 16, marginRight: 8 }}>{glyph}</Text>
      <Text style={{ color: fg, fontSize: 15 * theme.fontScale, fontWeight: 'bold' }}>
        {label}
      </Text>
    </>
  );
  // When no intent is wired (e.g. the inert 前往商城首頁 CTA, or demo / snapshot
  // instances), render a non-interactive View — the button still draws for design
  // fidelity but is truly inert (parity to Android `clickableNoIndication(action != null)`).
  if (onPress == null) {
    return <View testID={testID} style={containerStyle}>{content}</View>;
  }
  return (
    <Pressable testID={testID} onPress={onPress} style={containerStyle}>
      {content}
    </Pressable>
  );
}

// MARK: - Tab bar item
//
// One tab label. Both call sites now only ever construct a tab that is meant to be
// rendered (the 公告 tab item is conditionally NOT constructed at all when
// `noticeCanOpen === false` — see `tabBar` above), so this is unconditionally the
// enabled / tappable presentation (rb-rn-notice-tab-hide-when-empty collapsed the
// former disabled-affordance branch: dimmed label / 「· 無」suffix / no-Pressable
// no-op tap — dead code once the un-openable 公告 tab is never constructed).

function Tab(props: {
  theme: ReferenceUITheme;
  tab: LBInfoPanelTab;
  title: string;
  active: boolean;
  onSelectTab?: (tab: LBInfoPanelTab) => void;
  testID?: string;
}): ReactElement {
  const { theme, tab, title, active, onSelectTab, testID } = props;
  const underline = active ? theme.accent : 'transparent';
  const labelColor = active ? theme.accent : TEXT_DIM;

  const label = (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 4, paddingBottom: 10 }}
      >
        <Text style={{ color: labelColor, fontSize: 13 * theme.fontScale, fontWeight: 'bold' }}>
          {title}
        </Text>
      </View>
      {/* 2pt accent underline under the active tab. */}
      <View style={{ height: 2, width: 28, backgroundColor: underline }} />
    </View>
  );

  return (
    <Pressable testID={testID} onPress={() => onSelectTab?.(tab)} accessibilityRole="tab">
      {label}
    </Pressable>
  );
}

// MARK: - Info tab content (VideoInfoSheet body)

function InfoContent(props: {
  theme: ReferenceUITheme;
  fields: LBInfoTabState;
  isSubscribed: boolean;
  /** Shop-logo image gate — forwarded verbatim to {@link ShopRow}; NO decision is made here. */
  live: boolean;
  /** Live-broadcast copy flag (design R32) — see {@link VideoInfoPanelProps.isLiveBroadcast}.
   *  `true` prefixes the `publishAt` line with a red "直播中" badge + "｜" separator; `false`
   *  (default) keeps the existing single-line `publishAt` text, byte-identical. */
  isLiveBroadcast: boolean;
  /** Subscribe-pill visibility — forwarded verbatim to {@link ShopRow}; NO decision is made
   *  here (the ONE default lives on {@link VideoInfoPanelProps.showSubscribe}). */
  showSubscribe: boolean;
}): ReactElement {
  const { theme, fields, isSubscribed, live, isLiveBroadcast, showSubscribe } = props;
  const { publishAt, title, shopIntro } = fields;

  return (
    <View
      style={{ paddingLeft: 18, paddingRight: 18, paddingTop: 14, paddingBottom: 18 }}
    >
      {/* publishAt — small dim caption, OR (design R32, isLiveBroadcast) a red "直播中" badge +
          "｜" separator + the SAME publishAt text (date data source unchanged, never a literal
          string — only the leading label/badge differs). */}
      {publishAt.length > 0 ? (
        isLiveBroadcast ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: 4,
                backgroundColor: LIVE_BADGE_BG,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 10 * theme.fontScale, fontWeight: '800' }}>
                {LIVE_BADGE_LABEL}
              </Text>
            </View>
            <View style={{ width: 8 }} />
            <Text style={{ color: TEXT_DIM, fontSize: 12 * theme.fontScale }}>{'|'}</Text>
            <View style={{ width: 8 }} />
            <Text style={{ color: TEXT_DIM, fontSize: 12 * theme.fontScale }}>{publishAt}</Text>
          </View>
        ) : (
          <Text style={{ color: TEXT_DIM, fontSize: 12 * theme.fontScale }}>{publishAt}</Text>
        )
      ) : null}
      {/* title — primary heading. */}
      {title.length > 0 ? (
        <Text
          style={{
            color: theme.text,
            fontSize: 17 * theme.fontScale,
            fontWeight: 'bold',
            marginTop: 6,
          }}
        >
          {title}
        </Text>
      ) : null}
      {/* shopIntro — dim body copy. */}
      {shopIntro.length > 0 ? (
        <Text
          style={{ color: TEXT_DIM, fontSize: 13 * theme.fontScale, lineHeight: 13 * theme.fontScale * 1.5, marginTop: 6 }}
        >
          {shopIntro}
        </Text>
      ) : null}
      {/* hairline divider. */}
      <View style={{ height: 1, backgroundColor: STROKE, marginVertical: 18 }} />
      <ShopRow
        theme={theme}
        fields={fields}
        isSubscribed={isSubscribed}
        live={live}
        showSubscribe={showSubscribe}
      />
    </View>
  );
}

// MARK: - Shop row
//
// Circular logo (monogram chip floor + `live`-gated real image on top) + shopName +
// 「這裡是 …」 subline + subscribe affordance bound to `isSubscribed`.

function ShopRow(props: {
  theme: ReferenceUITheme;
  fields: LBInfoTabState;
  isSubscribed: boolean;
  /** Shop-logo image gate (live RUNTIME, not `isLive`) — see {@link resolveShopLogoUri}. */
  live: boolean;
  /** Whether {@link SubscribePill} mounts at all (rb-rn-subscribe-favorite-visibility-toggle).
   *  NO decision is made here — the ONE default lives on
   *  {@link VideoInfoPanelProps.showSubscribe}. */
  showSubscribe: boolean;
}): ReactElement {
  const { theme, fields, isSubscribed, live, showSubscribe } = props;
  const { shopName } = fields;
  // THE single overlay predicate. The JSX below expresses its condition AS this value —
  // it MUST NOT re-check `live` or re-inspect `fields.shopLogo` at the draw site, or the
  // pure-function tests would stop guaranteeing anything about what is painted.
  const logoUri = resolveShopLogoUri(live, fields.shopLogo);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {/* Logo chip: the deterministic monogram swatch is the ALWAYS-DRAWN FLOOR (it absorbs
          the loading AND failure states), with the real shop logo overlaid at runtime.
          `live === false` (demo / snapshot — the default) → RemoteImage renders null → the
          structural tree keeps ZERO `<Image>` nodes and the baseline is byte-identical
          (parity: PlayerHeaderBarView.renderAvatar, iOS videoinfo-shop-logo-real-image-refui). */}
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: MONOGRAM_BG,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 12 * theme.fontScale, fontWeight: 'bold' }}>
          {monogram(shopName)}
        </Text>
        {/* `resizeMode` is deliberately OMITTED so it takes RemoteImage's 'cover' default —
            verbatim with the header avatar call, and the fill semantics (iOS
            `.scaleAspectFill`) that keep a non-square mark from leaving gaps inside the
            circle. `borderRadius` matches the chip's so the image clips to the same circle
            without touching the chip's own style object. */}
        {logoUri != null ? (
          <RemoteImage live={live} uri={logoUri} borderRadius={22} />
        ) : null}
      </View>
      <View style={{ width: 12 }} />
      <View style={{ flex: 1 }}>
        {shopName.length > 0 ? (
          <>
            <Text
              style={{ color: theme.text, fontSize: 14 * theme.fontScale, fontWeight: '600' }}
            >
              {shopName}
            </Text>
            <View style={{ height: 2 }} />
            <Text style={{ color: TEXT_DIM, fontSize: 12 * theme.fontScale }}>
              {`${SHOP_SUBLINE_PREFIX}${shopName}`}
            </Text>
          </>
        ) : null}
      </View>
      <View style={{ width: 12 }} />
      {/* rb-rn-subscribe-favorite-visibility-toggle: `showSubscribe` (DEFAULT true at THIS
          leaf — see the doc comment on `VideoInfoPanelProps.showSubscribe` for why the
          polarity differs from the header badge) gates whether this node mounts at all. When
          off, it is simply not built — no placeholder, no substitute copy; the row's other
          content (logo / shop name / subline) is unaffected. */}
      {showSubscribe ? <SubscribePill theme={theme} isSubscribed={isSubscribed} /> : null}
    </View>
  );
}

// MARK: - Subscribe pill
//
// Outlined accent pill; the label reflects `isSubscribed` (already-subscribed vs
// subscribe). Presentation only — the actual subscribe action is host-wired
// through core, not owned here. Its OWN visibility is gated one level up by
// `ShopRow`'s `showSubscribe` (rb-rn-subscribe-favorite-visibility-toggle) — this
// component itself has no opinion on whether it is drawn.

function SubscribePill(props: {
  theme: ReferenceUITheme;
  isSubscribed: boolean;
}): ReactElement {
  const { theme, isSubscribed } = props;
  const labelColor = isSubscribed ? TEXT_DIM : theme.accent;
  const borderColor = isSubscribed ? STROKE_STRONG : theme.accent;
  return (
    <View
      style={{
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1,
        borderColor,
      }}
    >
      <Text style={{ color: labelColor, fontSize: 13 * theme.fontScale, fontWeight: 'bold' }}>
        {isSubscribed ? SUBSCRIBED_LABEL : SUBSCRIBE_LABEL}
      </Text>
    </View>
  );
}

// MARK: - Notice tab content (公告) — RECONCILED in-panel two-段 rendering

function NoticeContent(props: {
  theme: ReferenceUITheme;
  systemNotice: string;
  notice: string;
}): ReactElement {
  const { theme, systemNotice, notice } = props;
  const hasNoticeText = systemNotice.length > 0 || notice.length > 0;
  const showDivider = systemNotice.length > 0 && notice.length > 0;

  return (
    <View
      style={{ paddingLeft: 18, paddingRight: 18, paddingTop: 16, paddingBottom: 18 }}
    >
      {hasNoticeText ? (
        <>
          {/* 系統公告 — faint dot + textDim heading. */}
          {systemNotice.length > 0 ? (
            <AnnounceBlock
              theme={theme}
              label={SYSTEM_NOTICE_LABEL}
              labelColor={TEXT_DIM}
              dotColor={TEXT_FAINT}
              text={systemNotice}
            />
          ) : null}
          {/* Hairline divider only when BOTH sections are present. */}
          {showDivider ? (
            <View style={{ height: 1, backgroundColor: STROKE, marginVertical: 18 }} />
          ) : null}
          {/* 商城公告 — accent dot + accent heading. */}
          {notice.length > 0 ? (
            <AnnounceBlock
              theme={theme}
              label={MALL_NOTICE_LABEL}
              labelColor={theme.accent}
              dotColor={theme.accent}
              text={notice}
            />
          ) : null}
        </>
      ) : (
        // Disabled / empty affordance — dim placeholder copy.
        <Text style={{ color: TEXT_FAINT, fontSize: 13 * theme.fontScale }}>
          {NOTICE_EMPTY_PLACEHOLDER}
        </Text>
      )}
    </View>
  );
}

// MARK: - Announcement block
//
// A dot + heading (系統 vs 商城 differ by color) then the body text (always
// `theme.text`). Mirrors the design's `announceBlock`.

function AnnounceBlock(props: {
  theme: ReferenceUITheme;
  label: string;
  labelColor: string;
  dotColor: string;
  text: string;
}): ReactElement {
  const { theme, label, labelColor, dotColor, text } = props;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor }}
        />
        <View style={{ width: 8 }} />
        <Text style={{ color: labelColor, fontSize: 13 * theme.fontScale, fontWeight: 'bold' }}>
          {label}
        </Text>
      </View>
      <View style={{ height: 10 }} />
      <Text
        style={{ color: theme.text, fontSize: 13 * theme.fontScale, lineHeight: 13 * theme.fontScale * 1.55 }}
      >
        {text}
      </Text>
    </View>
  );
}
