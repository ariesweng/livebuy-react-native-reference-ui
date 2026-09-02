// SpeakerGlyphs — self-drawn speaker/mute icons (player-gesture-feedback-overlays-rn).
//
// Spec: `reference-ui-rendering/spec.md` §「livebuy-react-native-reference-ui player-shell 影片區
//   單擊依直播/VOD 分流靜音或播放暫停，長按切換乾淨模式」（新增暫停覆蓋層與靜音 toast 元件段落）.
// Parity: iOS SF Symbol `speaker.slash.fill` / `speaker.wave.2.fill`
//   (`GestureMuteToastView.swift` / `PlaybackPausedOverlayView.swift`) and Android
//   `IconGlyphs.kt`'s `SpeakerSlashGlyph` / `SpeakerWaveGlyph` (Material `volume_off` /
//   `volume_up`, 24-viewBox). The path data below is copied VERBATIM from Android's
//   `IconGlyphs.kt` — do NOT hand-redraw or approximate.
//
// Unlike this package's older "draw a glyph via plain Views" convention (`ShareGlyph` /
// `BagGlyph` / `PersonEditGlyph`, predating the `react-native-svg` dependency), a speaker + sound-
// wave silhouette has genuine curves that a border-trick View composition cannot reproduce
// faithfully. `react-native-svg` is already a package dependency (`feedwin/GiftGlyphPaths.ts` +
// `ActivitySheetView.tsx` already render `<Svg><Path .../></Svg>`), so these two glyphs follow
// that established SVG precedent instead.

import type { ReactElement } from 'react';
import Svg, { Path } from 'react-native-svg';

/** `speaker.slash.fill` parity (muted state) — Material `volume_off`, 24-viewBox, filled.
 *  Path data copied verbatim from Android `IconGlyphs.kt`'s `SpeakerSlashGlyph`. */
const SPEAKER_SLASH_D =
  'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 ' +
  '1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 ' +
  '5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 ' +
  '1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 ' +
  '12 8.18V4z';

/** `speaker.wave.2.fill` parity (unmuted state) — Material `volume_up`, 24-viewBox, filled.
 *  Path data copied verbatim from Android `IconGlyphs.kt`'s `SpeakerWaveGlyph`. */
const SPEAKER_WAVE_D =
  'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 ' +
  '2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 ' +
  '7-4.49 7-8.77s-2.99-7.86-7-8.77z';

export interface SpeakerGlyphProps {
  readonly color: string;
  readonly size?: number;
}

/** Muted speaker glyph (slash through a speaker cone). Default size 24 (Material viewBox). */
export function SpeakerSlashGlyph(props: SpeakerGlyphProps): ReactElement {
  const { color, size = 24 } = props;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d={SPEAKER_SLASH_D} />
    </Svg>
  );
}

/** Unmuted speaker glyph (speaker cone + two sound-wave arcs). Default size 24 (Material viewBox). */
export function SpeakerWaveGlyph(props: SpeakerGlyphProps): ReactElement {
  const { color, size = 24 } = props;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d={SPEAKER_WAVE_D} />
    </Svg>
  );
}
