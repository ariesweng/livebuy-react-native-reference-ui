// GestureMuteToastView — family-1 centre mute toast (0.7s tap feedback), RN sibling of iOS
// `GestureMuteToastView.swift` / Android `GestureFeedbackViews.kt`'s `GestureMuteToastView`
// (player-gesture-feedback-overlays-rn).
//
// Spec: `reference-ui-rendering/spec.md` §「livebuy-react-native-reference-ui player-shell 影片區
//   單擊依直播/VOD 分流靜音或播放暫停，長按切換乾淨模式」（新增暫停覆蓋層與靜音 toast 元件段落）.
// Design: `design/templates/minimal/sdk-components.jsx` `LBPGestureHint`「點擊靜音」.
//
// The small centred toast shown for ~0.7s after a video-area TAP toggles mute (once the LIVE
// branch's deferred mute-commit actually fires — see `PlayerShellView.tsx`'s `handleLiveTap()`).
// PURE presentation: reads only `muted` (the resulting mute state, `PlayerShellModel.muted`) and
// paints a speaker glyph + label on a dark-glass pill. Owns NO timer of its own — `PlayerShellView`
// drives its transient presentation (a local `muteToastVisible` state + a `setTimeout`). Renders
// correctly standalone (demo / snapshot).

import type { ReactElement } from 'react';
import { View } from 'react-native';
import { Text } from '../TightText';

import type { ReferenceUITheme } from '../theme';
import { LBTestIDs } from '../testing/LBTestIDs';
import { SpeakerSlashGlyph, SpeakerWaveGlyph } from './SpeakerGlyphs';

export interface GestureMuteToastViewProps {
  readonly theme: ReferenceUITheme;
  /** The resulting mute state to reflect (read from `PlayerShellModel.muted`). `true` → 靜音
   *  (slash glyph); `false` → 聲音開啟 (wave glyph). */
  readonly muted: boolean;
}

const MUTED_LABEL = '靜音';
const UNMUTED_LABEL = '聲音開啟';
/** Dark-glass pill surface (design `rgba(20,20,24,0.78)`, parity iOS/Android `glass`). */
const TOAST_GLASS = 'rgba(20,20,24,0.78)';

/** The centred mute toast: a dark-glass pill with a speaker glyph + a state label. */
export function GestureMuteToastView(props: GestureMuteToastViewProps): ReactElement {
  const { theme, muted } = props;
  return (
    <View
      testID={LBTestIDs.gestureMuteToast}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 999,
        backgroundColor: TOAST_GLASS,
        paddingHorizontal: 16,
        paddingVertical: 10,
      }}
    >
      {muted ? (
        <SpeakerSlashGlyph color="#FFFFFF" size={18} />
      ) : (
        <SpeakerWaveGlyph color="#FFFFFF" size={18} />
      )}
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: 14 * theme.fontScale,
          fontWeight: '600',
        }}
      >
        {muted ? MUTED_LABEL : UNMUTED_LABEL}
      </Text>
    </View>
  );
}
