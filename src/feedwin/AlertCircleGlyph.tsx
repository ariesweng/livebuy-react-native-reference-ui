import type { ReactElement } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

// MARK: - AlertCircleGlyph — self-drawn "alert circle" icon (design `moments.jsx` failSvg).
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-icon-parity-winclaim-fail-badge-shape).
// Design: `design/templates/minimal/moments.jsx` `failSvg` (24px viewBox, stroke 2, fill none) —
// a ring + exclamation bar + dot:
//   ring  <circle cx=12 cy=12 r=9/>
//   bar   <line x1=12 y1=8 x2=12 y2=12.5/>
//   dot   <line x1=12 y1=16 x2=12 y2=16/> (a zero-length line — rendered here as a filled dot,
//         matching Android's concrete `drawCircle(radius=1.1)` for the same visual intent)
//
// Parity: this is the RN counterpart of iOS SF Symbol `exclamationmark.circle` and Android
// `IconGlyphs.kt`'s `AlertCircleGlyph` composable (`drawCircle(radius=9, style=Stroke)` +
// `strokePath(D_ALERT_BAR = "M12 8v4.5")` + `drawCircle(radius=1.1)`) — coordinates copied
// verbatim from the Android implementation (the most complete/annotated of the three existing
// platforms) rather than hand-redrawn. RN uses `react-native-svg`'s `Circle`/`Path` primitives
// directly (mirroring `playershell/DetailGlyph.tsx`'s convention of individual shape primitives
// over one composite `<Path>` d string) instead of collapsing the ring into a path.
//
// NOT interchangeable with `productsheets/WarningGlyph` (a TRIANGULAR warning mark, parity of
// iOS `exclamationmark.triangle` — a different semantic). This glyph is the round "claim failed"
// mark; `WarningGlyph` stays untouched for its own (unrelated) call sites. Keep both.
//
// Pure presentation: only `color` / `size` props, no state.

export interface AlertCircleGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** The design's alert-circle glyph, hand-drawn to match `failSvg` / Android `AlertCircleGlyph`.
 *  Default size 24 (design viewBox); `WinClaimSheetView` call sites use `size={16}` / `size={30}`.
 *  Ring + bar inherit the `<Svg>`-level ambient `stroke`/`strokeWidth`/`strokeLinecap` (same
 *  convention as `playershell/DetailGlyph.tsx`'s frame + row lines); only the filled exclamation
 *  dot overrides `fill`/`stroke` explicitly, since it is solid rather than stroked. */
export function AlertCircleGlyph(props: AlertCircleGlyphProps): ReactElement {
  const { color, size = 24 } = props;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    >
      {/* Ring — stroked circle (design `<circle cx=12 cy=12 r=9/>`). */}
      <Circle cx={12} cy={12} r={9} />
      {/* Exclamation bar — (Android `D_ALERT_BAR = "M12 8v4.5"`). */}
      <Path d="M12 8v4.5" />
      {/* Exclamation dot at (12,16), r=1.1 (Android `drawCircle(radius=1.1)`), filled not stroked. */}
      <Circle cx={12} cy={16} r={1.1} fill={color} stroke="none" />
    </Svg>
  );
}
