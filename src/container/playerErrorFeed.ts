// playerErrorFeed — decides which core errors reach the template's error-state model
// (rb-rn-dropin-playback-progress-and-error-wiring).
//
// `DefaultPlayerTemplate.handleError(type)` is host-fed and ALWAYS shows the error screen for
// whatever type it is given. The core's per-view error callback, however, carries more than
// terminal playback failures: chat / cart business errors arrive on the same callback while the
// video keeps playing. Feeding those through would cover a healthy player with an error card.
//
// Rule:
//   - Types that never concern playback are dropped.
//   - Types that are terminal for the LOAD itself (the video cannot be played at all) are fed at once.
//   - Anything else is fed only while the player is in `error` — when it arrives before the state
//     change, it is held and fed the moment the player enters `error`. A player that enters `error`
//     with no usable type on record is fed `networkError` (the generic playback-failure kind).
//   - Leaving `error` drops the held type; the template clears its own error state from the
//     unified state-change event.

/** Errors that never concern playback (chat / cart business errors). */
const NON_PLAYBACK_ERROR_TYPES: ReadonlySet<string> = new Set([
  'chatRateLimited',
  'guestNameTaken',
  'chatRequiresLogin',
  'notLive',
  'cartAddDeduplicated',
]);

/** Errors that mean the requested video cannot be played at all. */
const LOAD_TERMINAL_ERROR_TYPES: ReadonlySet<string> = new Set([
  'videoNotFound',
  'sdk_version_unsupported',
  'restricted',
  'invalidSignature',
]);

/** Type fed when the player enters `error` without a usable error type on record. */
export const PLAYER_ERROR_FALLBACK_TYPE = 'networkError';

/** PURE: `true` for an error type that must never raise the player error screen. */
export function isNonPlaybackErrorType(type: string): boolean {
  return NON_PLAYBACK_ERROR_TYPES.has(type);
}

/** PURE: `true` for an error type that is terminal for the load regardless of player state. */
export function isLoadTerminalErrorType(type: string): boolean {
  return LOAD_TERMINAL_ERROR_TYPES.has(type);
}

export interface PlayerErrorFeed {
  /** The core's per-view error callback (`LBError.type`). */
  onError(type: string): void;
  /** The core's player-state callback (canonical state name). */
  onStateChange(state: string): void;
}

/** Create the feed. `handleError` is the template's `handleError`. */
export function createPlayerErrorFeed(handleError: (type: string) => void): PlayerErrorFeed {
  let inError = false;
  let latest: string | null = null;
  return {
    onError(type: string): void {
      if (isNonPlaybackErrorType(type)) return;
      latest = type;
      if (inError || isLoadTerminalErrorType(type)) handleError(type);
    },
    onStateChange(state: string): void {
      const entering = state === 'error' && !inError;
      inError = state === 'error';
      if (entering) handleError(latest ?? PLAYER_ERROR_FALLBACK_TYPE);
      if (!inError) latest = null;
    },
  };
}
