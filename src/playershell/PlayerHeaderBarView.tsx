// PlayerHeaderBar — family-1 surface 1 (top-bar chrome) — RN .tsx.
//
// Spec: `reference-ui-rendering/spec.md` (family-1 player-shell, surface 1).
// Phase-4 RN parity of the DONE iOS `PlayerHeaderBarView.swift`
// (rb-ios-player-shell D-2 #1), Android `PlayerHeaderBar.kt`
// (rb-android-player-shell), and Flutter `player_header_bar_view.dart`
// (rb-flutter-player-shell) — translated 1:1 to RN.
//
//   Mirrors design `LBPTopBar` / `LBPHostBadge` (sdk-components.jsx): a pinned top
//   bar with a glassy host pill (avatar + title + host name + LIVE pill + viewer
//   count + subscribe affordance) on the leading edge, and a SINGLE round glass
//   minimize button on the trailing edge. The bar itself paints NO background
//   (rb-rn-live-chrome-gradient-removal — the design's top-down scrim is removed,
//   not approximated). info / share live in the side rail; mute is the tap-to-mute
//   gesture on the video area — none of them is a header control.
//
// SUB-VIEW INPUT PATTERN (the contract documented in `PlayerShellView.tsx`):
//   1. `theme` (ReferenceUITheme)   — FIRST, always.
//   2. its bound SNAPSHOT VALUES (title / hostName / shopLogo / viewerCount /
//      isSubscribed), passed BY VALUE from PlayerShellModel — never the model,
//      never the template. (The header no longer binds `muted` / `shareUrl`:
//      mute is the tap-to-mute gesture, share lives in the side rail.)
//   3. optional action callbacks, trailing, EACH defaulting to a no-op. The shell
//      owns NO action; the host wires taps to core `simulate*` (D-4).
//
// It reads ONLY its passed-in values (one-way data flow, D-1/D-4): it never
// reaches back into `PlayerShellModel` / `DefaultPlayerTemplate`, holds NO second
// copy of state, and renders correctly with EVERY callback omitted (so the
// demo / structural snapshot tests construct it action-free).
//
// RENDER DISCIPLINE (iOS / Android / Flutter lessons baked in): plain
// `View` / `Text` / `Pressable` only — NO ScrollView / FlatList / SectionList,
// NO network-uri Image, NO random state. The LIVE-pill dot is drawn
// static; the avatar paints a deterministic monogram placeholder (first letter of
// host name, accent-tinted, over white) so the structural baseline is stable. The
// `shopLogo` URL is retained on the snapshot for host-supplied wiring.
//   ⚠️ ONE SCOPED ANIMATION EXCEPTION (rb-rn-marquee-title-scroll): the title slot
//   (`MarqueeTitleView.tsx`) runs an `Animated.loop` when the title overflows AND the
//   merchant allows scrolling — the design's `LBPMarqueeText` behaviour, which this header
//   previously did not implement at all. Written in the same NARROWLY-SCOPED form this module
//   already uses for such carve-outs (`moments/StartScreenView.tsx`'s「NO-ANIMATION RULE
//   EXCEPTION (`.loading` ONLY)」— note that one is a `setInterval`-driven PNG sequence, NOT
//   `Animated`, so it is a precedent for the FORM of the exception, not for the mechanism):
//   it is limited to THAT ONE slot, and every other constraint above (no ScrollView/FlatList,
//   no network-uri Image, no randomness, no animation anywhere else in this file) is UNCHANGED.
//   The structural baseline STAYS deterministic: under the in-package `react-native` mock
//   `onLayout` never fires on its own, so both measurements read 0, the overflow gate is
//   false, and the header snapshots render the plain static branch. A test that wants the
//   marquee branch drives `onLayout` by hand (see `MarqueeTitle.test.tsx`).
//
// jsx automatic runtime — no `import React`. Returns `ReactElement` (NOT
// JSX.Element, which is absent under @types/react 19).

import type { ReactElement } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '../TightText';

import type { ReferenceUITheme } from '../theme';
import { RemoteImage } from '../productsheets/RemoteImage';
import { LBTestIDs } from '../testing/LBTestIDs';
import { MarqueeTitle } from './MarqueeTitleView';
import { SpeakerSlashGlyph, SpeakerWaveGlyph } from './SpeakerGlyphs';

// MARK: - Decorative design tokens (literal hex from live-chrome.jsx)
//
// FIXED decorative colors from the design (glass pill / on-glass white text).
// These are deliberately literal — they are NOT the theme accent / text /
// background, which feed the LIVE pill + subscribe badge (pulled from `theme`).

/** Glass fill `rgba(20,20,24,0.55)` (host pill, live-chrome.jsx). */
const PILL_GLASS = 'rgba(20,20,24,0.55)';
/** Glass fill `rgba(20,20,24,0.45)` (round icon buttons, live-chrome.jsx). */
const ICON_GLASS = 'rgba(20,20,24,0.45)';
/** On-glass primary text — white. */
const ON_GLASS = '#FFFFFF';
/** On-glass secondary text `rgba(255,255,255,0.85)`. */
const ON_GLASS_DIM = 'rgba(255,255,255,0.85)';

/** Props for the family-1 top-bar chrome (SUB-VIEW INPUT PATTERN). */
export interface PlayerHeaderBarProps {
  // -- 1. theme (FIRST, always) ----------------------------------------------
  /** The resolved reference-ui theme. */
  readonly theme: ReferenceUITheme;

  // -- 2. bound snapshot values (BY VALUE from PlayerShellModel) --------------
  /** Host-pill title (`playerHeaderState.title`). */
  readonly title: string;
  /** Host / shop name (`playerHeaderState.hostName`). */
  readonly hostName: string;
  /** Host-pill / top-bar logo URL (`playerHeaderState.shopLogo`). Painted over the
   *  deterministic monogram floor at RUNTIME only — gated by {@link resolveShopLogoUri}
   *  on the {@link live} image flag, so the demo / snapshot path fetches nothing. */
  readonly shopLogo: string;
  /** Live viewer count (`playerHeaderState.viewerCount`). */
  readonly viewerCount: number;
  /** Subscribe affordance state (`playerHeaderState.isSubscribed`). */
  readonly isSubscribed: boolean;
  /** LIVE vs VOD flag (`playerHeaderState.isLive`, channel `liveStatus == 1`). Per design
   *  `LBPHostBadge`: the viewer count shows ⟺ `isLive`; the LIVE pill shows ⟺
   *  `isLive && !isReplay`. VOD (`isLive === false`) shows neither. */
  readonly isLive: boolean;
  /** Replay (回放) flag — a LIVE stream scrubbed behind the live edge
   *  (`DefaultPlaybackProgressState.isReplay`; `liveStatus == 1` so `isLive` STAYS true,
   *  `isReplay === true`). A by-value presentation flag fed from `PlayerShellModel.isReplay`
   *  (NOT a new view-model). Design `hideLivePill = isReplay`: replay HIDES the LIVE pill
   *  but KEEPS the viewer count. */
  readonly isReplay: boolean;
  /** Live-runtime image gate (parity with iOS/Android `live`). `true` → the avatar
   *  loads the real `shopLogo` via `RemoteImage`; `false` (demo / snapshot — DEFAULT)
   *  → monogram placeholder (no network, baseline stable). */
  readonly live?: boolean;
  /**
   * Whether the subscribe badge (+/✓ overlay on the avatar) mounts at all
   * (rb-rn-subscribe-favorite-visibility-toggle). `false` (DEFAULT — snapshot / demo / any host
   * that has not opted in) → the badge node is not built at all (not built-but-disabled); the
   * avatar's own size/layout is unaffected since the badge is an absolutely-positioned overlay.
   * `true` → the badge mounts as before, wired to {@link onToggleSubscribe}. The container
   * forwards `config.showSubscribe` verbatim (this is the ONE place the fallback is decided).
   * Orthogonal to `isSubscribed` (which state it shows) and to `onToggleSubscribe` (its tap
   * behaviour once mounted) — this flag only decides whether it is drawn.
   */
  readonly showSubscribe?: boolean;
  /**
   * Merchant capability gate for the title marquee (rb-rn-marquee-title-scroll), RAW —
   * `POST /sdk/config`'s `data.extensions.video_title_scroll` exactly as the host read it
   * (back-office setting `video_title_display`; ⚠️ the wire key and the setting are NOT the
   * same name). `extensions` is an opaque raw bag, so reference-ui never reads it itself —
   * the container forwards `config.titleScroll` verbatim and the leaf title slot
   * (`MarqueeTitleView.normalizeTitleScroll`) owns the ONE fallback.
   *
   * **Default (omitted) = may scroll** — the backend's own documented default (`1` when
   * unset), so existing callers need zero changes.
   *
   * It is ANDed with the content measurement, never a substitute for it: `titleScroll`
   * answers「MAY it scroll」, the measurement answers「is there anything TO scroll」.
   * ⚠️ `false` MUST NOT be read as「hide the title」— a disabled title still renders,
   * single-line + tail ellipsis, fully opaque, at the same height.
   */
  readonly titleScroll?: unknown;
  /**
   * Whether to hide the host pill (title / hostName / LIVE pill / viewer count / subscribe
   * badge) while keeping the trailing minimize button (rb-rn-gesture-clean-mode-rewrite, design
   * `screens.jsx` R23「乾淨模式」). `true` → the host-pill `Pressable` (and everything inside it,
   * `renderHostPill`) is not built at all; the leading slot renders as an empty flex:1 spacer so
   * the minimize button's position is unaffected. Default `false` (source-compatible) — this
   * component intentionally does NOT know about a higher-level「clean mode」concept, only that
   * its OWN host pill should be hidden (see this change's design.md Decision 3).
   */
  readonly hidesHostBadge?: boolean;
  /**
   * The CURRENT mute state (`PlayerShellModel.muted`) — selects the header mute button's glyph
   * (rb-rn-gesture-clean-mode-v2, design R29). Default `false`. Only meaningful while
   * {@link onToggleMute} is non-`undefined` (the button is not rendered otherwise, so this value
   * is otherwise unread).
   */
  readonly muted?: boolean;

  // -- 3. optional action callbacks (LAST, each defaulting to a no-op) --------
  //
  // The top-right carries a minimize affordance → onMinimize, plus (clean-mode-only) a mute
  // toggle → onToggleMute; subscribe stays on the avatar badge. The shell owns NO action; the
  // host wires taps to core `simulate*` (D-4). share / info / close are NOT header controls.

  /** Tap on the top-right minimize button → host collapses the player into the
   *  bottom-right floating preview. Omitted → drawn but inert (host-wired). */
  readonly onMinimize?: () => void;
  /** Tap on the subscribe affordance (the small badge on the avatar). */
  readonly onToggleSubscribe?: () => void;
  /**
   * Tap on the host pill → open the video info panel (parity iOS `onTapHostBadge`, which
   * replaced the removed rail「more」pill). Omitted → pill not tappable (demo / upcoming).
   */
  readonly onTapHostBadge?: () => void;
  /**
   * Clean-mode-limited mute toggle (rb-rn-gesture-clean-mode-v2, design R29) — the video-area
   * single-tap gesture retired the tap-to-mute affordance in favour of unconditionally toggling
   * `cleanMode`, so `PlayerShellView` re-surfaces the mute operation here, rendered ONLY while
   * `cleanMode === true` (`onToggleMute` forwarded as `undefined` otherwise). `undefined` → the
   * button MUST NOT render, MUST NOT occupy layout space — the existing non-clean-mode baseline
   * stays structurally unchanged. Default `undefined` (source-compatible).
   */
  readonly onToggleMute?: () => void;
}

/**
 * The family-1 top-bar chrome. Pinned to the top of the player shell; paints the
 * glassy host pill + a SINGLE round glass minimize button, over NO background
 * (rb-rn-live-chrome-gradient-removal). Top-right = a single minimize affordance
 * (design `LBPTopBar` pip; user
 * requirement「右上角只有縮小的元件」) → onMinimize. info / share live in the side
 * rail; mute is the tap-to-mute gesture on the video area.
 *
 * Follows the SUB-VIEW INPUT PATTERN: `theme` first, then the bound snapshot
 * values BY VALUE, then optional host-wired callbacks (each defaults to no-op).
 */
export function PlayerHeaderBar(props: PlayerHeaderBarProps): ReactElement {
  // The host pill consumes title / hostName / isSubscribed / viewerCount /
  // onToggleSubscribe via `props` (renderHostPill); the trailing frame wires the
  // single minimize button. Destructure only what this top-level frame wires
  // directly so the leading-vs-trailing layout stays readable.
  const { theme, onMinimize, hidesHostBadge = false, muted = false, onToggleMute } = props;

  return (
    // rb-rn-live-chrome-gradient-removal: no decorative background here (design
    // dropped the top-down scrim entirely). HStack: leading host pill flexes up
    // to the trailing minimize button (parity to iOS/Android/Flutter at fixed width).
    <View testID={LBTestIDs.playerHeader}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 10,
          paddingBottom: 14,
        }}
      >
        {/* Leading slot flexes; the glass pill inside hugs its content and the host
            name truncates so the fixed LIVE pill + viewer badge + trailing minimize
            button stay fully visible at the fixed width. */}
        {/* Whole host pill is tappable → open the info panel (parity iOS host badge). The
            subscribe badge inside keeps its own inner Pressable. `hidesHostBadge` (clean mode,
            rb-rn-gesture-clean-mode-rewrite) drops the Pressable + its content entirely, leaving
            an empty flex:1 spacer so the trailing minimize button's position is unaffected. */}
        {hidesHostBadge ? (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start' }} />
        ) : (
          <Pressable
            testID={LBTestIDs.playerHeaderHostPill}
            onPress={() => props.onTapHostBadge?.()}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start' }}
          >
            {renderHostPill(props)}
          </Pressable>
        )}
        <View style={{ width: 8 }} />
        {/* 乾淨模式限定靜音鈕（rb-rn-gesture-clean-mode-v2）：`onToggleMute` 非 `undefined`（即
            `cleanMode === true`）時才在 minimize 鈕左側多渲染這顆鈕；`undefined` 時整顆 MUST NOT
            渲染、MUST NOT 佔位（`Group`-equivalent：純條件式 JSX，不留空 spacer）。 */}
        {onToggleMute != null ? (
          <>
            {renderMuteButton(theme, muted, onToggleMute)}
            <View style={{ width: 8 }} />
          </>
        ) : null}
        {renderMinimizeButton(theme, onMinimize)}
      </View>
    </View>
  );
}

// MARK: - Host pill (LBPTopBar host pill + LBPHostBadge)

function renderHostPill(props: PlayerHeaderBarProps): ReactElement {
  const {
    theme, title, hostName, shopLogo, isSubscribed, viewerCount, onToggleSubscribe, isLive, isReplay,
    live = false,
    showSubscribe = false,
    titleScroll,
  } = props;
  return (
    // rb-rn-player-header-viewer-pill: this outer container NO LONGER paints a shared
    // `PILL_GLASS` background — only `renderViewerBadge` does (see its own `View` below).
    // Parity `LBPHostBadge` (`sdk-components.jsx:355-458`), which has NO outer background
    // container at all; its text contrast comes from `textShadow` alone. ⚠️ KNOWN GAP (not
    // fixed by this change, flagged intentionally): this file has ZERO `textShadow` style on
    // the `title` / `hostName` `Text` nodes below — unlike the design's `textShadow`, so this
    // RN tree has NO independent legibility mechanism for those two texts once this background
    // is gone. Left for a follow-up change; MUST NOT be "fixed" here by re-adding a background
    // (that would defeat the point of this change).
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 4,
        paddingRight: 12,
        paddingTop: 4,
        paddingBottom: 4,
      }}
    >
      {renderAvatar(theme, hostName, title, shopLogo, live, isSubscribed, showSubscribe, onToggleSubscribe)}
      <View style={{ width: 8 }} />
      {/* Title + (host name · LIVE · viewer) — flexible so the host name truncates. */}
      <View style={{ flexShrink: 1, flexDirection: 'column', alignItems: 'flex-start' }}>
        {/* Title slot (design `LBPMarqueeText`, rb-rn-marquee-title-scroll). Renders the very
            same static single-line `Text` this used to render inline; when the title overflows
            AND the merchant allows scrolling it ADDS an absolutely-positioned marquee overlay
            on top. The overlay is layout-inert (Yoga excludes absolute children from content
            size), so this column's negotiation with the trailing chrome is unchanged and the
            hostName / LIVE pill / viewer row below never moves. `titleScroll` travels RAW —
            the slot owns the one fallback. */}
        <MarqueeTitle
          title={title}
          color={ON_GLASS}
          fontSize={12 * theme.fontScale}
          titleScroll={titleScroll}
        />
        <View style={{ height: 2 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Host name yields room (truncates) so the fixed LIVE pill + viewer
              badge that follow stay fully visible. */}
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              color: ON_GLASS_DIM,
              fontSize: 10.5 * theme.fontScale,
              fontWeight: 'normal',
            }}
          >
            {hostName}
          </Text>
          {/* Per design `LBPHostBadge`: LIVE pill ⟺ isLive && !isReplay; viewer count
              ⟺ isLive (replay KEEPS the count, only HIDES the pill; VOD shows neither).
              The spacer folds into each gate so no dangling gap remains when hidden. */}
          {isLive && !isReplay ? (
            <>
              <View style={{ width: 6 }} />
              {renderLivePill(theme)}
            </>
          ) : null}
          {isLive ? (
            <>
              <View style={{ width: 6 }} />
              {renderViewerBadge(theme, viewerCount)}
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** First grapheme of the host name (or title) for the placeholder monogram. */
function monogramOf(hostName: string, title: string): string {
  const source = hostName.length === 0 ? title : hostName;
  return source.length === 0 ? '·' : source.slice(0, 1).toUpperCase();
}

/**
 * THE single shop-logo overlay predicate for the header avatar — `undefined` means
 *「畫不出東西」and the monogram floor stands alone. `renderAvatar` expresses its draw
 * condition AS this value; it MUST NOT re-check `live` or re-inspect `shopLogo` at the
 * draw site, or these pure-function tests would stop guaranteeing anything about what
 * is painted (rn-header-shop-logo-wiring-test-refui D1/D2).
 *
 * Deliberately IDENTICAL in name, signature and body to
 * `VideoInfoPanelView.resolveShopLogoUri` — the two surfaces paint the same shop mark
 * and share one ladder, so a future「抽共用」change is a deletion, not a rename. A named
 * equivalence test pins the two together (`PlayerHeaderBarShopLogo.test.tsx`).
 *
 * ⚠️ TWO RUNGS ONLY — there is NO「URL parse」rung, and one MUST NOT be added.
 * RN `<Image source={{ uri }}>` treats the uri as an opaque string (no JS-side parsing)
 * and `RemoteImage` never calls `new URL()`. Adding a parse rung would CHANGE what is
 * painted: a scheme-less bare string like `'BeautyTown'` currently DOES mount an Image
 * (and falls back via `onError`), whereas `new URL('BeautyTown')` throws. This is the
 * documented RN-vs-iOS divergence — iOS `URL(string:)` has a third rung with the
 * OPPOSITE outcomes on all-whitespace / padded / bare inputs (iOS design.md D3/D4).
 *
 * ⚠️ TWO-TIER GATE — this predicate does NOT replace `RemoteImage`'s own gate. The
 * primitive keeps `live` + trim-empty + the `onError` failure latch; `live` is still
 * passed through. The two tiers are synonymous and idempotent (`trim` is idempotent),
 * and the failure latch stays runtime-only — it is not a pure-function concern.
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

/** Avatar — a white-backed circle with the subscribe badge overlaid at the
 *  bottom-trailing. The design fills the circle with the shop mark. This is an
 *  OVERLAY, not an if/else: the deterministic monogram (first letter of host name,
 *  accent-tinted, over white) is the ALWAYS-DRAWN FLOOR — it absorbs the demo /
 *  snapshot path, the loading window AND the load-failure fallback — with the real
 *  `shopLogo` painted over it at runtime, gated by {@link resolveShopLogoUri}.
 *  (Parity note: iOS `PlayerHeaderBarView.avatar` uses an if/else instead, so its
 *  monogram disappears the moment the image branch is taken — RN's overlay keeps a
 *  floor in every state. See rn-header-shop-logo-wiring-test-refui D6.) */
function renderAvatar(
  theme: ReferenceUITheme,
  hostName: string,
  title: string,
  shopLogo: string,
  live: boolean,
  isSubscribed: boolean,
  showSubscribe: boolean,
  onToggleSubscribe?: () => void,
): ReactElement {
  // THE single overlay predicate — the JSX below expresses its draw condition AS this
  // value. MUST NOT re-check `live` / re-inspect `shopLogo` at the draw site.
  const logoUri = resolveShopLogoUri(live, shopLogo);
  return (
    // 28px circle + 3px room (bottom-trailing) for the badge offset.
    <View style={{ width: 28 + 3, height: 28 + 3 }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Monogram backing — shown in demo / snapshot (live === false), while the
            real logo loads, and when shopLogo is blank → fallback. */}
        <Text
          style={{
            color: theme.accent,
            fontSize: 13 * theme.fontScale,
            fontWeight: 'bold',
          }}
        >
          {monogramOf(hostName, title)}
        </Text>
        {/* Real shop logo over the white circle at runtime, gated by the single
            predicate above. `live === false` (demo / snapshot — the DEFAULT) → the
            predicate is undefined → NOTHING mounts → the structural tree keeps ZERO
            `<Image>` nodes and the baseline stays byte-identical (the package-wide
            「findAllByType('Image') === 0」discipline). Shape is verbatim with
            VideoInfoPanelView.ShopRow; `live` is still forwarded so the primitive's own
            gate (trim + onError latch) stays intact — two synonymous, idempotent tiers.
            ⚠️ Forwarding `live` is NOT redundant and MUST NOT be "simplified" away: the two
            tiers form a CONJUNCTION, so any bug in this predicate can only ever fail to draw,
            never draw when the gate is shut. That is what keeps the package-wide
            「no network Image when gated off」property safe from a surface-level mistake
            (measured: inverting this predicate reddens only the should-draw tests). */}
        {logoUri != null ? (
          <RemoteImage live={live} uri={logoUri} borderRadius={14} />
        ) : null}
      </View>
      {/* Bottom-trailing of the 28px avatar, offset out by 3px (LBPHostBadge).
          rb-rn-subscribe-favorite-visibility-toggle: `showSubscribe` (DEFAULT false) gates whether
          this node mounts at all — not built-but-disabled, simply not built. The 3px offset slot
          stays reserved either way since the badge is an absolutely-positioned overlay; removing it
          does not reflow any sibling. */}
      <View style={{ position: 'absolute', left: 28 - 16 + 3, top: 28 - 16 + 3 }}>
        {showSubscribe ? renderSubscribeBadge(theme, isSubscribed, onToggleSubscribe) : null}
      </View>
    </View>
  );
}

/** The small +/✓ subscribe badge overlaid on the avatar (LBPHostBadge).
 *  Subscribed → theme text fill + check; not subscribed → accent fill + plus.
 *  A 2px white ring (`border:2px solid #fff`) wraps the fill. */
function renderSubscribeBadge(
  theme: ReferenceUITheme,
  isSubscribed: boolean,
  onToggleSubscribe?: () => void,
): ReactElement {
  return (
    <Pressable testID={LBTestIDs.subscribeBadge} onPress={onToggleSubscribe}>
      {/* White ring (16px) around the 12px fill. */}
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: isSubscribed ? theme.text : theme.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 9 * theme.fontScale, fontWeight: 'bold' }}>
            {isSubscribed ? '✓' : '+'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/** The red LIVE pill (accent-filled) with a dot — drawn static for the structural
 *  baseline. Background uses `theme.accent` (brand action red for the LIVE badge). */
function renderLivePill(theme: ReferenceUITheme): ReactElement {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.accent,
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 1,
      }}
    >
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF' }} />
      <View style={{ width: 3 }} />
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: 9.5 * theme.fontScale,
          fontWeight: '900',
          letterSpacing: 0.5,
        }}
      >
        LIVE
      </Text>
    </View>
  );
}

/** Viewer count with a small people glyph.
 *
 *  rb-rn-player-header-viewer-pill: carries its OWN `PILL_GLASS` glass-pill background (same
 *  color token as the now-removed `renderHostPill` outer background — no new color value).
 *  Small internal padding keeps the glyph / text off the pill edge; this is purely a local
 *  detail of this view and does not affect `renderHostPill`'s outer flex-row negotiation. */
function renderViewerBadge(theme: ReferenceUITheme, viewerCount: number): ReactElement {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: PILL_GLASS,
        borderRadius: 999,
        paddingHorizontal: 6,
        paddingVertical: 2,
      }}
    >
      {/* People glyph — a deterministic Text glyph (no vector-icons dep). */}
      <Text style={{ color: ON_GLASS_DIM, fontSize: 11 * theme.fontScale }}>{'\u{1F465}'}</Text>
      <View style={{ width: 3 }} />
      <Text
        numberOfLines={1}
        style={{ color: ON_GLASS_DIM, fontSize: 10.5 * theme.fontScale, fontWeight: 'normal' }}
      >
        {formatViewerCount(viewerCount)}
      </Text>
    </View>
  );
}

// MARK: - Trailing — single minimize button (LBPTopBar pip affordance)
//
// The top-right contains ONLY a minimize control (design `LBPTopBar` pip; user
// requirement「右上角只有縮小的元件」). Tapping it collapses the player into the
// bottom-right floating preview (host-owned). info / share live in the side rail;
// mute is the tap-to-mute gesture on the video area.

function renderMinimizeButton(theme: ReferenceUITheme, onMinimize?: () => void): ReactElement {
  // ◳ = a small frame in the lower-right quadrant — the bottom-right floating
  // preview the minimize collapses into (parity to iOS SF Symbol `pip.enter`).
  return renderGlassIconButton(theme, 'minimize', '◳', onMinimize);
}

// MARK: - Clean-mode-limited mute button (rb-rn-gesture-clean-mode-v2)

/** A 36×36 round glass icon button carrying the speaker glyph (parity `renderGlassIconButton`'s
 *  visual size/style), rendered ONLY while the caller passes a non-`undefined` `onToggleMute`
 *  (see the call site above). Glyph follows `muted` (slash when muted, wave otherwise) — same
 *  convention as `GestureMuteToastView`. */
function renderMuteButton(
  theme: ReferenceUITheme,
  muted: boolean,
  onToggleMute: () => void,
): ReactElement {
  return (
    <Pressable onPress={onToggleMute} testID={LBTestIDs.playerHeaderMuteButton}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: ICON_GLASS,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {muted ? (
          <SpeakerSlashGlyph color={ON_GLASS} size={18} />
        ) : (
          <SpeakerWaveGlyph color={ON_GLASS} size={18} />
        )}
      </View>
    </Pressable>
  );
}

/** A 36×36 round glass icon button (live-chrome.jsx iconBtn). Always rendered so
 *  the chrome is visually complete; inert when its callback is omitted. The glyph
 *  is a deterministic Text glyph (no vector-icons dep). The `minimize` role carries the
 *  registry `playerMinimize` testID; any other role has no registry id, so it is drawn
 *  WITHOUT a testID (the prior ad-hoc `player-header-icon-${role}` literal is removed). */
function renderGlassIconButton(
  theme: ReferenceUITheme,
  role: string,
  glyph: string,
  onPress?: () => void,
): ReactElement {
  return (
    <Pressable onPress={onPress} testID={role === 'minimize' ? LBTestIDs.playerMinimize : undefined}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: ICON_GLASS,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: ON_GLASS, fontSize: 20 * theme.fontScale }}>{glyph}</Text>
      </View>
    </Pressable>
  );
}

// MARK: - Pure helpers

/**
 * Compact viewer-count formatting (e.g. `12345` → `12.3K`). Pure / deterministic.
 * Mirrors iOS `PlayerHeaderBarView.formatViewerCount`, Android `formatViewerCount`,
 * and Flutter `formatViewerCount` exactly (one decimal, trailing `.0` trimmed).
 */
export function formatViewerCount(count: number): string {
  if (count < 1000) return String(count);
  const thousands = count / 1000.0;
  // One decimal, trim trailing `.0` (e.g. 2000 → "2K", 12345 → "12.3K").
  const rounded = Math.round(thousands * 10) / 10.0;
  if (rounded === Math.round(rounded)) {
    return `${Math.round(rounded)}K`;
  }
  return `${rounded.toFixed(1)}K`;
}
