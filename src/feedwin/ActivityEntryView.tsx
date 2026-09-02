// ActivityEntryView — family-2 feed-win surface (活動入口, RN, rb-rn-live-activity-sheet).
//
// Spec: `reference-ui-rendering/spec.md` § "渲染 RN ActivityEntry 活動入口，綁 currentActivity"
// Design: `design/templates/minimal/moments.jsx` · `LBWinEntry(variant="activity")` — the SAME
//   floating 48×48 square button component `WinEntryView.tsx` mirrors for `variant='win'` (the two
//   variants share one glyph + one label-bar treatment; only the button background / aria-label /
//   bottom label text differ): a translucent dark `rgb(58 58 58 / 30%)` background (RN equivalent
//   `rgba(58, 58, 58, 0.3)` — NOT `WinEntry`'s solid white), the SAME fixed-color two-path
//   trophy/gift glyph (`GiftGlyphPaths.ts`, shared with `WinEntryView.tsx` — this change extracted
//   the path data there so this component does not hand-retype the multi-thousand-character SVG
//   path strings), and a bottom translucent-dark `rgba(55,60,68,0.8)` label bar reading「活動」
//   (not「領獎」).
// Parity: mirrors this package's own `WinEntryView.tsx` structure — same SUB-VIEW INPUT PATTERN,
//   same render discipline (see that file's header for the shared conventions this surface
//   inherits; not re-derived here to avoid drift between two copies of the same prose).
//
// Visibility rule: drawn ONLY when `currentActivity != null` (mirrors `WinEntry`'s
// `unclaimedCount > 0` self-gate). The container ALSO gates on this (`FeedWinView.tsx`); this
// surface self-gates too, so it is safe to compose unconditionally.
//
// One-way data flow: this view reads ONLY its passed-in `currentActivity` — it never reaches back
// into `FeedWinModel` or `DefaultPlayerTemplate`, and it never records / clears the activity (that
// lives in `DefaultPlayerTemplate`). It surfaces a single `onOpen` intent carrying NO data — unlike
// `WinEntry` (which forwards `unclaimedWinners[0]`, a specific item out of a collection), there is
// only ever ONE running activity, so the container / host reads the CURRENT `model.currentActivity`
// directly when presenting the sheet; this tap has nothing else to carry.
//
// RENDER DISCIPLINE (inherited from family-1 / the rest of this layer — CRITICAL): plain `View` /
// `Text` / `Pressable` only — NO ScrollView / FlatList / SectionList / VirtualizedList — PLUS
// `react-native-svg`'s `Svg` / `Path`, used SOLELY to render the shared multi-bezier two-tone glyph
// fill. NO network-uri Image. Deterministic — no animation / randomness.

import type { ReactElement } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '../TightText';
import Svg, { Path } from 'react-native-svg';

import type { ReferenceUITheme } from '../theme';
import type { LBActiveEvent } from 'livebuy-react-native';
import { LBTestIDs } from '../testing/LBTestIDs';
import {
  GIFT_OUTER_D,
  GIFT_INNER_D,
  GLYPH_OUTER_COLOR,
  GLYPH_INNER_COLOR,
} from './GiftGlyphPaths';

// MARK: - Design tokens (lifted from moments.jsx · LBWinEntry(variant="activity"))

/** Button width/height (`width: 48, height: 48` — identical to `WinEntryView.ENTRY_SIZE`). */
const ENTRY_SIZE = 48;
/** Button corner radius (`borderRadius: 10` — identical to `WinEntryView.CORNER_RADIUS`). */
const CORNER_RADIUS = 10;
/**
 * Button background — the ONLY visual difference (besides label text / aria-label) from
 * `WinEntryView`'s solid white `#fff`: a translucent dark fill (design `rgb(58 58 58 / 30%)`, RN
 * equivalent `rgba(58, 58, 58, 0.3)`).
 */
const ENTRY_BACKGROUND = 'rgba(58, 58, 58, 0.3)';
/**
 * Glyph render box size — kept identical to `WinEntryView.GLYPH_SIZE` (the same sibling
 * button), aligned to the design's literal `29` (`winentry-icon-size-align-design-rn`).
 */
const GLYPH_SIZE = 29;
/** Bottom label bar height (identical to `WinEntryView.LABEL_HEIGHT`). */
const LABEL_HEIGHT = 14;
/** Bottom label bar background — the SAME translucent dark bar as `WinEntryView` (both variants
 *  share this treatment; only the button background behind it differs). */
const LABEL_BACKGROUND = 'rgba(55,60,68,0.8)';
/** Bottom label bar text size (identical to `WinEntryView.LABEL_FONT_SIZE`). */
const LABEL_FONT_SIZE = 9;
/** Bottom label text — 「活動」(NOT「領獎」, the ONLY variant this component implements). */
const LABEL_TEXT = '活動';

/** Props for the {@link ActivityEntry} surface. */
export interface ActivityEntryProps {
  /** The resolved reference-ui theme (FIRST argument, always). */
  readonly theme: ReferenceUITheme;
  /**
   * The single currently-running live-shopping activity, or `null` when none is running
   * (`DefaultPlayerTemplate.currentActivity`), passed BY VALUE. The entry is drawn ONLY when this
   * is non-null.
   */
  readonly currentActivity: LBActiveEvent | null;
  /**
   * Open-sheet intent. Unlike {@link WinEntryProps.onOpen} (in `WinEntryView.tsx`), this carries
   * NO data — the container / host presents the sheet by reading the CURRENT
   * `model.currentActivity` directly (there is only ever ONE running activity, not a collection to
   * pick an entry from). Default no-op so demo / snapshot / preview instances construct
   * action-free.
   */
  readonly onOpen?: () => void;
}

/**
 * The family-2 活動入口 (activity entry). A floating 48×48 square button (the container pins it
 * trailing over the live video, stacked below {@link WinEntry} per design.md D1), drawn ONLY when
 * `currentActivity != null`, with the SAME fixed-color two-tone gift/trophy glyph as `WinEntry` and
 * a bottom「活動」label. Tapping surfaces the {@link ActivityEntryProps.onOpen} open intent.
 *
 * Renders correctly with the default no-op `onOpen` (snapshot / preview safe).
 */
export function ActivityEntry(props: ActivityEntryProps): ReactElement | null {
  const { theme, currentActivity, onOpen } = props;

  // Visibility rule: no running activity → draw nothing.
  if (currentActivity == null) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="參加活動"
      onPress={(): void => onOpen?.()}
      testID={LBTestIDs.activityEntry}
    >
      <View
        style={{
          width: ENTRY_SIZE,
          height: ENTRY_SIZE,
          borderRadius: CORNER_RADIUS,
          backgroundColor: ENTRY_BACKGROUND,
          overflow: 'hidden',
        }}
      >
        {/* Glyph — centered on the FULL 48×48 button area (parity `WinEntryView`'s same
            flex:1-fills-the-whole-button treatment; the label below is `position:absolute`, NOT
            a layout sibling that shrinks the icon's flex area). */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 200 200">
            <Path fillRule="evenodd" fill={GLYPH_OUTER_COLOR} d={GIFT_OUTER_D} />
            <Path fillRule="evenodd" fill={GLYPH_INNER_COLOR} d={GIFT_INNER_D} />
          </Svg>
        </View>

        {/* Bottom label bar (`position:absolute; left:0; right:0; bottom:0`,
            `rgba(55,60,68,0.8)` background, white ~9pt centered text「活動」). */}
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
