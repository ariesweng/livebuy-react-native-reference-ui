// foregroundResumeController — pure resume state machine (rn-refui-pip-pause-foreground-resume).
//
// RN parity of iOS `ForegroundResumeController` (`ios-refui-pip-pause-foreground-resume`,
// `ios/Sources/LivebuyReferenceUI/Container/LivebuyPlayer.swift`). It decides whether — and WHEN —
// to resume a drop-in player that was auto-paused while the App was backgrounded, covering BOTH
// background-pause sources:
//   (a) FALLBACK PAUSE (PiP impossible) → resume IMMEDIATELY on foreground return;
//   (b) REAL OS PiP + user pauses IN the PiP window → DEFER: on foreground return PiP is still active
//       (`isInPiP`), so record the intent and let `pipDidExit()` do the single resume once PiP truly
//       ends (`PIP_STATE_CHANGE` active→false). AVKit's PiP restore only RE-PARENTS the video, it does
//       NOT un-pause a stream the user paused in the PiP window — so without this the frame stays
//       frozen and the container must own the resume.
//
// iOS-ONLY concern: the container wires this ONLY on iOS (`Platform.OS === 'ios'`). Android is N/A —
// RN Android's `LivebuyPlayerView` runs ExoPlayer, which honestly pauses/resumes and has no AVKit
// re-parent-without-unpause defect. This module is PURE (no `react-native` / core import), so every
// branch unit-tests in isolation — exactly like the iOS `ForegroundResumeControllerTests`.
//
// INVARIANTS (three guards, mirroring iOS):
//   1. never resume without a prior `appDidEnterBackground` (the `armed` latch starts false, so an
//      initial / spurious foreground does nothing);
//   2. a genuine PiP return does NOT resume immediately — it DEFERS to `pipDidExit()`;
//   3. `resumeOnPiPExit` is set ONLY inside `appWillEnterForeground` (App is FOREGROUND), so a PiP
//      closed while the App is still backgrounded (no foreground return) leaves it false →
//      `pipDidExit()` does NOT resume. The resume action (`play()`) is idempotent, so "returned
//      without pausing in PiP" is a harmless no-op.

/** Environment seams injected by the container — all pure closures, no RN / UIKit dependency. */
export interface ForegroundResumeSeams {
  /**
   * Was the player playing at the moment we entered background? The container backs this with the
   * SDK `VIDEO_STATE_CHANGE` stream (`params.state === 'playing'`). The resume gate MUST use THIS
   * latch (captured at background), NOT a live "is currently paused" read: the IVS live backend never
   * reports `.paused` (a backgrounded live stays stale-`.playing`), so a live-state gate would never
   * fire for live — the exact case the user reported.
   */
  readonly isPlaying: () => boolean;
  /**
   * Is the App CURRENTLY in real OS PiP? The container backs this with the SDK `PIP_STATE_CHANGE`
   * stream (`params.active`). Read FRESH on every foreground so a genuine PiP return can be DEFERRED
   * to the moment PiP actually ends.
   */
  readonly isInPiP: () => boolean;
  /**
   * Resume playback — the container calls the core ref's `play()` (idempotent; un-freezes both VOD and
   * IVS live). MUST NOT be a "back-to-live" seek, which is a no-op for a merely-paused (not scrubbed)
   * live.
   */
  readonly resume: () => void;
}

/** The pure resume state machine (RN parity of iOS `ForegroundResumeController`). */
export interface ForegroundResumeController {
  /**
   * Entering background: latch "was playing". For the reported real-PiP case this runs while the video
   * is still playing in the PiP window (PiP entry does not pause), so the latch captures the pre-pause
   * playing state before any in-PiP pause.
   */
  appDidEnterBackground(): void;
  /**
   * Returning to foreground. Only acts when we were playing when backgrounded (`armed`):
   *  - NOT in PiP (fallback-pause case) → resume IMMEDIATELY;
   *  - still in PiP (user paused in the PiP window) → do NOT resume now; record `resumeOnPiPExit` so
   *    `pipDidExit()` resumes once PiP truly ends.
   * Always clears `armed` afterward (the intent, if any, has been transferred to `resumeOnPiPExit`).
   */
  appWillEnterForeground(): void;
  /**
   * PiP truly ended (`PIP_STATE_CHANGE` active→false, forwarded by the container's internal listener).
   * Fires the ONE deferred `appWillEnterForeground`-in-PiP resume, then clears the intent. A PiP
   * dismissed while the App is still backgrounded leaves `resumeOnPiPExit` false → no resume.
   */
  pipDidExit(): void;
}

/** Build a fresh {@link ForegroundResumeController} bound to the given seams. */
export function createForegroundResumeController(
  seams: ForegroundResumeSeams,
): ForegroundResumeController {
  // Was the player playing before backgrounding? (the was-playing latch).
  let armed = false;
  // Deferred-resume intent for the "real PiP → user paused in PiP → returned to App" case: set true in
  // `appWillEnterForeground` when returning WHILE still in PiP; consumed once by `pipDidExit()`.
  let resumeOnPiPExit = false;

  return {
    appDidEnterBackground(): void {
      armed = seams.isPlaying();
    },

    appWillEnterForeground(): void {
      if (armed) {
        if (seams.isInPiP()) {
          // Real PiP: defer to `pipDidExit()` (don't contend with AVKit's in-flight restore).
          resumeOnPiPExit = true;
        } else {
          // Fallback pause: resume immediately.
          seams.resume();
        }
      }
      armed = false;
    },

    pipDidExit(): void {
      if (resumeOnPiPExit) {
        seams.resume();
        resumeOnPiPExit = false;
      }
    },
  };
}
