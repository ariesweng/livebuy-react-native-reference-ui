// MomentsModel — family-4 player moment-state read-only snapshot bridge (RN).
//
// Spec: `reference-ui-rendering/spec.md` (family-4 moments, 3 full-screen surfaces).
// Phase-4 RN sibling of the DONE iOS `MomentsModel.swift` (rb-ios-moments),
// Android `MomentsModel.kt` (rb-android-moments), and Flutter `moments_model.dart`
// (rb-flutter-moments).
//
// It bridges the headless template moment view-models exposed by
// `DefaultPlayerTemplate` (obtained at runtime by the host via
// `attachPlayerTemplate`) into a read-only snapshot the three family-4 RN surface
// components read. It is a pure read-only MIRROR — IDENTICAL pattern to family-1
// `PlayerShellModel` / family-2 `FeedWinModel` / family-3 `ProductSheetsModel`:
//
//   - It owns NO second copy of authoritative state. Every getter reads the
//     template's own public getter each call (`startScreenState.phase` /
//     `endScreenState.countdown` / `endScreenState.next` / `endScreenState.hot` /
//     `playerErrorState`), so there is nothing to drift from the template.
//   - It adds NO pixels and adds NO accessor / view-model to
//     `livebuy-react-native-ui` (a template-layer concern, out of scope here).
//
// ── CRITICAL: NO mutating forwarders (UNLIKE family-2/3) ─────────────────────────
//   Moments carry NO public template / player intent for skip / retry / watch-next /
//   pick-hot / cancel / dismiss — those are NOT template methods. The moment actions
//   are HOST-WIRED CONTAINER callbacks (like family-2's event-join / family-3's
//   product-tap), NOT model forwarders. So this model is a PURE read-only snapshot;
//   it carries NO mutating methods. The container (`MomentsView`) holds the
//   host-wired exits (`onSkip` / `onWatchNext` / `onPickHot` / `onCancel` /
//   `onRetry` / `onDismiss`). retry is a CORE player concern (the SDK auto-retries
//   3×/3s); this layer only forwards the CTA. Do NOT invent template forwarders —
//   none exist for moments (mirrors iOS / Android / Flutter `MomentsModel`, all pure
//   read-only snapshots).
//
// ── RN TEMPLATE BINDING NOTES (differ from the Flutter blueprint) ────────────────
//   Confirmed by reading react-native-ui/src/{MomentState.ts, ErrorState.ts,
//   DefaultTemplate.ts}:
//   • start is read via `template.startScreenState.phase` (`StartScreenPhase`,
//     camelCase string values: `loading` / `splash` / `buffering` / `done`) — the
//     RN template wraps it in a `{ phase }` snapshot, NOT a bare enum (iOS / Android
//     / Flutter expose the phase more directly).
//   • end is read via `template.endScreenState.{next, hot, countdown}`. The RN
//     value types are TEMPLATE-owned: `EndScreenNavRow` { id, title, cover } /
//     `EndScreenHotRow` { id, title, cover } / `EndScreenCountdown` { remain, total }.
//     ★ DELTA vs Flutter / iOS / Android: the RN template's `EndScreenHotRow` does
//       NOT carry a `duration` field (the bridge does not export `LBHotItem` with
//       duration; see MomentState.ts). The 熱門 surface still formats `mm:ss`, so a
//       reference-ui-local augmentation type [HotRow] = `EndScreenHotRow &
//       { duration?: number }` carries the SECONDS for demo seeds; a live-template
//       row (no duration) formats to a safe `"00:00"`. This is purely a
//       reference-ui presentational concern — it does NOT alter the template type.
//   • error is `template.playerErrorState: PlayerErrorState | null` with
//     `kind: PlayerErrorKind` (`stream` / `notFound` / `outdated`) +
//     `phase: PlayerErrorPhase.Failed`. `kind` is ALREADY classified by the template
//     (`errorKindFromType`); this layer MUST NOT re-classify.
//
// React components re-render via the container's `useState` + the template's
// coalesced `subscribe()` (ChangeEmitter); on each notify the container RE-READS
// these getters off a freshly-constructed read-only model (the model holds no state
// of its own). It just centralizes the read mapping + deterministic demo seeds
// (parity with the Flutter `MomentsModel`, which holds no Flutter state either).
//
// No react / react-native import here — pure reads + plain-literal demo seeds, so it
// stays unit-testable in a plain node environment.

import type { DefaultPlayerTemplate } from 'livebuy-react-native-ui';
import { StartScreenPhase, PlayerErrorKind, PlayerErrorPhase } from 'livebuy-react-native-ui';
import type {
  StartScreenState,
  EndScreenCountdown,
  EndScreenNavRow,
  EndScreenHotRow,
  PlayerErrorState,
} from 'livebuy-react-native-ui';

/**
 * Reference-ui-local 熱門 row: the template's {@link EndScreenHotRow} (`id` /
 * `title` / `cover`) augmented with an OPTIONAL `duration` in SECONDS. The RN
 * template type does NOT carry `duration` (unlike the Flutter / iOS / Android
 * `LBEndHotItem`), so the demo seeds attach it here and the 熱門 surface formats it
 * to `mm:ss`; a live-template row (no `duration`) formats to `"00:00"`. This is a
 * presentational augmentation ONLY — it never mutates the template type.
 */
export type HotRow = EndScreenHotRow & { readonly duration?: number };

/**
 * Read-only snapshot bridge for the family-4 moment surfaces. Wraps a live
 * {@link DefaultPlayerTemplate}; every accessor reads the template's public getter
 * each call (no stored mirror). For demos / previews / structural snapshot tests,
 * construct with `template = null` and the accessors return the deterministic
 * {@link MomentsSeeds} defaults instead (parity with the Flutter
 * `MomentsModel(template: null)`).
 *
 * ★ CRITICAL: this model carries NO mutating forwarder. Moment actions (skip /
 *   watchNext / pickHot / cancel / retry / dismiss) are HOST-WIRED container
 *   callbacks, NOT template methods — mirrors iOS / Android / Flutter `MomentsModel`.
 */
export class MomentsModel {
  /** The bound template, or `null` for demo / snapshot instances. */
  readonly template: DefaultPlayerTemplate | null;

  /**
   * Bridge a live template (host-supplied) — or `null`/omitted for the
   * deterministic demo seeds (previews / structural snapshot tests).
   */
  constructor(template?: DefaultPlayerTemplate | null) {
    this.template = template ?? null;
  }

  // -- Surface 1: StartScreen ← splash lifecycle phase ------------------------

  /**
   * Splash lifecycle phase (`DefaultPlayerTemplate.startScreenState.phase`).
   * `loading` → full-screen brand spinner; `buffering` → lightweight over-content
   * indicator (video visible behind); `splash` → brand splash + skip pill; `done`
   * → no overlay. The container shows the start moment ONLY while
   * `startPhase !== Done`. For demo instances returns the at-attach default
   * `StartScreenPhase.Loading` (matching a freshly-constructed template).
   */
  get startPhase(): StartScreenPhase {
    const state: StartScreenState | undefined = this.template?.startScreenState;
    return state?.phase ?? StartScreenPhase.Loading;
  }

  /**
   * General (NOT upcoming-scoped) loading-phase cover URL (`template.loadingCover` — the
   * template's TOP-LEVEL field; there is no `upcomingState.loadingCover`). Channel-derived
   * (`channel.cover`), fed via `LivebuyPlayer.tsx`'s `onChannelChange` → `applyLoadingCover`
   * (`player-loading-cover-background-reference-ui-rn`). Read by `StartScreen`'s `.loading`
   * branch to draw the real cover photo + dark mask behind the brand loading-mark animation,
   * parity iOS/Android. This is unrelated to family-1 `PlayerShellModel.upcomingCover`
   * (`upcomingState.cover`, upcoming-countdown-only) — different data source, different surface,
   * neither reads or affects the other. For demo instances returns `''` (the at-attach default;
   * the `.loading` structural snapshot omits `coverUrl` entirely and stays on the solid brand
   * backdrop).
   */
  get loadingCover(): string {
    return this.template?.loadingCover ?? '';
  }

  // -- Surface 2: EndScreen ← auto-next countdown + next + hot -----------------

  /**
   * Auto-next countdown snapshot (`endScreenState.countdown`); non-null ONLY while
   * core drives the auto-next countdown AND `next` is non-empty
   * (`countdown != null` ⇔ 倒數變體, null ⇔ 熱門變體). `{ remain, total }` — ring
   * progress = `remain / total`. For demo instances returns `null` (the at-attach
   * default; the richer countdown fixture is passed by value from
   * {@link MomentsSeeds.countdown}).
   */
  get countdown(): EndScreenCountdown | null {
    return this.template?.endScreenState.countdown ?? null;
  }

  /**
   * Watch-next targets (`endScreenState.next`). The 倒數變體 preview card reads
   * `next[0]` (`cover` placeholder / `title`). For demo instances returns the
   * at-attach default (empty); the richer fixture is {@link MomentsSeeds.next}.
   */
  get next(): readonly EndScreenNavRow[] {
    return this.template?.endScreenState.next ?? [];
  }

  /**
   * 熱門推薦 set (`endScreenState.hot`). Rendered as a FIXED SMALL set in a PLAIN
   * Row/Column (NEVER lazy/scroll). The RN template row carries NO `duration`, so
   * the value is widened to {@link HotRow} (`EndScreenHotRow & { duration? }`); the
   * 熱門 surface formats `duration` (SECONDS) to `mm:ss` (e.g. `28` → `"00:28"`),
   * defaulting to `"00:00"` when absent. For demo instances returns the at-attach
   * default (empty); the richer fixture is {@link MomentsSeeds.hot}.
   */
  get hot(): readonly HotRow[] {
    return (this.template?.endScreenState.hot as readonly HotRow[] | undefined) ?? [];
  }

  /**
   * Whether the end screen should be shown at all (`endScreenState.endScreenVisible`,
   * mirrors core「player 進 endScreenShown sub-state」). True on live_end REGARDLESS of
   * next/hot. The container shows the end moment when `countdown != null ||
   * endScreenVisible`; when `countdown == null && endScreenVisible`, EndScreen renders
   * the no-countdown「直播已結束」variant (end-screen-no-countdown). For demo instances
   * returns `false`. Parity iOS / Android `MomentsModel.endScreenVisible`.
   */
  get endScreenVisible(): boolean {
    return this.template?.endScreenState.endScreenVisible ?? false;
  }

  /**
   * LIVE/VOD flag (`playerHeaderState.isLive` — `channel.liveStatus == 1`, host-fed via
   * `handleHeaderChrome`). Feeds the end-screen VOD-結束無-next auto-close gate
   * (`MomentsView.shouldCloseInsteadOfEndScreen`, rb-rn-endscreen-live-empty-state): design R41
   * made EndScreen LIVE-only, so `!isLive && next.isEmpty` means there is nothing to show and
   * the container closes the player instead. This is a SECOND read-only accessor of the SAME
   * template source `PlayerShellModel.isLive` already reads — NOT a second copy of the value.
   * For demo instances returns `false` (the VOD default, matching `PlayerShellSeeds.isLive`).
   */
  get isLive(): boolean {
    return this.template?.playerHeaderState.isLive ?? false;
  }

  // -- Surface 3: ErrorScreen ← terminal error snapshot -----------------------

  /**
   * Terminal player error snapshot (`playerErrorState`); `null` when the player is
   * not in `error`. `{ kind, phase }` — `phase` is always `Failed` (core does not
   * expose retrying). `kind` (`stream` / `notFound` / `outdated`) is ALREADY
   * classified by the template (`errorKindFromType`); this layer MUST NOT
   * re-classify. The container shows the error moment (HIGHEST priority) when
   * `error != null`. For demo instances returns `null` (the at-attach default).
   */
  get error(): PlayerErrorState | null {
    return this.template?.playerErrorState ?? null;
  }
}

// MARK: - Deterministic demo seeds (previews / structural snapshot tests)

/**
 * Plain-literal deterministic seeds for the family-4 surfaces' previews + the
 * per-surface structural snapshot tests. Built from the public template value
 * shapes (`EndScreenNavRow` / {@link HotRow} / `EndScreenCountdown` /
 * `PlayerErrorState`) so a snapshot does NOT depend on a live player. Mirrors the
 * iOS / Android / Flutter `MomentsSeeds`.
 *
 * The golden baselines each drive ONE moment variant from these seeds:
 *   • {@link splashPhase} — the start-screen splash baseline (brand splash + skip pill).
 *   • {@link countdown} + {@link next} — the end-screen 倒數變體 (ring + preview card).
 *   • {@link hot} — the end-screen 熱門變體 (durations in SECONDS, formatted `mm:ss`).
 *   • {@link streamError} — the error-screen stream baseline (「播放發生問題」+ 重試 + 返回).
 */
export const MomentsSeeds = {
  // -- Surface 1: start-screen splash phase -----------------------------------

  /**
   * The splash-phase fixture for the start-screen snapshot baseline (brand splash +
   * skip pill「略過片頭」).
   */
  splashPhase: StartScreenPhase.Splash,

  // -- Surface 2: end-screen 倒數變體 + 熱門變體 ------------------------------

  /**
   * A deterministic auto-next countdown (`remain 3 / total 5` → 60% ring; centre
   * shows `remain == 3`). Drives the end-screen 倒數變體 baseline.
   */
  countdown: { remain: 3, total: 5 } as EndScreenCountdown,

  /**
   * The watch-next target list (倒數變體 reads `next[0]` for its preview card + the
   *「{shopName} · {duration}」meta line — `shopName` / `duration` are the fields added
   * by `align-endscreen-nav-meta-template`; `duration` is SECONDS, formatted `mm:ss`
   * (1530 → `25:30`)).
   */
  next: [
    {
      id: 'next-7001',
      title: '下一場 · 春季新品搶先看',
      cover: '',
      shopName: 'Aurora 美妝',
      duration: 1530,
    },
  ] as readonly EndScreenNavRow[],

  /**
   * A deterministic 熱門推薦 set (FIXED SMALL set; `duration` is a number in SECONDS
   * — the 熱門 surface formats `mm:ss`: 2316 → `"38:36"`, 728 → `"12:08"`, 347 →
   * `"05:47"`). Mirrors the iOS / Android / Flutter hot seeds. NOTE: `duration` is a
   * reference-ui-local {@link HotRow} augmentation (the RN template `EndScreenHotRow`
   * has no `duration`).
   */
  hot: [
    { id: 'hot-8001', title: '夏日通勤彩妝特輯', cover: '', duration: 2316 },
    { id: 'hot-8002', title: '週年慶必囤清單', cover: '', duration: 728 },
    { id: 'hot-8003', title: '主持人私藏好物', cover: '', duration: 347 },
  ] as readonly HotRow[],

  // -- Surface 3: error-screen ------------------------------------------------

  /**
   * Terminal stream-failure error fixture for the error-screen baseline
   * (「播放發生問題」+ 重試 + 返回).
   */
  streamError: {
    kind: PlayerErrorKind.Stream,
    phase: PlayerErrorPhase.Failed,
  } as PlayerErrorState,

  /** A not-found error fixture (「找不到影片」僅返回，不可重試). */
  notFoundError: {
    kind: PlayerErrorKind.NotFound,
    phase: PlayerErrorPhase.Failed,
  } as PlayerErrorState,

  /** An outdated-SDK error fixture (「請更新版本」前往更新，無重試). */
  outdatedError: {
    kind: PlayerErrorKind.Outdated,
    phase: PlayerErrorPhase.Failed,
  } as PlayerErrorState,
} as const;
