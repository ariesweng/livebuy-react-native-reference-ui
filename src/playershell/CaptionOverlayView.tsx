// CaptionOverlayView — family-1 VOD closed-caption line (rb-react-native-subtitle-vtt-caption-display).
//
// Spec: `reference-ui-rendering/spec.md` §「渲染 RN CaptionOverlay VOD 字幕（CC）」.
// RN sibling of iOS `CaptionOverlayView.swift` / Android `CaptionOverlayView.kt`
// (rb-ios-subtitle-vtt-caption-display / rb-android-subtitle-vtt-caption-display).
// Design: `design/templates/minimal/sdk-components.jsx` `LBPCaptionOverlay` — a centered caption
//         line near the bottom, shown only while CC is ON.
//
// There is NO public core source for the active subtitle TEXT today (only
// `SubtitleTrack.{available,enabled}` booleans, mirrored as `PlayerShellModel.subtitleEnabled`) —
// the text is HOST-SUPPLIED (the turnkey container fetches + parses `channel.subtitle_url`, a
// WebVTT file, via `VTTSubtitleParser`). `PlayerShellView` gates this view's presence
// (`shouldShowCaptionOverlay`) and passes the currently-active cue text. Pure presentation —
// renders nothing for empty text.

import type { ReactElement } from 'react';
import { View } from 'react-native';
import { Text } from '../TightText';

import type { ReferenceUITheme } from '../theme';
import { LBTestIDs } from '../testing/LBTestIDs';

export interface CaptionOverlayViewProps {
  readonly theme: ReferenceUITheme;
  /** The currently-active caption text. Empty -> renders nothing. */
  readonly text: string;
}

/**
 * A centered VOD closed-caption line: white text on a translucent black capsule, up to 2 lines,
 * centered. Renders `null` for empty `text` (the shell only mounts this while CC is on with a
 * non-empty caption — see `shouldShowCaptionOverlay` in `PlayerShellView`).
 */
export function CaptionOverlayView(props: CaptionOverlayViewProps): ReactElement | null {
  const { theme, text } = props;
  if (text.length === 0) return null;
  return (
    <View
      testID={LBTestIDs.captionOverlay}
      style={{
        maxWidth: '92%',
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}
    >
      <Text
        numberOfLines={2}
        style={{
          color: '#FFFFFF',
          fontSize: 13 * theme.fontScale,
          fontWeight: '500',
          textAlign: 'center',
        }}
      >
        {text}
      </Text>
    </View>
  );
}
