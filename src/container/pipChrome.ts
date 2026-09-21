// pipChrome — pure decision of whether the drop-in player's overlay chrome should render while
// Android OS Picture-in-Picture is active (rn-android-pip-hide-chrome-reference-ui).
//
// Parity source: Android native `:livebuy-reference-ui`'s `overlayChromeVisibleInPip` (see
// `archive/2026-07-14-android-pip-hide-player-chrome-reference-ui`). That change's own verification
// only checked the native bridge layer (`react-native/android/`) and concluded RN was a no-op
// ("wraps the headless core, no reference-ui chrome to hide") — that conclusion was wrong for RN:
// `react-native-reference-ui` is a pure TS/TSX package with NO native code of its own; it paints the
// ENTIRE header / product-card / chat chrome itself (see `container/LivebuyPlayer.tsx`'s single
// `resolveDesign(config.design).playerOverlay({...})` JSX gate). This module is the RN-side fix.
//
// PURE — zero `react-native` / `livebuy-react-native` import (same convention as
// `foregroundResumeController.ts` / `channelChrome.ts` / `subtitlePipeline.ts`): the caller passes
// `platformOS` explicitly (its own `Platform.OS` read) rather than this module importing `Platform`
// itself, so it stays independently unit-testable with zero RN mocking.
//
// **Android-only gate — do NOT drop the platform check.** `PIP_STATE_CHANGE` fires normally on iOS
// too (it already drives the existing iOS-only `rn-refui-pip-pause-foreground-resume` foreground-resume
// feature via `isInPiPRef`), but iOS's `AVPictureInPictureController` is video-layer-based — RN's chrome
// never enters the system PiP window in the first place, so hiding it there would be a pure UX
// regression (the user may still be browsing the rest of the app while PiP is active). Hiding chrome is
// therefore gated on BOTH `isInPip` AND `platformOS === 'android'`.

/**
 * Whether the drop-in player's overlay chrome (the single `playerOverlay(...)` JSX node) SHOULD
 * render right now. `false` only when Android OS PiP is active; `true` in every other case
 * (not in PiP, or any platform other than Android — including iOS, where PiP never hides chrome).
 */
export function overlayChromeVisibleInPip(isInPip: boolean, platformOS: string): boolean {
  return !(isInPip && platformOS === 'android');
}
