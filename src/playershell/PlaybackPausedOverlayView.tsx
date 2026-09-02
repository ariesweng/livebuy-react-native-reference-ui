// PlaybackPausedOverlayView — family-1 centre paused overlay (interactive), RN sibling of iOS
// `PlaybackPausedOverlayView.swift` / Android `GestureFeedbackViews.kt`'s
// `PausedCenterControlsView` (player-gesture-feedback-overlays-rn).
//
// ⚠️ RETIRED (rb-rn-gesture-clean-mode-v2): this view is no longer composed by
// `PlayerShellView` — VOD/replay play/pause now lives on the existing
// `PlaybackProgressBarView` expanded-state small button instead (design R29 removed the
// central paused overlay entirely). The component definition, its `LBTestIDs
// .pausedOverlayMuteButton` / `.pausedOverlayResumeButton` ids, and its own standalone
// structural snapshot tests (`PlaybackPausedOverlayView.test.tsx`) are all kept-but-unused
// (retired-but-kept, mirroring this package's existing convention for a leaf component whose
// container call site is removed while the leaf itself stays independently renderable/testable).
//
// Spec: `reference-ui-rendering/spec.md` §「livebuy-react-native-reference-ui player-shell 影片區
//   單擊依直播/VOD 分流靜音或播放暫停，長按切換乾淨模式」（新增暫停覆蓋層與靜音 toast 元件段落）.
// Design: `design/templates/minimal/screens.jsx:342-372` (the `isMain && paused` block) — two
//   stacked glass buttons (mute-toggle 44px, resume 64px), `rgba(0,0,0,0.45)` fill.
//
// HISTORICAL (pre-rb-rn-gesture-clean-mode-v2): was driven by the REAL playback state
// (`PlayerShellView` composed it ⟺ `showsPlaybackPausedOverlay(...)`, a pure function that has
// since been removed entirely — see this file's RETIRED note above) and stayed up — and stayed
// INTERACTIVE — for as long as the engine was actually paused, however that pause was triggered
// (a VOD/replay tap, or an SDK-internal lifecycle pause). `PlayerShellView` no longer composes
// this view at all, so none of that wiring applies anymore; kept for historical context only.
//
// PURE presentation: reads only its passed-in values, owns no state, and never reaches back into
// `PlayerShellModel` (one-way data flow). Both buttons forward to host-wired closures the shell
// already owns:
//   - 靜音切換 (44px) → `onToggleMute` (the SAME closure the video-area tap uses on a LIVE stream —
//     this overlay only ever shows for a NON-live stream, but the mute affordance is still
//     meaningful there, per the design's paused overlay).
//   - 播放恢復 (64px) → `onResume` (`PlayerShellView` wires this to `model.togglePlayPause()`; since
//     the overlay only shows while genuinely paused, "toggle" here always means "resume").

import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';

import type { ReferenceUITheme } from '../theme';
import { LBTestIDs } from '../testing/LBTestIDs';
import { SpeakerSlashGlyph, SpeakerWaveGlyph } from './SpeakerGlyphs';

export interface PlaybackPausedOverlayViewProps {
  readonly theme: ReferenceUITheme;
  /** The CURRENT mute state (`PlayerShellModel.muted`) — selects the mute-button glyph, matching
   *  `GestureMuteToastView`'s icon convention. */
  readonly muted: boolean;
  /** Tap the mute-toggle button → host-wired mute forwarder (the SAME closure the video-area
   *  tap-to-mute gesture uses). `undefined` → the button renders but is inert (demo / snapshot). */
  readonly onToggleMute?: () => void;
  /** Tap the resume button → resume playback. `PlayerShellView` wires this to
   *  `model.togglePlayPause()`. `undefined` → inert (demo / snapshot). */
  readonly onResume?: () => void;
}

/** Mute-toggle button diameter (design 44px). */
const MUTE_BUTTON_SIZE = 44;
/** Resume button diameter (design 64px). */
const RESUME_BUTTON_SIZE = 64;
/** Vertical gap between the two buttons (design 14px). */
const BUTTONS_GAP = 14;
/** Translucent dark-glass circle fill (design `rgba(0,0,0,0.45)`). */
const GLASS = 'rgba(0,0,0,0.45)';
/** Resume button's play-triangle glyph size (design 28px, matches iOS/Android). */
const PLAY_GLYPH_SIZE = 28;

/** The centred, interactive "paused" overlay: a mute-toggle button (44px) stacked above a
 *  play/resume button (64px), both on translucent dark-glass circles. */
export function PlaybackPausedOverlayView(props: PlaybackPausedOverlayViewProps): ReactElement {
  const { theme, muted, onToggleMute, onResume } = props;
  return (
    <View style={{ alignItems: 'center', gap: BUTTONS_GAP }}>
      <Pressable
        testID={LBTestIDs.pausedOverlayMuteButton}
        onPress={() => onToggleMute?.()}
        style={{
          width: MUTE_BUTTON_SIZE,
          height: MUTE_BUTTON_SIZE,
          borderRadius: MUTE_BUTTON_SIZE / 2,
          backgroundColor: GLASS,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {muted ? (
          <SpeakerSlashGlyph color="#FFFFFF" size={18} />
        ) : (
          <SpeakerWaveGlyph color="#FFFFFF" size={18} />
        )}
      </Pressable>

      <Pressable
        testID={LBTestIDs.pausedOverlayResumeButton}
        onPress={() => onResume?.()}
        style={{
          width: RESUME_BUTTON_SIZE,
          height: RESUME_BUTTON_SIZE,
          borderRadius: RESUME_BUTTON_SIZE / 2,
          backgroundColor: GLASS,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ResumePlayGlyph size={PLAY_GLYPH_SIZE} />
      </Pressable>
    </View>
  );
}

/** Self-drawn play (triangle, CSS border-trick) glyph — white, equivalent geometry to this
 *  package's established `PlaybackProgressBarView.PlayPauseGlyph` (`isPlaying: false` branch). Not
 *  a shared import — kept local so this overlay's button doesn't reach into a sibling module's
 *  private helper; the two are free to diverge if either surface's design changes independently. */
function ResumePlayGlyph(props: { size: number }): ReactElement {
  const { size } = props;
  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      pointerEvents="none"
    >
      <View
        style={{
          width: 0,
          height: 0,
          marginLeft: size * 0.12,
          borderTopWidth: size / 2,
          borderBottomWidth: size / 2,
          borderLeftWidth: size,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: '#FFFFFF',
        }}
      />
    </View>
  );
}
