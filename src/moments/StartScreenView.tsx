// StartScreen — family-4 moments surface 1 (start-lifecycle) — RN .tsx.
//
// Spec: `reference-ui-rendering/spec.md` (family-4 moments, surface 1).
// RN parity of iOS `StartScreenView.swift`, Android `StartScreenView.kt`
// (rb-android-splash-skip-only), and Flutter `start_screen.dart`
// (rb-flutter-splash-skip-only) — splash redesigned to a lightweight skip-only overlay.
//
//   Mirrors the design's start components (moments.jsx, re-sync `c3c98733`):
//   `LBPLoadingOverlay` / `LBPBufferingSpinner` / `LBPSkipIntroButton`. Dispatches by
//   lifecycle `phase`:
//     • `loading`   全螢幕品牌載入 (full-bleed brand background + 17-frame brand
//                   loading-mark PNG-sequence animation ONLY (`LoadingMarkAnimation`,
//                   rb-rn-loading-mark-png-sequence, parity to iOS
//                   `LoadingMarkAnimationView`) — NO wordmark / NO 「載入中…」caption
//                   (removed, rb-rn-loading-announce-restyle, design re-sync `c3c98733`).
//     • `buffering` renders NOTHING (`null`).
//     • `splash`    the opening video plays through the NORMAL path with the subject
//                   chrome (LIVE / VOD) visible behind; the ONLY added UI is a
//                   bottom-right「略過介紹」skip pill. NO 片頭 tag / muted indicator /
//                   brand backdrop / title card / progress bar (all removed — 開場影片
//                   有聲、不接管畫面).
//     • `done`      不畫 (renders NOTHING — returns `null`).
//
// SUB-VIEW INPUT PATTERN (the contract documented in `MomentsView.tsx`):
//   1. `theme` (ReferenceUITheme)   — FIRST, always.
//   2. its bound SNAPSHOT VALUE     — `phase: StartScreenPhase`, the read-only
//      mirror of `DefaultStartScreenState.phase`, passed BY VALUE from
//      `MomentsModel.startPhase` (never the model, never the template).
//   3. one optional action callback — trailing, defaulting to a no-op (`onSkip`).
//      The container / host wires it to the core player exit (`Player.skipStart()`);
//      this surface does NOT own the skip intent and renders correctly with it
//      omitted (so demo / structural-snapshot tests construct it action-free).
//
// One-way data flow: this view reads ONLY its passed-in `phase` — it never reaches
// back into `MomentsModel` / `DefaultPlayerTemplate`, never holds a second copy of
// the phase, and NEVER drives the skip itself. The splash skip pill shows a STATIC
// label (`略過介紹`, NO countdown number — rb-ios-skip-intro-label-static, four-platform
// parity) — it NEVER counts down, and the surface NEVER calls `onSkip` on a timer.
// Tapping the pill only FORWARDS `onSkip`.
//
// RENDER DISCIPLINE (iOS / Android / Flutter lessons baked in): plain
// `View` / `Text` / `Pressable` only — NO ScrollView / FlatList / SectionList,
// NO network-uri Image, NO animation / random state (outside the ONE narrow exception
// below). Glyphs are deterministic Text glyphs.
//
// NO-ANIMATION RULE EXCEPTION (`.loading` ONLY — see spec.md ADDED requirement +
// `rb-rn-loading-mark-png-sequence` design.md): `.loading`'s brand mark is
// `LoadingMarkAnimation` (`./loading-mark/LoadingMarkAnimation.tsx`), a 17-frame PNG
// sequence played via `Image` sourced from a LOCAL bundled `require()` asset (NOT a
// network `uri`) driven by `setInterval`-ticked discrete state (NOT the RN `Animated`
// API). This is a narrowly-scoped carve-out of the "spinner 用 Text/View, 無動畫 /
// Animated" rule for THIS ONE brand mark only — every other constraint in this file
// (no ScrollView/FlatList, no network-uri Image, no Animated anywhere else) is
// UNCHANGED. `.buffering` / `.splash` / `.done` are untouched by this change.
//
// jsx automatic runtime — no `import React`. Returns `ReactElement` (NOT
// JSX.Element, which is absent under @types/react 19); `done` returns `null`.

import type { ReactElement } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '../TightText';

import { StartScreenPhase } from 'livebuy-react-native-ui';

import type { ReferenceUITheme } from '../theme';
import { LBTestIDs } from '../testing/LBTestIDs';
import { ChevronForwardGlyph } from './ChevronForwardGlyph';
import { LoadingMarkAnimation } from './loading-mark/LoadingMarkAnimation';

// MARK: - Fixed decorative design tokens (literal minimal hex / rgba)
//
// `accent` comes from the resolved `theme`. These are FIXED decorative colors lifted
// verbatim from the design's start components (`#0C0C10` brand backdrop,
// `rgba(20,20,24,0.6)` skip capsule) — they mirror the iOS / Android / Flutter
// `StartScreenView` static colors so the four platforms read as one family.

/** Loading brand backdrop (`background: '#0C0C10'`). */
const BRAND_BACKDROP = '#0C0C10';
/** Skip pill capsule fill — `rgba(20,20,24,0.6)`. */
const CHROME_FILL_SKIP = 'rgba(20,20,24,0.6)';
/** On-glass white. */
const ON_GLASS = '#FFFFFF';

// MARK: - Fixed localized copy (static presentation strings — parity to iOS/Android)

/** Skip-intro pill label — STATIC, NO countdown number (rb-ios-skip-intro-label-static,
 *  four-platform parity). The pill NEVER counts down and NEVER fires onSkip on a timer;
 *  tapping it only FORWARDS `onSkip`. */
const SKIP_LABEL = '略過介紹';

/** Props for the family-4 start-moment surface (SUB-VIEW INPUT PATTERN). */
export interface StartScreenProps {
  // -- 1. theme (FIRST, always) ----------------------------------------------
  /** The resolved reference-ui theme. */
  readonly theme: ReferenceUITheme;

  // -- 2. bound snapshot value (BY VALUE from MomentsModel.startPhase) --------
  /** The start lifecycle phase (`DefaultStartScreenState.phase`). Drives which
   *  branch renders: `loading` / `buffering` / `splash` / `done`. Read-only. */
  readonly phase: StartScreenPhase;

  // -- 3. optional action callback (LAST, defaulting to a no-op) -------------
  /** Splash「略過介紹」open intent → host → core `Player.skipStart()`. This surface
   *  does NOT own the skip; omitted → the pill renders correctly but is inert. */
  readonly onSkip?: () => void;
}

/**
 * The family-4 start-moment surface. Dispatches by `phase`: a full-screen brand
 * loader (`loading`), nothing (`buffering`), a lightweight bottom-right skip pill over
 * the playing opening video (`splash`), or nothing (`done` → `null`). Read-only — it
 * never skips itself; the skip pill only FORWARDS `onSkip` (host wires it to core
 * `skipStart()`).
 */
export function StartScreen(props: StartScreenProps): ReactElement | null {
  const { theme, phase } = props;
  switch (phase) {
    case StartScreenPhase.Loading:
      return renderLoading(theme);
    case StartScreenPhase.Buffering:
      // Renders NOTHING (rb-rn-intro-chrome-buffering-parity, parity to iOS): when the
      // playback engine stalls the canonical state stays `buffering`, so the phase stayed
      // Buffering and the central spinner remained stuck on screen. Draw nothing; initial-load
      // feedback is the Loading full-bleed brand loader.
      return null;
    case StartScreenPhase.Splash:
      return renderSplash(props);
    case StartScreenPhase.Done:
    default:
      // `done`: no overlay. The container short-circuits this branch, but the
      // sub-view stays self-consistent (renders nothing).
      return null;
  }
}

// MARK: - loading — full-bleed brand loader (design `phase === 'loading'`)

/** First load: a full-bleed dark brand background with ONLY the 17-frame brand
 *  loading-mark PNG-sequence animation (`background: '#0C0C10'`). The brand wordmark +
 *  「載入中…」caption are REMOVED (design re-sync `LBPLoadingOverlay`, commit `c3c98733`,
 *  `rb-rn-loading-announce-restyle`) — the design now shows the bare brand spinner only.
 *  `LoadingMarkAnimation` itself (the PNG-sequence playback) is unchanged (rb-rn-loading-
 *  mark-png-sequence, iOS parity — see the RENDER DISCIPLINE / NO-ANIMATION RULE EXCEPTION
 *  note above this file's imports). */
function renderLoading(theme: ReferenceUITheme): ReactElement {
  return (
    <View
      testID={LBTestIDs.momentLoading}
      style={{
        flex: 1,
        backgroundColor: BRAND_BACKDROP,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <LoadingMarkAnimation size={76} />
    </View>
  );
}

// MARK: - buffering — intentionally not rendered (rb-rn-intro-chrome-buffering-parity)

// MARK: - splash — skip-only overlay (bottom-right「略過介紹」skip pill)

/** The opening video plays through the NORMAL playback path with the subject chrome
 *  (LIVE / VOD) visible behind — 開場不接管畫面 (start is NOT a screen takeover). The
 *  ONLY added UI is a bottom-right「略過介紹」skip pill. NO 片頭 tag / muted indicator /
 *  brand backdrop / lower-third title card / progress bar (all removed per the latest
 *  design `LBPSkipIntroButton`). The overlay is transparent so the chrome behind shows
 *  through. Plain `View` + absolute-positioned skip pill. */
function renderSplash(props: StartScreenProps): ReactElement {
  const { theme, onSkip } = props;
  return (
    <View testID={LBTestIDs.momentStart} style={{ flex: 1 }}>
      <View style={{ position: 'absolute', right: 12, bottom: 16 }}>
        {renderSkipPill(theme, onSkip)}
      </View>
    </View>
  );
}

/** Bottom-right skip pill (`略過介紹` → onSkip). A translucent capsule with a soft
 *  shadow; the label is STATIC (pure presentation — NO countdown number; it NEVER counts
 *  down and the surface NEVER calls `onSkip` on any timer; rb-ios-skip-intro-label-static).
 *  Tapping FORWARDS `onSkip` (host-wired; inert when omitted). The fast-forward chevrons
 *  are a deterministic Text glyph. */
function renderSkipPill(theme: ReferenceUITheme, onSkip?: () => void): ReactElement {
  return (
    <Pressable onPress={onSkip} testID={LBTestIDs.momentStartSkip}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: CHROME_FILL_SKIP,
          borderRadius: 999,
          paddingHorizontal: 12,
          paddingVertical: 7,
          // Soft shadow (parity to iOS / Android / Flutter skip pill).
          shadowColor: '#000000',
          shadowOpacity: 0.3,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <Text style={{ color: ON_GLASS, fontSize: 13 * theme.fontScale, fontWeight: '600' }}>
          {SKIP_LABEL}
        </Text>
        <View style={{ width: 6 }} />
        {/* Fast-forward chevrons (the design's `M5 4l8 8…M14 4l6 8…` SVG):
            self-drawn open double chevron » (stroke), NOT a filled ⏩ emoji. */}
        <ChevronForwardGlyph color={ON_GLASS} size={13} />
      </View>
    </Pressable>
  );
}
