// GestureSeekToastView — family-1 half-screen gradient toast for double-tap ±10s seek feedback
// (rb-rn-double-tap-seek-feedback). RN sibling of iOS `GestureSeekToastView.swift`
// (rb-ios-double-tap-seek-feedback) / Android `GestureSeekToastView.kt`
// (rb-android-double-tap-seek-feedback) / Flutter (rb-flutter-double-tap-seek-feedback) — each a
// parallel, independent change; this file covers RN only.
//
// Spec: `reference-ui-rendering/spec.md` §「livebuy-react-native-reference-ui player-shell 影片區
//   手勢二度重寫...」Requirement's「雙擊 seek 的半螢幕漸層視覺回饋」段落.
// Design: `design/templates/minimal/sdk-components.jsx` `LBPGestureToast`'s `seekFwd`/`seekBack`
//   branch (R46, 2026-09-18) + `LBPSeekHorn` helper.
//
// The double-tap-seek ±10s BEHAVIOR (`isDoubleTapSeekHit` / `model.seekBy`, `PlayerShellView.tsx`,
// `rb-rn-gesture-clean-mode-v2`) has shipped since 2026-09-02 with no visual acknowledgement — this
// component is a from-scratch addition, not a redesign of existing pixels. PURE presentation: reads
// only `zone` (which half was double-tapped) and paints a dark half-screen scrim + "10" + a
// direction-indicating triplet of fading `SeekHornGlyph`s. Owns NO timer of its own —
// `PlayerShellView` decides whether to mount this at all (`seekToastZone: TapZone | null`),
// mirroring the retired `GestureMuteToastView`'s documented "no timer of its own" contract (see
// that file's header comment) — unlike that retired component, THIS one IS actively composed by
// `PlayerShellView`.
//
// The design's overlay is a true CSS linear-gradient (edge `rgba(0,0,0,0.8)` → center
// `rgba(0,0,0,0)`), rendered here as a real `react-native-svg` `<LinearGradient>` (that package is
// already a dependency of this package — `SeekHornGlyph.tsx` in this same directory already draws
// with `<Svg>`/`<Path>` — so this is reuse of an existing capability, not a new native dependency;
// see design.md D1, corrected after the initial flat-scrim approximation was rejected at review as
// not matching the design source, matching the sibling iOS implementation's real `LinearGradient`
// use — `GestureSeekToastView.swift`, `rb-ios-double-tap-seek-feedback`).

import type { ReactElement } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Text } from '../TightText';

import type { ReferenceUITheme } from '../theme';
import type { TapZone } from './PlayerShellView';
import { LBTestIDs } from '../testing/LBTestIDs';
import { SeekHornGlyph } from './SeekHornGlyph';

export interface GestureSeekToastViewProps {
  readonly theme: ReferenceUITheme;
  /** Which half was double-tapped — `'forward'` (right half, +10s) hugs the right edge with
   *  unmirrored horn glyphs; `'rewind'` (left half, -10s) hugs the left edge with the horn row
   *  mirrored (design.md D2 — group-level mirror, not per-glyph). */
  readonly zone: TapZone;
}

/** `<LinearGradient>` id — a plain static string is fine: only one `GestureSeekToastView` is ever
 *  mounted at a time in production (`PlayerShellView.seekToastZone` is a single value, not a
 *  list), and each jest test renders its own isolated `react-test-renderer` tree. */
const GRADIENT_ID = 'lb-gesture-seek-toast-scrim';

/** The design's darkest gradient stop (the touched screen edge) — `rgba(0,0,0,0.8)`. */
const SCRIM_EDGE_OPACITY = 0.8;

/** Gap (design px) between the toast's content and the true screen edge it hugs. */
const EDGE_INSET = 28;

/** The half-screen dark-gradient + "10" + fading horn-triplet double-tap-seek toast. */
export function GestureSeekToastView(props: GestureSeekToastViewProps): ReactElement {
  const { theme, zone } = props;
  const isFwd = zone === 'forward';
  return (
    <View
      testID={LBTestIDs.gestureSeekToast}
      pointerEvents="none"
      style={
        isFwd
          ? {
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              width: '44%',
              alignItems: 'flex-end',
              justifyContent: 'center',
            }
          : {
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: '44%',
              alignItems: 'flex-start',
              justifyContent: 'center',
            }
      }
    >
      {/* The gradient fill, absolutely positioned to cover the whole 44%-wide block — pinned edge
          (`x1`/`x2` swap by direction) at `SCRIM_EDGE_OPACITY`, fading to fully transparent toward
          the center, matching design `linear-gradient(to left/right, rgba(0,0,0,0.8) 0%,
          rgba(0,0,0,0) 100%)` and iOS `LinearGradient(startPoint: .trailing/.leading,
          endPoint: .leading/.trailing)`. `pointerEvents="none"` on the outer `View` already covers
          this layer — it needs no touch handling of its own. */}
      <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <Defs>
          <LinearGradient
            id={GRADIENT_ID}
            x1={isFwd ? '1' : '0'}
            y1="0"
            x2={isFwd ? '0' : '1'}
            y2="0"
          >
            <Stop offset="0" stopColor="#000000" stopOpacity={SCRIM_EDGE_OPACITY} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${GRADIENT_ID})`} />
      </Svg>
      <View
        style={{
          alignItems: 'center',
          gap: 6,
          paddingRight: isFwd ? EDGE_INSET : 0,
          paddingLeft: isFwd ? 0 : EDGE_INSET,
        }}
      >
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 24 * theme.fontScale,
            fontWeight: '800',
          }}
        >
          10
        </Text>
        <View
          style={{
            flexDirection: 'row',
            gap: 4,
            transform: isFwd ? undefined : [{ scaleX: -1 }],
          }}
        >
          <SeekHornGlyph opacity={0.3} />
          <SeekHornGlyph opacity={0.5} />
          <SeekHornGlyph opacity={1} />
        </View>
      </View>
    </View>
  );
}
