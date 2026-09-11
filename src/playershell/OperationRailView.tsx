// OperationRailView — family-1 player-shell surface 2 (side rail).
//
// Spec: `reference-ui-rendering/spec.md` (family-1 player-shell, surface 2).
// Phase-4 RN sibling of the DONE iOS `OperationRailView.swift`
// (rb-ios-player-shell D-2 #2), Android `OperationRail.kt`
// (rb-android-player-shell), and Flutter `operation_rail.dart`
// (rb-flutter-player-shell — the authoritative blueprint translated here 1:1).
//   Design source: `design/templates/minimal/sdk-components.jsx`
//     · `LBPSideRail`   (right-side vertical pill stack)
//     · `LBPBagButton`  (floating bag affordance + cart badge)
//     · `LBPHeartBurst` (floating hearts, played off a like — runtime only)
//
// The trailing side-rail. It binds the `DefaultOperationRail` SNAPSHOT VALUES
// republished by `PlayerShellModel` (`items: readonly LBSideRailItem[]` +
// `bagCount` + `heartBurstTick` + `muted`, all passed BY VALUE) and paints:
//
//   • one round pill per ENABLED action item (goods is the larger bag button),
//   • a cart badge on the goods item when `bagCount > 0`,
//   • a heart affordance for the like item (the actual burst animation is a
//     runtime concern — observed off `heartBurstTick`; the static surface /
//     structural snapshot draws only the buttons, parity with Android's
//     omission + the iOS golden's static first-frame).
//
// SUB-VIEW INPUT PATTERN (D-1/D-4): theme FIRST → snapshot values BY VALUE →
// trailing optional `onTapItem` (default no-op). This view reads ONLY its
// passed-in values — it NEVER reaches back into `PlayerShellModel` /
// `DefaultPlayerTemplate`, holds NO second copy of state, and calls NO core
// `simulate*`. Taps surface a single `onTapItem` intent (each kind), which the
// shell hands on to that kind's owner — a container seam (core `simulate*`, a
// system share, an in-app browser) or, for kinds nobody has wired yet, nothing
// at all. See `container/seams.ts` `defaultRailTap` for the per-kind breakdown.
//
// RENDER DISCIPLINE (inherited from iOS / Android / Flutter — CRITICAL): plain
// `View` / `Text` / `Pressable` only — NO ScrollView / FlatList / SectionList /
// VirtualizedList (a fixed small column so the rail renders deterministically in
// the structural snapshot). NO network-uri Image. Glyphs are deterministic Text
// glyphs (react-native-vector-icons is unavailable) so the baseline is stable.
// NO animation / randomness.
//
// CC (Subtitle) pill — R42 always-render redesign (rb-rn-cc-icon-availability-redesign):
// unlike every OTHER rail kind, the `Subtitle` pill is no longer gated by `items`' `enabled`
// flag — it ALWAYS renders (see `subtitleAvailableFrom` / `CcRailPill` below), showing one of
// three `CcGlyph` states (on / off / unavailable) instead of disappearing when captions are
// unavailable. Tapping it while unavailable shows a local "未提供字幕" tooltip instead of
// forwarding `onTapItem` (`useCcUnavailableTooltip.ts` / `CcTooltip.tsx`) — this is the ONE
// exception to the "enabled === false → omit, MUST NOT dim" rule the rest of this rail follows.

import type { ReactElement } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '../TightText';

import type { ReferenceUITheme } from '../theme';
import { ShareGlyph } from './ShareGlyph';
import { ContactGlyph } from './ContactGlyph';
import { CcGlyph } from './CcGlyph';
import { CcTooltip } from './CcTooltip';
import { useCcUnavailableTooltip } from './useCcUnavailableTooltip';
import { BagGlyph } from './BagGlyph';
import { LBTestIDs } from '../testing/LBTestIDs';
import { LBSideRailKind } from 'livebuy-react-native-ui';
import type { LBSideRailItem } from 'livebuy-react-native-ui';

/** Design-literal tooltip text (R42, `LBPTooltip` first call site) — same string at both of the
 *  two CC entry points this applies to (VOD side rail + LIVE-replay bottom bar). */
export const CC_UNAVAILABLE_TOOLTIP_TEXT = '未提供字幕/隱藏式輔助字幕';

/**
 * Whether captions are available for the current video — pure, unit-testable, no rendering.
 * `items` not containing a `Subtitle` entry, or containing one with `enabled === false`, both
 * resolve to `false` (unavailable). Shared by `OperationRail` (its own `items` prop) and
 * `PlayerShellView.tsx`'s `<LiveBottomBarView>` call site (fed `model.railItems`) so both of
 * R42's two CC entry points read the SAME single source of truth.
 */
export function subtitleAvailableFrom(items: readonly LBSideRailItem[]): boolean {
  return items.some((item) => item.kind === LBSideRailKind.Subtitle && item.enabled);
}

// MARK: - Secondary design colors (lifted from sdk-components.jsx)
//
// `ReferenceUITheme` carries accent / background / text only; the rail's
// translucent dark pill fill is a reference-ui-local design token (mirrors how
// the iOS / Android / Flutter surfaces lift it as a private constant).

/** `rgba(20,20,24,0.55)` — the translucent dark pill fill (`LBPSideRail` railBtn). */
const RAIL_PILL_BACKGROUND = 'rgba(20,20,24,0.55)';

// MARK: - Layout tokens (lifted from sdk-components.jsx)

const RAIL_GAP = 10; // flex gap between pills (`LBPSideRail`)
const PILL_SIZE = 40; // 40×40 round pill
const PILL_GLYPH_SIZE = 18; // glyph size 18
const BAG_SIZE = 40; // 40×40 floating bag (`LBPBagButton`, rb-rn-gesture-clean-mode-v2 縮小 48→40)
const BAG_GLYPH_SIZE = 28; // bag glyph size 28, ~70% of BAG_SIZE (design `LBPBagButton` Icons.bag size={28}; rb-rn-vod-bag-icon-ratio-restore 校正 rb-rn-gesture-clean-mode-v2 誤植的非等比縮放 22→28)
const BADGE_MIN_SIZE = 20; // count chip minWidth / height
const BADGE_FONT_SIZE = 11; // fontSize 11, weight 800
const BADGE_BORDER_WIDTH = 2; // 2px solid #fff border

/** Props for the {@link OperationRail} surface. */
export interface OperationRailProps {
  /** The resolved reference-ui theme (FIRST argument, always). */
  readonly theme: ReferenceUITheme;
  /** Ordered side-rail action items. Only `enabled` items are drawn. */
  readonly items: readonly LBSideRailItem[];
  /** Shopping-bag badge count. `> 0` → draw the badge on the goods button. */
  readonly bagCount: number;
  /**
   * Monotonic heart-burst tick. Carried for shape parity; the burst animation is
   * a runtime concern observed off this value (the static surface draws none).
   */
  readonly heartBurstTick: number;
  /**
   * Mute gesture state (shared with the header). Carried so the surface matches
   * the documented input shape; informational for the rail today.
   */
  readonly muted: boolean;
  /**
   * Tap intent for a side-rail kind. The rail does NOT own the action — it hands the kind to
   * `PlayerShellView.handleRailTap`, which routes it to whichever owner that kind has (D-4). NOT
   * necessarily a core `simulate*`: of the three kinds this rail draws, `Share` / `ServiceLink`
   * land on the container's dedicated `onShare` / `onServiceLink` seams (system share / in-app
   * browser — neither is a `simulate*`) and `Subtitle` is still un-wired (a known dead button,
   * recorded in `defaultRailTap`'s doc). Defaults to a no-op so demo / snapshot instances
   * construct action-free.
   */
  readonly onTapItem?: (kind: LBSideRailKind) => void;
  /**
   * "已結束直播回放" (finished-live-replay) flag (element itself added by design R32,
   * rb-rn-live-replay-more-menu-and-video-info-live-copy; source: `PlayerShellModel
   * .isFinishedLiveReplay`). `true` → the rail appends a `LBSideRailKind.More` (`'⋯'`) pill to
   * its presentation order, opening the collapsed `LiveMoreMenuView` sheet (分享 + 客服) via
   * `onTapItem`. This REUSES a `More` kind the TEMPLATE layer already models
   * (`react-native-ui`'s `RAIL_ORDER` + `isEnabled` — always enabled, same as
   * `goods`/`like`/`share`) but reference-ui had never drawn; NO new view-model.
   *
   * ⚠️ COMPONENT-LEVEL ONLY (rb-rn-replay-live-chrome-parity): this rail was briefly (between
   * `rb-rn-live-replay-more-menu-and-video-info-live-copy` and this change) the one place RN
   * actually rendered a finished-live-replay's chrome, with `PlayerShellView.tsx`'s
   * `<OperationRail>` call site feeding this prop `model.isFinishedLiveReplay` for real. That is
   * NO LONGER the case: the side rail is now PURE-VOD-ONLY (`!usesLiveChrome`), a finished-live
   * replay routes to `LiveBottomBarView`'s `chatClosed` variant instead (see that component's
   * own doc comment), and the current `PlayerShellView.tsx` call site no longer feeds this prop
   * at all. This prop and the append logic below remain exactly as implemented — correct,
   * unit-testable, and available for direct construction (see `OperationRail.test.tsx`) — the
   * capability just has no real call site driving it today. **Default `false`** — every
   * existing call site keeps rendering the base 3-pill order (CC / share / contact),
   * byte-identical to before this prop existed.
   */
  readonly isFinishedLiveReplay?: boolean;
  /**
   * VOD CC (字幕) toggle state (`PlayerShellModel.subtitleEnabled`, rb-rn-cc-icon-active-fill-state;
   * source: `template.subtitleState.enabled`). Only consulted when captions are AVAILABLE (see
   * `subtitleAvailableFrom(items)`) — `true` → the `Subtitle` rail pill draws {@link CcGlyph}'s
   * `'on'` state (design `LBPSideRail` `railBtn(icon, active, onClick)`: white background +
   * `theme.accent`-tinted glyph); `false` (default) → the `'off'` state (base translucent-dark
   * background + white glyph). When captions are UNAVAILABLE this flag is moot — the pill always
   * draws `CcGlyph`'s `'unavailable'` state regardless (R42, rb-rn-cc-icon-availability-redesign;
   * see {@link CcRailPill}). ONLY the `Subtitle` pill is ever affected by this prop — every other
   * kind (`Share` / `ServiceLink` / `More`) is drawn by the plain {@link PillButton}, which has no
   * active/inactive concept at all. **Default `false`.**
   */
  readonly subtitleEnabled?: boolean;
}

/**
 * The family-1 trailing side-rail surface. Renders only the ENABLED
 * {@link LBSideRailItem}s as themed round pills (goods as the larger bag button
 * with a cart badge when `bagCount > 0`), painting over whatever (dark video)
 * backdrop the host supplies behind it.
 *
 * Renders correctly with the default no-op `onTapItem` (snapshot / preview safe).
 */
/**
 * BASE side-rail presentation order (design `LBPSideRail`: CC / share / contact) — a MODULE-LEVEL
 * constant, deliberately left UNCHANGED by design R32 (`OperationRail` composes the ACTUAL order
 * at render time from this base + `isFinishedLiveReplay`, rather than mutating this constant
 * itself — see {@link OperationRail}). Each kind is drawn ONLY when enabled in `items` — parity
 * iOS `OperationRailView.presentationOrder` + `isEnabled`. GOODS（袋）/ LIKE / CHAT /
 * GUEST_NAME_EDIT are NOT rail kinds: the bag is a SEPARATE floating affordance
 * ({@link FloatingBagButton}); the others are not in the design rail. MORE is a rail kind (see
 * {@link OperationRail}'s `isFinishedLiveReplay`-conditional append) — it is NOT in this base
 * list because the design's `LBPSideRail` itself never draws it; only the finished-live-replay
 * variant does (design `live_more`, `screens.jsx`).
 */
const RAIL_PRESENTATION_ORDER: readonly LBSideRailKind[] = [
  LBSideRailKind.Subtitle,
  LBSideRailKind.Share,
  LBSideRailKind.ServiceLink,
];

/**
 * Per-rail-kind E2E testID (registry-sourced) for the kinds drawn by the generic
 * {@link PillButton}. `Subtitle` is NOT one of them (R42, rb-rn-cc-icon-availability-redesign):
 * it has its own dedicated component, {@link CcRailPill}, which assigns `LBTestIDs.railSubtitle`
 * directly — routing it through this function too would be untestable dead code (`PillButton`
 * never receives `kind === Subtitle` any more). `undefined` → the pill carries no testID (inert).
 */
function railTestIDFor(kind: LBSideRailKind): string | undefined {
  switch (kind) {
    case LBSideRailKind.Share:
      return LBTestIDs.railShare;
    case LBSideRailKind.ServiceLink:
      return LBTestIDs.railService;
    case LBSideRailKind.More:
      return LBTestIDs.railMore;
    default:
      return undefined;
  }
}

export function OperationRail(props: OperationRailProps): ReactElement {
  const { theme, items, onTapItem, isFinishedLiveReplay = false, subtitleEnabled = false } = props;

  // ACTUAL presentation order for this render: the base order (design LBPSideRail: CC / share /
  // contact) plus, ONLY for a finished-live-replay (design R32's `live_more` trigger), a
  // trailing `More` pill. Computed here (NOT by mutating the module-level `RAIL_PRESENTATION_
  // ORDER` constant) so the base order stays a single, stable, always-correct source for every
  // OTHER call site (isFinishedLiveReplay defaults false → byte-identical to before this prop
  // existed). The bag is NOT here — it is the separate FloatingBagButton composed lower by the
  // shell.
  const presentationOrder = isFinishedLiveReplay
    ? [...RAIL_PRESENTATION_ORDER, LBSideRailKind.More]
    : RAIL_PRESENTATION_ORDER;
  // Each pill is drawn ONLY when its kind is enabled in `items` (parity iOS presentationOrder +
  // isEnabled) — EXCEPT `Subtitle` (CC), which R42 (rb-rn-cc-icon-availability-redesign) makes
  // ALWAYS render: unavailable captions now show a distinct `CcGlyph` state instead of omitting
  // the pill (the ONE exception to this rail's "enabled === false → omit" rule).
  const visibleKinds = presentationOrder.filter(
    (kind) =>
      kind === LBSideRailKind.Subtitle || items.some((item) => item.kind === kind && item.enabled),
  );
  const subtitleAvailable = subtitleAvailableFrom(items);

  return (
    <View testID={LBTestIDs.operationRail} style={{ alignItems: 'center' }}>
      {visibleKinds.map((kind, i) => (
        <View key={kind} style={i > 0 ? { marginTop: RAIL_GAP } : undefined}>
          {kind === LBSideRailKind.Subtitle ? (
            <CcRailPill
              theme={theme}
              active={subtitleEnabled}
              subtitleAvailable={subtitleAvailable}
              onTap={() => onTapItem?.(kind)}
            />
          ) : (
            <PillButton theme={theme} kind={kind} onTap={() => onTapItem?.(kind)} />
          )}
        </View>
      ))}
    </View>
  );
}

/**
 * The floating shopping-bag affordance (design `LBPBagButton`, iOS `FloatingBagButtonView`): a
 * 48×48 white circle + accent bag glyph + cart badge. Composed by the shell SEPARATELY from the
 * side rail (so it sits lower, next to the mini-cart strip — design `bottom 16` vs rail `bottom 80`).
 */
export function FloatingBagButton(props: {
  theme: ReferenceUITheme;
  bagCount: number;
  onTap?: () => void;
}): ReactElement {
  return <BagButton theme={props.theme} bagCount={props.bagCount} onTap={() => props.onTap?.()} />;
}

// MARK: - Pill button (`LBPSideRail` railBtn)

/**
 * A standard round pill: 40×40, fully-rounded, translucent-dark fill + white glyph. Draws every
 * rail kind EXCEPT `Subtitle` (CC) — that pill has its own `active`/`unavailable`-aware component,
 * {@link CcRailPill}, below (R42, rb-rn-cc-icon-availability-redesign moved it out of this
 * generic button so this one no longer needs an `active` concept at all).
 */
function PillButton(props: { theme: ReferenceUITheme; kind: LBSideRailKind; onTap: () => void }): ReactElement {
  const { theme, kind, onTap } = props;
  return (
    <Pressable
      testID={railTestIDFor(kind)}
      onPress={onTap}
      style={{
        width: PILL_SIZE,
        height: PILL_SIZE,
        borderRadius: PILL_SIZE / 2,
        backgroundColor: RAIL_PILL_BACKGROUND,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* 分享 改設計稿自繪三節點 ShareGlyph（rb-rn-share-icon-design-align，問題 8）；
          客服 (ServiceLink) 改設計稿自繪雙泡泡+問號 ContactGlyph（rb-rn-icon-parity-contact-glyph，
          parity iOS/Android/Flutter ContactGlyph——不再與 Chat 共用 railGlyphFor 的 '💬' 字面文字）；
          其餘 kind 維持 Text glyph（railGlyphFor 本身不變）。 */}
      {kind === LBSideRailKind.Share ? (
        <ShareGlyph color="#FFFFFF" size={PILL_GLYPH_SIZE * theme.fontScale} />
      ) : kind === LBSideRailKind.ServiceLink ? (
        <ContactGlyph color="#FFFFFF" size={PILL_GLYPH_SIZE * theme.fontScale} />
      ) : (
        <Text
          style={{
            fontSize: PILL_GLYPH_SIZE * theme.fontScale,
            color: '#FFFFFF',
            fontWeight: '600',
          }}
        >
          {railGlyphFor(kind)}
        </Text>
      )}
    </Pressable>
  );
}

// MARK: - CC (Subtitle) pill — R42 three-state redesign (rb-rn-cc-icon-availability-redesign)

/**
 * The `Subtitle` (CC) rail pill. Same 40×40 round shape as {@link PillButton}, but with its own
 * on/off/unavailable glyph logic (design R42) instead of a plain Text/Share glyph:
 *
 *   - `subtitleAvailable === false` → `CcGlyph` `'unavailable'` state (fixed grey, non-square
 *     18×16), pill stays in the base inactive style (translucent-dark fill), and a tap does NOT
 *     call `onTap` — it shows a local "未提供字幕" {@link CcTooltip} instead
 *     ({@link useCcUnavailableTooltip}), auto-dismissing after ~1.8s.
 *   - `subtitleAvailable === true` → `CcGlyph` `'on'` (white fill + `theme.accent` glyph) or
 *     `'off'` (translucent-dark fill + white glyph) per `active` (rb-rn-cc-icon-active-fill-state
 *     — UNCHANGED semantics, just relocated out of the now-generic `PillButton`), and a tap calls
 *     `onTap` as before (host-wired to the existing `onTapItem(Subtitle)` → `simulateSubtitleToggleTap`
 *     path — unchanged by this component split).
 *
 * This pill ALWAYS renders (see `OperationRail`'s `visibleKinds` — the ONE exception to "enabled
 * === false → omit" in this rail); it is `OperationRail`'s job to always include it, not this
 * component's.
 */
function CcRailPill(props: {
  theme: ReferenceUITheme;
  /** Design `railBtn`'s `active` argument — CC ON/enabled. Ignored when `subtitleAvailable` is
   *  `false` (unavailable always wins). */
  active: boolean;
  /** Whether captions are available for this video (`subtitleAvailableFrom(items)`). */
  subtitleAvailable: boolean;
  onTap: () => void;
}): ReactElement {
  const { theme, active, subtitleAvailable, onTap } = props;
  const tooltip = useCcUnavailableTooltip();

  const handlePress = (): void => {
    if (!subtitleAvailable) {
      tooltip.show();
      return;
    }
    onTap();
  };

  return (
    <View style={{ position: 'relative' }}>
      <Pressable
        testID={LBTestIDs.railSubtitle}
        onPress={handlePress}
        style={{
          width: PILL_SIZE,
          height: PILL_SIZE,
          borderRadius: PILL_SIZE / 2,
          backgroundColor: subtitleAvailable && active ? '#FFFFFF' : RAIL_PILL_BACKGROUND,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CcGlyph
          state={!subtitleAvailable ? 'unavailable' : active ? 'on' : 'off'}
          color={active ? theme.accent : '#FFFFFF'}
          size={PILL_GLYPH_SIZE * theme.fontScale}
          width={!subtitleAvailable ? 18 : undefined}
          height={!subtitleAvailable ? 16 : undefined}
        />
      </Pressable>
      <CcTooltip
        testID={LBTestIDs.railSubtitleTooltip}
        visible={tooltip.visible}
        text={CC_UNAVAILABLE_TOOLTIP_TEXT}
        placement="left"
      />
    </View>
  );
}

// MARK: - Bag button (`LBPBagButton`)

/**
 * The bag button: a larger 48×48 white circle with the accent-tinted bag glyph,
 * plus the cart badge when `bagCount > 0` (accent fill, white text, 2px white
 * border, top-trailing). The iOS drop shadow is omitted (deterministic baseline)
 * — shape + colors match.
 */
function BagButton(props: {
  theme: ReferenceUITheme;
  bagCount: number;
  onTap: () => void;
}): ReactElement {
  const { theme, bagCount, onTap } = props;
  return (
    <Pressable onPress={onTap}>
      <View>
        <View
          style={{
            width: BAG_SIZE,
            height: BAG_SIZE,
            borderRadius: BAG_SIZE / 2,
            backgroundColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BagGlyph color={theme.accent} size={BAG_GLYPH_SIZE * theme.fontScale} />
        </View>
        {bagCount > 0 ? (
          <View style={{ position: 'absolute', top: -2, right: -2 }}>
            <CartBadge theme={theme} count={bagCount} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// MARK: - Cart badge (`LBPBagButton` count chip)

/** Cart count badge: accent capsule, white heavy text, 2px white border. */
function CartBadge(props: {
  theme: ReferenceUITheme;
  count: number;
}): ReactElement {
  const { theme, count } = props;
  return (
    <View
      style={{
        minWidth: BADGE_MIN_SIZE,
        minHeight: BADGE_MIN_SIZE,
        paddingHorizontal: 5,
        borderRadius: 999,
        backgroundColor: theme.accent,
        borderWidth: BADGE_BORDER_WIDTH,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: BADGE_FONT_SIZE * theme.fontScale,
          fontWeight: '800',
          textAlign: 'center',
        }}
      >
        {badgeText(count)}
      </Text>
    </View>
  );
}

// MARK: - Kind → glyph mapping
//
// The design's `LBPSideRail` only draws cc / share / chat; the view-model carries
// the wider reachable kind set. Each kind maps to a deterministic Text glyph that
// matches its design glyph intent (bag is handled by `BagButton`). Since
// react-native-vector-icons is unavailable in this layer, we use stable unicode
// glyphs (no font dependency) so the structural baseline is deterministic — this
// mirrors the iOS SF Symbol mapping and the Android text-glyph mapping (same
// design intent).
//
// `Share` bypasses this Text glyph for its OWN rail pill (`PillButton` above renders
// `ShareGlyph` — self-drawn `Icons.share` shape — instead, rb-rn-share-icon-design-align).
// `Subtitle` (CC) bypasses BOTH this Text glyph AND `PillButton` entirely: it has its own
// dedicated component, `CcRailPill` (above), which draws the three-state `CcGlyph` (R42,
// rb-rn-cc-icon-availability-redesign — supersedes the prior single-glyph `rb-rn-cc-icon-
// design-align`). This function's `'↗'` / `'CC'` cases are UNCHANGED and still the single
// source for other consumers (`LiveBottomBarView`'s `MORE_GLYPH` reuse pattern reads `More`;
// `railGlyphFor(Subtitle)`'s `'CC'` literal is kept solely for the kind→glyph parity test below
// — no production render path consumes it any more, neither here nor in `LiveBottomBarView`).
//
// `ServiceLink` (聯繫商家 / 客服) bypasses this Text glyph for its OWN rail pill too (`PillButton`
// above renders `ContactGlyph` — self-drawn dual speech-bubble + question-mark `Icons.contact`
// shape — instead, rb-rn-icon-parity-contact-glyph). Same "kept solely for parity test, no
// production render path consumes it" precedent as `Subtitle`/`Share` above: this function's
// `'💬'` case for `ServiceLink` is UNCHANGED in VALUE but no longer reached by any render path.
// `railGlyphFor(Chat)`'s OWN `'💬'` case is a completely separate, UNCHANGED consumer (the plain
// chat semantic, not the "聯繫商家" semantic `ServiceLink`/`ContactGlyph` now covers) — the two
// kinds no longer share a rendered glyph, only this now-inert string literal happens to still
// match by coincidence of history.
//
// `Like`'s case is DEAD CODE for rendering purposes: `Like` is not a member of
// `RAIL_PRESENTATION_ORDER` (this rail never draws a Like pill — see that constant's own
// doc comment) and the demo model seeds it `enabled: false`, so `PillButton` never actually
// reaches its `<Text>{railGlyphFor(kind)}</Text>` fallback branch for this kind. Its value was
// the literal Unicode `'♥'` (parity-debt-ledger.md #20 — the same class of bug Android fixed in
// `rb-android-heart-burst-deemoji`, Flutter fixed in `rb-flutter-heart-burst-icon-parity`, and RN
// itself fixed for the two REACHABLE `'♥'` sites — the LIKE button in `LiveBottomBarView.tsx` and
// the flying burst in `HeartBurst.tsx`, both now `HeartFillGlyph`). Unlike `'↗'` / `'CC'` above,
// this value has no other consumer that needs it to stay byte-identical (only this switch and
// this file's own tests read it), so — rather than leave the actual problem CHARACTER sitting in
// source — its value is replaced with a non-emoji ASCII placeholder (`rb-rn-heart-burst-icon-
// parity`). A real `PillButton` render branch for `Like` is deliberately NOT added here: it would
// be an untestable dead branch (no path in this file's public API can ever feed `Like` into
// `PillButton`), which this repo's testability discipline disallows.

/** Map a side-rail kind to its deterministic Text glyph. */
export function railGlyphFor(kind: LBSideRailKind): string {
  switch (kind) {
    case LBSideRailKind.Goods:
      return '🛍'; // handled by BagButton (bag.fill)
    case LBSideRailKind.Chat:
      return '💬'; // bubble.left.fill / Icons.chat
    case LBSideRailKind.Like:
      return 'like'; // heart.fill — never rendered (see comment block above)
    case LBSideRailKind.Share:
      return '↗'; // square.and.arrow.up / Icons.share
    case LBSideRailKind.Subtitle:
      return 'CC'; // captions.bubble / CC
    case LBSideRailKind.ServiceLink:
      return '💬'; // kept for kind→glyph parity test only — rendered via ContactGlyph
                    // (PillButton), see comment block above (rb-rn-icon-parity-contact-glyph)
    case LBSideRailKind.GuestNameEdit:
      return '✎'; // pencil / edit display name
    case LBSideRailKind.More:
      return '⋯'; // ellipsis / more menu
    default:
      return '•';
  }
}

// MARK: - Badge text

/**
 * Clamp very large counts so the badge stays compact (design badge is a small
 * chip). Caps past 99 as `99+` — matches typical cart-badge convention + iOS /
 * Android / Flutter.
 */
export function badgeText(count: number): string {
  return count > 99 ? '99+' : `${count}`;
}
