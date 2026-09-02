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

import type { ReactElement } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '../TightText';

import type { ReferenceUITheme } from '../theme';
import { ShareGlyph } from './ShareGlyph';
import { BagGlyph } from './BagGlyph';
import { LBTestIDs } from '../testing/LBTestIDs';
import { LBSideRailKind } from 'livebuy-react-native-ui';
import type { LBSideRailItem } from 'livebuy-react-native-ui';

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
const BAG_GLYPH_SIZE = 22; // bag glyph size 22 (design `LBPBagButton` Icons.bag size={22}; rb-rn-gesture-clean-mode-v2 縮小 34→22)
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
 * Fixed side-rail presentation order (design `LBPSideRail`: CC / share / contact). Each kind is
 * drawn ONLY when enabled in `items` — parity iOS `OperationRailView.presentationOrder` +
 * `isEnabled`. GOODS（袋）/ LIKE / MORE / CHAT / GUEST_NAME_EDIT are NOT rail kinds: the bag is a
 * SEPARATE floating affordance ({@link FloatingBagButton}); the others are not in the design rail.
 */
const RAIL_PRESENTATION_ORDER: readonly LBSideRailKind[] = [
  LBSideRailKind.Subtitle,
  LBSideRailKind.Share,
  LBSideRailKind.ServiceLink,
];

/**
 * Per-rail-kind E2E testID (registry-sourced). Only the kinds actually rendered by
 * {@link RAIL_PRESENTATION_ORDER} have an entry; other reachable kinds are not drawn in the
 * rail so they need no id here. `undefined` → the pill carries no testID (inert).
 */
function railTestIDFor(kind: LBSideRailKind): string | undefined {
  switch (kind) {
    case LBSideRailKind.Subtitle:
      return LBTestIDs.railSubtitle;
    case LBSideRailKind.Share:
      return LBTestIDs.railShare;
    case LBSideRailKind.ServiceLink:
      return LBTestIDs.railService;
    default:
      return undefined;
  }
}

export function OperationRail(props: OperationRailProps): ReactElement {
  const { theme, items, onTapItem } = props;

  // Fixed presentation order (design LBPSideRail: CC / share / contact); each pill drawn ONLY
  // when its kind is enabled in `items` (parity iOS presentationOrder + isEnabled). The bag is
  // NOT here — it is the separate FloatingBagButton composed lower by the shell.
  const visibleKinds = RAIL_PRESENTATION_ORDER.filter((kind) =>
    items.some((item) => item.kind === kind && item.enabled),
  );

  return (
    <View testID={LBTestIDs.operationRail} style={{ alignItems: 'center' }}>
      {visibleKinds.map((kind, i) => (
        <View key={kind} style={i > 0 ? { marginTop: RAIL_GAP } : undefined}>
          <PillButton theme={theme} kind={kind} onTap={() => onTapItem?.(kind)} />
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
 * A standard round pill: 40×40, fully-rounded, translucent dark fill, white
 * glyph. The active (white fill + accent glyph) style is not fed for any kind
 * today, so pills render in the inactive style (parity with iOS / Android /
 * Flutter).
 */
function PillButton(props: {
  theme: ReferenceUITheme;
  kind: LBSideRailKind;
  onTap: () => void;
}): ReactElement {
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
      {/* 分享 改設計稿自繪三節點 ShareGlyph（rb-rn-share-icon-design-align，問題 8）；其餘 kind 維持 glyph。 */}
      {kind === LBSideRailKind.Share ? (
        <ShareGlyph color="#FFFFFF" size={PILL_GLYPH_SIZE * theme.fontScale} />
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

/** Map a side-rail kind to its deterministic Text glyph. */
export function railGlyphFor(kind: LBSideRailKind): string {
  switch (kind) {
    case LBSideRailKind.Goods:
      return '🛍'; // handled by BagButton (bag.fill)
    case LBSideRailKind.Chat:
      return '💬'; // bubble.left.fill / Icons.chat
    case LBSideRailKind.Like:
      return '♥'; // heart.fill
    case LBSideRailKind.Share:
      return '↗'; // square.and.arrow.up / Icons.share
    case LBSideRailKind.Subtitle:
      return 'CC'; // captions.bubble / CC
    case LBSideRailKind.ServiceLink:
      return '💬'; // bubble.left.fill / Icons.chat（聯繫商家）
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
