// CcGlyph — self-drawn "closed captions" icon, THREE states (design R42: `ccOn` / `ccOff` /
// `ccUnavailable`, `design/shared/icons.jsx`). Supersedes the prior single hand-drawn badge glyph
// (`rb-rn-cc-icon-design-align`'s stroked rounded-rect + two "c" curves) — that shape is retired.
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-cc-icon-availability-redesign, "渲染 RN
// OperationRail 側欄 rail" + "LivebuyReferenceUI（RN）渲染 LIVE 底部 bar" Requirements).
// Design: `design/shared/icons.jsx` — `ccOn` (filled, viewBox `0 0 512 512`), `ccOff` (outline
// counterpart, same viewBox), `ccUnavailable` (fixed grey `#A0A0A0`, NON-square viewBox
// `0 0 24 22`, a Font-Awesome-style closed-captioning glyph in an 18×16 box). All three are
// fill-only cubic-bezier/line `<path>`s copied verbatim from the design source — no arc commands,
// no stroke styling (unlike the retired glyph, which was `stroke`-drawn).
//
// Parity: iOS/Android/Flutter siblings (rb-{ios,android,flutter}-cc-icon-availability-redesign)
// draw the same three path constants.
//
// State ownership (this component is a PURE presentation leaf — no state, no onPress):
//   - 'on'          — captions available AND currently enabled. Filled glyph, tinted by `color`
//                      (callers pick the active/accent tint).
//   - 'off'         — captions available but not currently enabled. Outline counterpart, tinted
//                      by `color` (callers pick the inactive/white tint).
//   - 'unavailable' — no caption source for this video. Fixed `#A0A0A0` — `color` is IGNORED for
//                      this state (design fixes it). Non-square 18×16 box: callers pass explicit
//                      `width`/`height` (NOT `size`) to get the `0 0 24 22` aspect ratio.
// Which state to draw, and what a tap on the containing pill does in each state (toggle captions
// vs show a short "未提供字幕" tooltip), is entirely the CALLER's responsibility — see
// `useCcUnavailableTooltip.ts` / `CcTooltip.tsx`, consumed by `OperationRailView.tsx`'s
// `CcRailPill` and `LiveBottomBarView.tsx`'s `chatClosed` CC slot.
//
// Replaces the plain-text `'CC'` `Text` glyph historically drawn at the side rail's Subtitle/CC
// pill and the LIVE bottom bar's `chatClosed` CC toggle — `railGlyphFor(LBSideRailKind.Subtitle)`
// still returns the literal `'CC'` string (UNCHANGED, not touched by this file), solely for the
// existing kind→glyph parity test; it has no bearing on what this component renders.

import type { ReactElement } from 'react';
import Svg, { Path } from 'react-native-svg';

export type CcGlyphState = 'on' | 'off' | 'unavailable';

export interface CcGlyphProps {
  /** Which of the three R42 states to draw. */
  readonly state: CcGlyphState;
  /** Fill color for `'on'` / `'off'`. IGNORED when `state === 'unavailable'` (design fixes that
   *  state's color to {@link CC_UNAVAILABLE_COLOR} regardless of what's passed here). Default
   *  `'#FFFFFF'`. */
  readonly color?: string;
  /** Square width/height fallback used when neither `width` nor `height` is given. Default `24`
   *  (the `on`/`off` viewBox's own scale). */
  readonly size?: number;
  /** Explicit width override (falls back to `size`). Needed for `'unavailable'`'s non-square
   *  18×16 box (design `icons.jsx` `Icon` base's width/height override, R42). */
  readonly width?: number;
  /** Explicit height override (falls back to `size`). */
  readonly height?: number;
}

/** `ccOn` — filled closed-captioning glyph (design `icons.jsx`, viewBox `0 0 512 512`). */
const CC_ON_PATH =
  'M464 64H48C21.5 64 0 85.5 0 112v288c0 26.5 21.5 48 48 48h416c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48zM218.1 287.7c2.8-2.5 7.1-2.1 9.2.9l19.5 27.7c1.7 2.4 1.5 5.6-.5 7.7-53.6 56.8-172.8 32.1-172.8-67.9 0-97.3 121.7-119.5 172.5-70.1 2.1 2 2.5 3.2 1 5.7l-17.5 30.5c-1.9 3.1-6.2 4-9.1 1.7-40.8-32-94.6-14.9-94.6 31.2.1 48 51.1 70.5 92.3 32.6zm190.4 0c2.8-2.5 7.1-2.1 9.2.9l19.5 27.7c1.7 2.4 1.5 5.6-.5 7.7-53.5 56.9-172.7 32.1-172.7-67.9 0-97.3 121.7-119.5 172.5-70.1 2.1 2 2.5 3.2 1 5.7L420 222.2c-1.9 3.1-6.2 4-9.1 1.7-40.8-32-94.6-14.9-94.6 31.2 0 48 51 70.5 92.2 32.6z';

/** `ccOff` — outline counterpart of {@link CC_ON_PATH} (design `icons.jsx`, same viewBox). */
const CC_OFF_PATH =
  'M464 64H48C21.5 64 0 85.5 0 112v288c0 26.5 21.5 48 48 48h416c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48zm-6 336H54c-3.3 0-6-2.7-6-6V118c0-3.3 2.7-6 6-6h404c3.3 0 6 2.7 6 6v276c0 3.3-2.7 6-6 6zm-211.1-85.7c1.7 2.4 1.5 5.6-.5 7.7-53.6 56.8-172.8 32.1-172.8-67.9 0-97.3 121.7-119.5 172.5-70.1 2.1 2 2.5 3.2 1 5.7l-17.5 30.5c-1.9 3.1-6.2 4-9.1 1.7-40.8-32-94.6-14.9-94.6 31.2 0 48 51 70.5 92.2 32.6 2.8-2.5 7.1-2.1 9.2.9l19.6 27.7zm190.4 0c1.7 2.4 1.5 5.6-.5 7.7-53.6 56.9-172.8 32.1-172.8-67.9 0-97.3 121.7-119.5 172.5-70.1 2.1 2 2.5 3.2 1 5.7L420 220.2c-1.9 3.1-6.2 4-9.1 1.7-40.8-32-94.6-14.9-94.6 31.2 0 48 51 70.5 92.2 32.6 2.8-2.5 7.1-2.1 9.2.9l19.6 27.7z';

/** `ccUnavailable` — fixed grey, non-square (design `icons.jsx`, viewBox `0 0 24 22`). */
const CC_UNAVAILABLE_PATH =
  'M21.3333 1.375H2.66667C1.19375 1.375 0 2.60605 0 4.125V17.875C0 19.3939 1.19375 20.625 2.66667 20.625H21.3333C22.8063 20.625 24 19.3939 24 17.875V4.125C24 2.60605 22.8042 1.375 21.3333 1.375ZM22 17.875C22 18.2541 21.7009 18.5625 21.3333 18.5625H2.66667C2.29908 18.5625 2 18.2541 2 17.875V4.125C2 3.74593 2.29908 3.4375 2.66667 3.4375H21.3333C21.7009 3.4375 22 3.74593 22 4.125V17.875ZM9.85417 9.54336C10.2448 9.94619 10.8775 9.94619 11.2683 9.54336C11.659 9.14053 11.659 8.48805 11.2683 8.085C9.70833 6.47625 7.17208 6.47625 5.61417 8.085C4.85417 8.86016 4.4375 9.9 4.4375 11C4.4375 12.1 4.81667 13.1377 5.60917 13.9167C6.38917 14.7211 7.4125 15.1233 8.43708 15.1233C9.46167 15.1233 10.4854 14.7211 11.265 13.9167C11.6556 13.5139 11.6556 12.8614 11.265 12.4584C10.8744 12.0555 10.2417 12.0555 9.85083 12.4584C9.07208 13.2627 7.80125 13.2627 7.02292 12.4584C6.64583 12.0699 6.4375 11.55 6.4375 11C6.4375 10.45 6.64583 9.93094 7.02333 9.54164C7.80417 8.73555 9.075 8.73555 9.85417 9.54336ZM17.8542 9.54336C18.2448 9.94619 18.8775 9.94619 19.2683 9.54336C19.659 9.14053 19.659 8.48805 19.2683 8.085C17.7083 6.47625 15.1721 6.47625 13.6142 8.085C12.8542 8.86016 12.4375 9.9 12.4375 11C12.4375 12.1 12.8167 13.1377 13.6092 13.9167C14.3892 14.7211 15.4125 15.1233 16.4371 15.1233C17.4617 15.1233 18.4854 14.7211 19.265 13.9167C19.6556 13.5139 19.6556 12.8614 19.265 12.4584C18.8744 12.0555 18.2417 12.0555 17.8508 12.4584C17.0721 13.2627 15.8012 13.2627 15.0229 12.4584C14.6458 12.0699 14.4375 11.55 14.4375 11C14.4375 10.45 14.6458 9.93094 15.0233 9.54164C15.8042 8.73555 17.075 8.73555 17.8542 9.54336Z';

/** Fixed color for `state === 'unavailable'` (design R42) — the `color` prop is ignored for
 *  this state. Exported so callers/tests can assert against the same constant. */
export const CC_UNAVAILABLE_COLOR = '#A0A0A0';

/** The design's three-state R42 closed-captioning glyph. `state === 'unavailable'` ignores
 *  `color` (fixed grey) and draws the non-square `0 0 24 22` viewBox; `'on'` / `'off'` draw the
 *  square `0 0 512 512` viewBox tinted by `color`. */
export function CcGlyph(props: CcGlyphProps): ReactElement {
  const { state, color = '#FFFFFF', size = 24, width, height } = props;
  const w = width ?? size;
  const h = height ?? size;

  if (state === 'unavailable') {
    return (
      <Svg width={w} height={h} viewBox="0 0 24 22">
        <Path d={CC_UNAVAILABLE_PATH} fill={CC_UNAVAILABLE_COLOR} stroke="none" />
      </Svg>
    );
  }

  return (
    <Svg width={w} height={h} viewBox="0 0 512 512">
      <Path d={state === 'on' ? CC_ON_PATH : CC_OFF_PATH} fill={color} stroke="none" />
    </Svg>
  );
}
