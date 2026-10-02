// muteIconSeed — seeds the drop-in player's mute icon from the wrapped native Player's ACTUAL
// mute state (rb-rn-drop-in-mute-icon-seed-wiring, reference-ui layer).
//
// WHY: the native core keeps the user's mute preference for the whole app session, so a player
// that is closed and reopened starts with the SAME audio mute state. The icon truth, however,
// lives in the template (`playerHeaderState.muted`), which `attachPlayerTemplate` seeds `false`.
// Without a query the reopened player is silent while its icon says "sound on" — and because a
// tap toggles from the ICON's value, the first tap then does nothing audible.
//
// This module is PURE (no `react` / `react-native` / core value import): the container injects
// the native query and the template handle, so every race below is unit-testable with fakes.
//
// What it decides, in one place:
//   • a query result is written only while it is still FRESH — not after the container let go of
//     the template (unbind, which the container does on unmount and on re-attach), not after the shown video changed (`reset`), and never once
//     anything else has written the icon (a user tap) since the seed last wrote it;
//   • a `false` result obtained BEFORE the native Player is known to exist is NOT evidence: the
//     core bridge resolves `false` for "no native Player yet" (iOS creates it on the first `load`),
//     so such a result is ignored and the query is repeated once the Player is known to exist;
//   • a `true` result is always evidence (only a real native Player reports it);
//   • a failed query (rejection / throw) changes nothing and is not retried until the next
//     `reset` / re-bind.
//
// The last value this JS runtime saw is remembered across container instances (`MuteIconMemory`)
// and applied synchronously at bind time, so the usual "muted here, closed, reopened" path shows
// the right icon from the first frame instead of after a bridge round trip. The native query stays
// authoritative and corrects the remembered value when they disagree.

/** The template-side handle the seed reads / writes (built from a `PlayerTemplateAttachment`). */
export interface MuteIconSeedTarget {
  /** The icon truth right now (`template.playerHeaderState.muted`). */
  muted(): boolean;
  /** Write the icon truth (`attachment.handleMutedChange`). */
  apply(muted: boolean): void;
  /** Coalesced template change subscription; returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
}

/** Last icon value seen in this JS runtime; `undefined` until one is known. */
export interface MuteIconMemory {
  get(): boolean | undefined;
  set(muted: boolean): void;
}

export interface MuteIconSeedDeps {
  /**
   * Reads the wrapped native Player's mute state (`playerRef.current?.isMuted()`). May return
   * `undefined` (no ref — read as "no native Player yet"), throw, or reject (a failed query).
   */
  readonly queryNative: () => Promise<boolean> | undefined;
  /** Defaults to the process-wide memory shared by every drop-in player in this JS runtime. */
  readonly memory?: MuteIconMemory;
}

export interface MuteIconSeed {
  /**
   * The value for `attachPlayerTemplate({ queryIsMuted })`. Never throws and never rejects. It
   * resolves to the value the template should hold: the native answer when that answer is fresh
   * evidence, otherwise the icon's CURRENT value (so the seam's own write changes nothing).
   */
  readonly queryIsMuted: () => Promise<boolean>;
  /**
   * Bind the freshly attached template: applies the remembered value (if any) synchronously and
   * starts watching for writes made by anyone else. Returns the unbind function (call it before
   * `detach()`, i.e. on unmount and on re-attach); unbinding discards every in-flight result and
   * nothing is written until the next `bind`.
   */
  bind(target: MuteIconSeedTarget): () => void;
  /** The native Player is now known to exist (first channel info for this view arrived). */
  playerReady(): void;
  /** The shown video changed (reload / in-place switch): discard in-flight results, ask again. */
  reset(): void;
}

let sharedMuted: boolean | undefined;

/** Process-wide memory shared by every drop-in player container in this JS runtime. */
export const sharedMuteIconMemory: MuteIconMemory = {
  get: () => sharedMuted,
  set: (muted: boolean): void => {
    sharedMuted = muted;
  },
};

/** Test-only: forget the remembered value. */
export function _resetMuteIconMemoryForTesting(): void {
  sharedMuted = undefined;
}

/** Adapts the two template members the seed needs; kept structural so tests can pass fakes. */
export function muteIconSeedTarget(attachment: {
  readonly template: { readonly playerHeaderState: { readonly muted: boolean } };
  handleMutedChange(muted: boolean): void;
  subscribe(listener: () => void): () => void;
}): MuteIconSeedTarget {
  return {
    muted: () => attachment.template.playerHeaderState.muted,
    apply: (muted) => attachment.handleMutedChange(muted),
    subscribe: (listener) => attachment.subscribe(listener),
  };
}

interface SeedState {
  target: MuteIconSeedTarget | null;
  /** Bumped whenever in-flight results must be discarded. */
  generation: number;
  /** The native Player is known to exist. */
  ready: boolean;
  /** A query issued while `ready` has been answered (or a query failed): stop asking. */
  settled: boolean;
  /** Someone else wrote the icon since the seed last did: the seed never writes again. */
  owned: boolean;
  /** The icon value the seed last decided / observed. */
  lastSeen: boolean;
  inFlight: boolean;
}

/**
 * `undefined` = the query FAILED (threw / rejected). A missing ref reads `false`, exactly like the
 * bridge's own "no native Player yet" answer, so it is weighed by the same readiness rule.
 */
async function askNative(deps: MuteIconSeedDeps): Promise<boolean | undefined> {
  try {
    const pending = deps.queryNative();
    if (pending == null) return false;
    return (await pending) === true;
  } catch {
    return undefined;
  }
}

/**
 * The value to write for a native answer, or `undefined` for "write nothing". Runs synchronously
 * after the answer arrives, so nothing can interleave between the checks and the write.
 */
function decide(
  state: SeedState,
  memory: MuteIconMemory,
  issued: { generation: number; ready: boolean },
  answer: boolean | undefined,
): boolean | undefined {
  if (state.target == null) return undefined;
  if (issued.generation !== state.generation || state.owned) return undefined;
  if (answer === undefined) {
    state.settled = true;
    return undefined;
  }
  if (!answer && !issued.ready) return undefined; // "no native Player yet" also reads `false`
  if (issued.ready) state.settled = true;
  memory.set(answer);
  state.lastSeen = answer;
  return answer;
}

export function createMuteIconSeed(deps: MuteIconSeedDeps): MuteIconSeed {
  const memory = deps.memory ?? sharedMuteIconMemory;
  const state: SeedState = {
    target: null,
    generation: 0,
    ready: false,
    settled: false,
    owned: false,
    lastSeen: false,
    inFlight: false,
  };

  const ask = async (): Promise<boolean | undefined> => {
    const issued = { generation: state.generation, ready: state.ready };
    state.inFlight = true;
    const answer = await askNative(deps);
    if (issued.generation === state.generation) state.inFlight = false;
    return decide(state, memory, issued, answer);
  };

  const askAgainIfNeeded = (): void => {
    if (state.target == null || !state.ready) return;
    if (state.owned || state.settled || state.inFlight) return;
    void ask().then((value) => {
      if (value !== undefined) state.target?.apply(value);
      else askAgainIfNeeded(); // e.g. an unready `false` landed after the Player became ready
    });
  };

  const onTemplateChange = (): void => {
    const now = state.target?.muted();
    if (now === undefined || now === state.lastSeen) return;
    // Not written by the seed → a user tap (or the host). From here on the icon is theirs.
    state.lastSeen = now;
    state.owned = true;
    memory.set(now);
  };

  const discardInFlight = (): void => {
    state.generation += 1;
    state.inFlight = false;
    state.settled = false;
  };

  return {
    queryIsMuted: async (): Promise<boolean> => {
      const value = await ask();
      if (value !== undefined) return value;
      askAgainIfNeeded(); // the Player may have become ready while this query was in flight
      return state.target?.muted() ?? false;
    },
    bind(target: MuteIconSeedTarget): () => void {
      state.target = target;
      state.owned = false;
      const remembered = memory.get();
      if (remembered !== undefined && remembered !== target.muted()) target.apply(remembered);
      state.lastSeen = target.muted();
      const unsubscribe = target.subscribe(onTemplateChange);
      return (): void => {
        unsubscribe();
        if (state.target === target) state.target = null;
        discardInFlight();
      };
    },
    playerReady(): void {
      state.ready = true;
      askAgainIfNeeded();
    },
    reset(): void {
      discardInFlight();
      state.ready = false;
    },
  };
}
