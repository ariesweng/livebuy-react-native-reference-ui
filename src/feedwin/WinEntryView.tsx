// WinEntryView — family-2 feed-win surface 2 (unclaimed-win entry).
//
// Spec: `reference-ui-rendering/spec.md` (family-2 feed-win, surface 2).
// RN sibling of the DONE iOS `WinEntryView.swift` (rb-ios-win-entry-restyle),
// Android `WinEntry.kt` (rb-android-win-entry-restyle), and Flutter
// `win_entry_view.dart` (rb-flutter-win-entry-restyle) — this change
// (rb-rn-win-entry-restyle) ports the same 2026-08-28 visual (R24) to RN,
// replacing the ORIGINAL rb-rn-feed-win circle/ring/badge design below.
//   Design source: `design/templates/minimal/moments.jsx` · `LBWinEntry`
//     (a floating, STATIC 48×48 SQUARE button (`borderRadius: 10`) the
//     container pins right-side over the live video: solid white `#fff`
//     background, a fixed-color two-path trophy/gift glyph — NOT `theme.accent`,
//     the outer fill is hardcoded `#F03246`, inner `#FFFFFF`, both drawn with
//     `fillRule="evenodd"` — and a bottom translucent-dark `rgba(55,60,68,0.8)`
//     label bar reading「領獎」. No pulsing ring, no gradient fill, no numeric
//     count badge — the prior circular/gradient/pulse-ring/count-badge design is
//     retired by this restyle).
//
// SUB-VIEW INPUT PATTERN (mirrors family-1 `OperationRailView` + the iOS /
// Android / Flutter surfaces EXACTLY):
//   1. `theme` (ReferenceUITheme, required)   — FIRST, always. Consumed ONLY for
//      `theme.fontScale` on the label text — the button's icon/background/label
//      colors are all fixed per this restyle (design.md D1).
//   2. its bound SNAPSHOT VALUES it renders   — `unclaimedCount` (drives ONLY
//      whether the entry draws at all now — the badge number itself is no
//      longer rendered) and `unclaimedWinners` (the by-value mirror of
//      `DefaultWinClaim.unclaimedWinners`; the container opens the claim sheet
//      on the EARLIEST one, so this read-only surface keeps the value so the
//      wired-intent contract is explicit but NEVER records / removes /
//      reorders winners). Passed BY VALUE from `FeedWinModel`.
//   3. optional action callback, trailing, defaulting to a no-op (`onOpen`). The
//      container / host funnels it to open the claim sheet on the EARLIEST
//      unclaimed winner; this surface does NOT own the open intent and renders
//      correctly with it omitted (so demo / snapshot / preview construct
//      action-free).
//
// One-way data flow (D-1): this view reads ONLY its passed-in values — it never
// reaches back into `FeedWinModel` or `DefaultPlayerTemplate`, and it neither
// records a win nor removes one (those live in `DefaultWinClaim`). It only
// surfaces a single `onOpen` open intent; the container funnels that to the
// claim sheet on `unclaimedWinners[0]`.
//
// Visibility rule (D-3, unchanged by rb-rn-win-entry-restyle): the entry is
// drawn ONLY when `unclaimedCount > 0`. At 0 it renders nothing (returns `null`)
// so the container's trailing slot is visually empty when there is nothing to
// claim. (The container ALSO gates on `unclaimedCount > 0`; this surface
// self-gates too, mirroring iOS / Android / Flutter, so it is safe to compose
// unconditionally.)
//
// RENDER DISCIPLINE (inherited from family-1 / iOS / Android / Flutter —
// CRITICAL): plain `View` / `Text` / `Pressable` only — NO ScrollView /
// FlatList / SectionList / VirtualizedList — PLUS `react-native-svg`'s `Svg` /
// `Path`, used SOLELY to render this one multi-bezier two-tone glyph fill (a
// NEW dependency for this package, see design.md D1 — every other icon in this
// layer stays a plain `View`). NO network-uri Image. Deterministic — this
// restyle removed the ONLY runtime-varying state this surface ever had (the
// static-but-still-drawn pulse ring subtree); the restyled button has no
// animation / randomness at all.

import type { ReactElement } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '../TightText';
import Svg, { Path } from 'react-native-svg';

import type { ReferenceUITheme } from '../theme';
import type { LBWinner } from 'livebuy-react-native';
import { LBTestIDs } from '../testing/LBTestIDs';
// rb-rn-live-activity-sheet — the gift/trophy glyph path data + its two fixed fill colors are
// extracted to a shared module so `ActivityEntryView.tsx` (the same button, translucent-dark
// background variant) does not hand-retype these multi-thousand-character SVG `d` strings a
// second time. Byte-identical to what this file previously defined locally.
import {
  GIFT_OUTER_D,
  GIFT_INNER_D,
  GLYPH_OUTER_COLOR,
  GLYPH_INNER_COLOR,
} from './GiftGlyphPaths';

// MARK: - Design tokens (lifted from moments.jsx · LBWinEntry, R24)

/** Button width/height (`width: 48, height: 48`). */
const ENTRY_SIZE = 48;
/** Button corner radius (`borderRadius: 10`) — replaces the pre-R24 full circle. */
const CORNER_RADIUS = 10;

/**
 * Gift/trophy glyph render box size. The design renders the glyph at
 * `width="29" height="29"` (`viewBox="0 0 200 200"`) inside the 48×48 button
 * (icon-authoring.md rule 2: checked against the actual call-site size). This
 * component keeps its existing ≈22×22 slot — the same size the retired unicode
 * gift glyph rendered at — rather than switching to the design's literal 29,
 * mirroring iOS `WinEntryView.glyphSize` for the same reason (proposal.md).
 */
const GLYPH_SIZE = 22;

/** Bottom label bar height (`lineHeight: '14px'`, the label span's implied height). */
const LABEL_HEIGHT = 14;
/** Bottom label bar background (`rgba(55,60,68,0.8)`). */
const LABEL_BACKGROUND = 'rgba(55,60,68,0.8)';
/** Bottom label bar text size (`fontSize: 9`). */
const LABEL_FONT_SIZE = 9;
/**
 * Bottom label bar text — `label` for `variant === 'win'` (the ONLY variant this
 * component implements; the design's `variant === 'activity'` counterpart is now
 * implemented as the sibling `ActivityEntryView.tsx` component, rb-rn-live-activity-sheet
 * — a SEPARATE component, not a runtime variant switch on this one, sharing only the
 * glyph path data via `GiftGlyphPaths.ts`).
 */
const LABEL_TEXT = '領獎';

/** Props for the {@link WinEntry} surface. */
export interface WinEntryProps {
  /** The resolved reference-ui theme (FIRST argument, always). */
  readonly theme: ReferenceUITheme;
  /**
   * Distinct unclaimed-win count (`DefaultWinClaim.unclaimedCount`), BY VALUE.
   * The entry is drawn ONLY when this is `> 0` — R24 dropped the numeric badge
   * itself, so the count no longer has any other visual effect.
   */
  readonly unclaimedCount: number;
  /**
   * Unclaimed winners, insertion-ordered, deduped by id
   * (`DefaultWinClaim.unclaimedWinners`), passed BY VALUE. The container opens
   * the claim sheet on `unclaimedWinners[0]` (earliest); this read-only surface
   * keeps the value so the wired-intent contract is explicit, but it NEVER
   * records / removes / reorders winners. Defaults to empty.
   */
  readonly unclaimedWinners?: readonly LBWinner[];
  /**
   * Open-claim intent. The entry does NOT own the action — the container / host
   * funnels it to the claim sheet on the EARLIEST unclaimed winner (D-3). When
   * there is at least one winner it is invoked with `unclaimedWinners[0]`.
   * Default no-op so demo / snapshot / preview instances construct action-free.
   */
  readonly onOpen?: (winner: LBWinner) => void;
}

/**
 * The family-2 unclaimed-win entry. A floating 48×48 square button (the
 * container pins it trailing over the live video), drawn ONLY when
 * `unclaimedCount > 0`, with the design's fixed-color two-tone gift/trophy
 * glyph and a bottom「領獎」label — no count badge (R24). Tapping surfaces the
 * {@link WinEntryProps.onOpen} open intent (the container opens the claim sheet
 * on the EARLIEST unclaimed winner — `unclaimedWinners[0]`).
 *
 * Renders correctly with the default no-op `onOpen` (snapshot / preview safe).
 */
export function WinEntry(props: WinEntryProps): ReactElement | null {
  const { theme, unclaimedCount, unclaimedWinners = [], onOpen } = props;

  // Visibility rule (D-3): nothing to claim → draw nothing.
  if (unclaimedCount <= 0) return null;

  // Open the claim sheet on the EARLIEST unclaimed winner. No-op when there is
  // nothing to open (the entry is not drawn at count 0 anyway).
  const handleTap = (): void => {
    const first = unclaimedWinners[0];
    if (first == null) return;
    onOpen?.(first);
  };

  return (
    <Pressable onPress={handleTap} testID={LBTestIDs.winEntry}>
      <View
        style={{
          width: ENTRY_SIZE,
          height: ENTRY_SIZE,
          borderRadius: CORNER_RADIUS,
          backgroundColor: '#fff',
          overflow: 'hidden',
        }}
      >
        {/* Glyph — centered on the FULL 48×48 button area. The design's icon
            `<span>` is `flex:1` filling the WHOLE button (the label below is
            `position:absolute`, NOT a layout sibling that shrinks the icon's
            flex area), so the glyph centers on the whole button, with the
            label bar overlaid on top of its bottom edge. */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 200 200">
            <Path fillRule="evenodd" fill={GLYPH_OUTER_COLOR} d={GIFT_OUTER_D} />
            <Path fillRule="evenodd" fill={GLYPH_INNER_COLOR} d={GIFT_INNER_D} />
          </Svg>
        </View>

        {/* Bottom label bar (`position:absolute; left:0; right:0; bottom:0`,
            `rgba(55,60,68,0.8)` background, white ~9pt centered text「領獎」). */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: LABEL_HEIGHT,
            backgroundColor: LABEL_BACKGROUND,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: '#fff',
              fontSize: LABEL_FONT_SIZE * theme.fontScale,
              fontWeight: '600',
            }}
          >
            {LABEL_TEXT}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// MARK: - Gift/trophy glyph (`LBWinEntry`'s `giftFill` two-path icon, R24)
//
// rb-rn-live-activity-sheet — the path data + fixed fill colors now live in the shared
// `GiftGlyphPaths.ts` (imported above), so `ActivityEntryView.tsx` can reuse them without
// hand-retyping the multi-thousand-character SVG `d` strings a second time.

// MARK: - Pure helpers

/**
 * Clamp very large counts so the chip stays compact — matches the cart-badge
 * convention + iOS `WinEntryView.badgeText` / Android `winEntryBadgeText` /
 * Flutter `winEntryBadgeText`. R24 removed the count-badge VISUAL from this
 * surface, so this function is no longer called from {@link WinEntry}'s render
 * — kept exported because it is still independently covered by its own
 * cross-platform-parity unit tests (`WinEntry.test.tsx`). Pure / deterministic.
 */
export function winEntryBadgeText(count: number): string {
  return count > 99 ? '99+' : `${count}`;
}

/**
 * Darken a `#RRGGBB` hex color toward black by `amount` (0…1), mirroring the
 * design's `lbShade(hex, -amount)`: `c' = c * (1 - amount)`. Pure — operates on
 * the resolved hex components so it works for any resolved accent, not just the
 * minimal-palette hex. Mirrors iOS `WinEntryView.darkened` + Android `darkened` +
 * Flutter `darkened`. R24 replaced this surface's gradient-intent fill with a
 * solid white background, so this function is no longer called from
 * {@link WinEntry}'s render — kept exported because it is still independently
 * covered by its own unit tests (`WinEntry.test.tsx`). A malformed / non-hex
 * input is returned unchanged.
 */
export function darkened(hex: string, amount: number): string {
  const body = hex.startsWith('#') ? hex.slice(1) : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(body)) return hex;
  const f = 1 - amount;
  const channel = (start: number): string => {
    const v = Math.round(parseInt(body.slice(start, start + 2), 16) * f);
    const clamped = Math.max(0, Math.min(255, v));
    return clamped.toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`.toUpperCase();
}
