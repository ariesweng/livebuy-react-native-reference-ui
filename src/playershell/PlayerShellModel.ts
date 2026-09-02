// PlayerShellModel — family-1 player-shell read-only snapshot bridge (RN).
//
// Spec: `reference-ui-rendering/spec.md` (family-1 player-shell, 4 surfaces).
// Phase-4 RN sibling of the DONE iOS `PlayerShellModel.swift`
// (rb-ios-player-shell D-1 / D-4), Android `PlayerShellModel.kt`
// (rb-android-player-shell), and Flutter `player_shell_model.dart`
// (rb-flutter-player-shell). This RN family is built FROM SCRATCH and bakes in
// the iOS-reconciled FINAL state (notice tab renders the systemNotice + notice
// TWO segments in-panel from the start — see `PlayerShellSeeds`).
//
// It bridges the headless template view-models exposed by `DefaultPlayerTemplate`
// (obtained at runtime by the host via `attachPlayerTemplate`) into a read-only
// snapshot the four family-1 RN surface components read. It is a pure read-only
// MIRROR:
//
//   - It owns NO second copy of authoritative state. Every getter reads the
//     template's own public getter each call (`playerHeaderState` /
//     `operationRailState` / `infoTabState` / `activeInfoTab` / `noticeTabState`
//     / `productOverlayState.activeProduct`), so there is nothing to drift from
//     the template (D-1).
//   - It adds NO pixels and adds NO accessor / view-model to
//     `livebuy-react-native-ui` (that would be a template-layer concern, out of
//     scope — D-4).
//   - Interactions stay in core's existing `simulate*` exits; this layer only
//     reads. The single thin forwarder ([selectInfoTab]) targets a template-owned
//     NAVIGATION intent (`selectInfoTab` only flips presentation state, no API).
//     Every other interaction (mute / like / share / 訂閱 / product-tap) is
//     host-wired to core `simulate*`, NOT here.
//
// React components re-render via the container's `useState` + the template's
// coalesced `subscribe()` (ChangeEmitter); on each notify the container RE-READS
// these getters — so this holder keeps NO React state of its own. It just
// centralizes the read mapping + deterministic demo seeds (parity with the
// Flutter `PlayerShellModel`, which holds no Flutter state either).
//
// No react / react-native import here — pure reads + plain-literal demo seeds, so
// it stays unit-testable in a plain node environment.

import type { DefaultPlayerTemplate } from 'livebuy-react-native-ui';
import { LBInfoPanelTab, LBSideRailKind, StartScreenPhase } from 'livebuy-react-native-ui';
import type {
  LBInfoPanelTab as LBInfoPanelTabType,
  LBInfoTabState,
  LBNoticeTabState,
  LBSideRailItem,
} from 'livebuy-react-native-ui';
import type { LBProduct } from 'livebuy-react-native';

/**
 * Read-only snapshot bridge for the family-1 player-shell. Wraps a live
 * {@link DefaultPlayerTemplate}; every accessor reads the template's public
 * getter each call (no stored mirror). For demos / previews / structural
 * snapshot tests, construct with `template = null` and the accessors return the
 * deterministic {@link PlayerShellSeeds} defaults instead (parity with the
 * Flutter `PlayerShellModel(template: null)`).
 */
export class PlayerShellModel {
  /** The bound template, or `null` for demo / snapshot instances. */
  readonly template: DefaultPlayerTemplate | null;

  /**
   * Bridge a live template (host-supplied) — or `null`/omitted for the
   * deterministic demo seeds (previews / structural snapshot tests).
   */
  constructor(template?: DefaultPlayerTemplate | null) {
    this.template = template ?? null;
  }

  // -- Surface 1 (+ shared mute): PlayerHeaderBar ← header chrome -------------

  /** Top-bar host-pill title (`playerHeaderState.title`). */
  get title(): string {
    return this.template?.playerHeaderState.title ?? PlayerShellSeeds.title;
  }

  /** Host / shop name (`playerHeaderState.hostName`). */
  get hostName(): string {
    return this.template?.playerHeaderState.hostName ?? PlayerShellSeeds.hostName;
  }

  /** Host pill / top-bar logo URL (`playerHeaderState.shopLogo`). */
  get shopLogo(): string {
    return this.template?.playerHeaderState.shopLogo ?? PlayerShellSeeds.shopLogo;
  }

  /** Live viewer count (`playerHeaderState.viewerCount`). */
  get viewerCount(): number {
    return this.template?.playerHeaderState.viewerCount ?? PlayerShellSeeds.viewerCount;
  }

  /**
   * Subscribe-badge state (`playerHeaderState.isSubscribed`). Single truth — the
   * same value the info-tab reads (`infoTabState.isSubscribed`, mirrored from the
   * header by the template).
   */
  get isSubscribed(): boolean {
    return this.template?.playerHeaderState.isSubscribed ?? PlayerShellSeeds.isSubscribed;
  }

  /** Share-action context URL (`playerHeaderState.shareUrl`). */
  get shareUrl(): string {
    return this.template?.playerHeaderState.shareUrl ?? PlayerShellSeeds.shareUrl;
  }

  /**
   * Mute gesture state (single truth — `playerHeaderState.muted` ==
   * `operationRailState.muted`, both fed from the template's same
   * `handleMutedChange`). Auto-muted (true) at start.
   */
  get muted(): boolean {
    return this.template?.playerHeaderState.muted ?? PlayerShellSeeds.muted;
  }

  /**
   * LIVE/VOD flag (`playerHeaderState.isLive` — `channel.liveStatus == 1`,
   * host-fed). Gates the LIVE bottom bar (LIVE) vs the side rail (VOD). For demo
   * instances returns {@link PlayerShellSeeds.isLive}.
   */
  get isLive(): boolean {
    return this.template?.playerHeaderState.isLive ?? PlayerShellSeeds.isLive;
  }

  /**
   * Replay variant flag (`playbackProgressState.isReplay`, VOD-2) — a LIVE stream
   * scrubbed behind the live edge. Drives the LIVE bottom bar's "聊天室已關閉"
   * variant. For demo instances returns {@link PlayerShellSeeds.isReplay}.
   */
  get isReplay(): boolean {
    return this.template?.playbackProgressState.isReplay ?? PlayerShellSeeds.isReplay;
  }

  /**
   * 已結束直播回放旗標（`playerHeaderState.isFinishedLiveReplay` — `type == 3 || (type == 2 &&
   * liveStatus == 3)`，host-fed via `handleHeaderChrome`）。互斥於 {@link isLive}：一部影片不可能同時
   * 「正在直播」與「已結束直播回放」。**這是 rb-rn-vod-playback-progress-bar 進度條顯示條件要讀的旗標**
   * ——NOT {@link isReplay} 上面那個窄義 DVR 概念（直播仍在進行中、觀眾拖到 live edge 之後；
   * `vodScrubAllowed` 在 `liveStatus == 1` 時恆拒絕 seek，餵錯旗標會讓進度條可視覺拖曳卻永遠彈回原位——
   * iOS `rb-ios-restore-vod-playback-progress-bar` 就踩過這個接線錯誤，見該 change 的 design.md
   * CORRECTION 決策）。For demo instances returns {@link PlayerShellSeeds.isFinishedLiveReplay}
   * (`false`).
   */
  get isFinishedLiveReplay(): boolean {
    return this.template?.playerHeaderState.isFinishedLiveReplay ?? PlayerShellSeeds.isFinishedLiveReplay;
  }

  /**
   * 會員等級限定軟閘門（restriction-mask ②），鏡像自 `template.isRestricted`
   * （統一 `VIDEO_OPEN` 事件 `is_restriction == 1`）。`true` → `PlayerShellView` 在播放畫面
   * 疊升級遮罩。core 不擋播放（軟性顯示閘門）。For demo instances returns
   * {@link PlayerShellSeeds.isRestricted}（false → 不出像素，baseline byte-identical）。
   */
  get isRestricted(): boolean {
    return this.template?.isRestricted ?? PlayerShellSeeds.isRestricted;
  }

  // -- Upcoming (直播預告 awaitingLive) chrome state (upcomingState) -----------
  //
  // Read-only mirror of the template's upcoming view-model (`upcomingState`,
  // active / introPlaying / scheduledStartAt / cover). `PlayerShellView` reads
  // `isUpcoming` to compose the upcoming LIVE chrome (cover + date/time background +
  // slim bottom bar) instead of the LIVE / VOD chrome (priority upcoming > live >
  // vod). RN parity of iOS / Android / Flutter `PlayerShellModel.{isUpcoming,
  // upcomingStartAt, upcomingCover, introPlaying}`.

  /**
   * Whether the player is in the awaiting-live sub-state (`upcomingState.active`).
   * `true` → the shell composes the upcoming LIVE chrome. For demo instances returns
   * {@link PlayerShellSeeds.isUpcoming}.
   */
  get isUpcoming(): boolean {
    return this.template?.upcomingState.active ?? PlayerShellSeeds.isUpcoming;
  }

  /**
   * Scheduled start (`upcomingState.scheduledStartAt` / backend `publish_at`),
   * parsed by the upcoming surface for the date + big-time display. For demo
   * instances returns {@link PlayerShellSeeds.upcomingStartAt}.
   */
  get upcomingStartAt(): string {
    return this.template?.upcomingState.scheduledStartAt ?? PlayerShellSeeds.upcomingStartAt;
  }

  /**
   * Video cover URL (`upcomingState.cover` / backend `channel.cover`) — the upcoming
   * surface's full-bleed background (runtime only; the snapshot path paints a
   * deterministic placeholder). For demo instances returns
   * {@link PlayerShellSeeds.upcomingCover}.
   */
  get upcomingCover(): string {
    return this.template?.upcomingState.cover ?? PlayerShellSeeds.upcomingCover;
  }

  /**
   * Whether the intro (開場影片) MP4 preroll is playing (`upcomingState.introPlaying`).
   * The intro wears the LIVE chrome (its background is the actual intro video, not the
   * countdown); exposed for parity. `false` for demo instances.
   */
  get introPlaying(): boolean {
    return this.template?.upcomingState.introPlaying ?? false;
  }

  /**
   * Start-lifecycle phase (`DefaultPlayerTemplate.startScreenState.phase`), mirrored here
   * so `PlayerShellView` can gate the VOD side rail off during the start sequence
   * (`startPhase !== Done`) while keeping the header — parity to iOS `PlayerShellModel
   * .startPhase`. Demo default `StartScreenPhase.Loading`.
   */
  get startPhase(): StartScreenPhase {
    return this.template?.startScreenState.phase ?? StartScreenPhase.Loading;
  }

  // -- Surface 2: OperationRail ← side-rail ----------------------------------

  /** Ordered side-rail action items (`operationRailState.items`). */
  get railItems(): readonly LBSideRailItem[] {
    return this.template?.operationRailState.items ?? PlayerShellSeeds.railItems;
  }

  /** Shopping-bag badge count (`operationRailState.bagCount`); >0 → draw badge. */
  get bagCount(): number {
    return this.template?.operationRailState.bagCount ?? PlayerShellSeeds.bagCount;
  }

  /**
   * Monotonic heart-burst tick (`operationRailState.heartBurstTick`); observe its
   * INCREASE to play the heart-burst — this layer never calls like.
   */
  get heartBurstTick(): number {
    return this.template?.operationRailState.heartBurstTick ?? PlayerShellSeeds.heartBurstTick;
  }

  // -- Surface 3: VideoInfoPanel ← info-tab + notice-tab ----------------------

  /**
   * Info-tab field snapshot (`infoTabState` — `LBInfoTabState`). On RN this
   * bundles `isSubscribed` (the template mirrors it from the single PlayerHeader
   * truth via `currentWith`), so it can never drift from {@link isSubscribed}.
   */
  get infoTab(): LBInfoTabState {
    return this.template?.infoTabState ?? PlayerShellSeeds.infoTab;
  }

  /** Currently selected info-panel tab (`activeInfoTab`). */
  get activeTab(): LBInfoPanelTabType {
    return this.template?.activeInfoTab ?? PlayerShellSeeds.activeTab;
  }

  /**
   * Whether the 公告 (notice) tab is selectable (`noticeTabState.canOpen` —
   * derived: either notice text non-empty). `false` → notice tab disabled +
   * 「目前沒有公告」empty-state placeholder.
   */
  get noticeCanOpen(): boolean {
    return this.template?.noticeTabState.canOpen ?? PlayerShellSeeds.noticeTab.canOpen;
  }

  /** System-notice text (`noticeTabState.systemNotice`, textDim 段). */
  get systemNotice(): string {
    return this.template?.noticeTabState.systemNotice ?? PlayerShellSeeds.noticeTab.systemNotice;
  }

  /**
   * Shop / video notice text (`noticeTabState.notice`, accent 段). Also feeds the
   * LIVE-overlay announce marquee (surface 4) per the iOS/Android/Flutter bridge.
   */
  get notice(): string {
    return this.template?.noticeTabState.notice ?? PlayerShellSeeds.noticeTab.notice;
  }

  // -- Surface 4: LiveOverlayChrome ← moment + chrome -------------------------

  /**
   * Pinned narrating-product source — the single active product
   * (`productOverlayState.activeProduct`). `null` → no pinned card.
   */
  get pinnedProduct(): LBProduct | null {
    // demo seed ONLY for an unbound (demo / preview / snapshot) instance. A BOUND template
    // with no `narrate_status == 2` product → `null` (no pinned card) — the `??` must NOT leak
    // the demo product into a real live session (rb-rn-player-demo-seed-leak; the live screen
    // shows only the current narrating product per design). Parity iOS / Android.
    return this.template == null
      ? PlayerShellSeeds.activeProduct
      : this.template.productOverlayState.activeProduct;
  }

  /**
   * VOD-main 介紹中商品清單（rb-rn-now-introducing-real-image-carousel，問題 9/10）—
   * `DefaultPlayerTemplate.vodActiveProducts`（所有 `[beginTime, endTime)` 涵蓋 playhead 的商品，
   * 依 `beginTime` 升冪）。VOD-main 的介紹中卡輪播讀此清單（真實圖 + 滿寬 + 多商品輪播）。
   * demo（無 bound template）→ 以 `PlayerShellSeeds.activeProduct` 退回單卡（既有 VOD-card
   * 結構 snapshot 仍 → 一張卡）。鏡像 iOS / Android / Flutter `PlayerShellModel.vodActiveProducts`。
   */
  get vodActiveProducts(): readonly LBProduct[] {
    // demo seed ONLY when unbound; a BOUND template returns its real (possibly empty) list —
    // no demo card on a real session (rb-rn-player-demo-seed-leak). Parity iOS / Android.
    return this.template == null
      ? [PlayerShellSeeds.activeProduct]
      : this.template.vodActiveProducts;
  }

  /**
   * ALL LIVE now-introducing products — every `narrate_status == 2` product
   * (`DefaultPlayerTemplate.liveActiveProducts`, data-layer order). The backend MAY narrate
   * MULTIPLE simultaneously (live-multi-narrating-product-contract). Feeds the LIVE pinned-card
   * carousel (問題 7, rb-rn-live-now-introducing-carousel). unbound demo → `[]` (the single
   * `pinnedProduct` seed still drives the demo card via {@link livePinnedProducts}). Mirrors
   * iOS / Android `PlayerShellModel.liveActiveProducts`.
   */
  get liveActiveProducts(): readonly LBProduct[] {
    return this.template == null ? [] : this.template.liveActiveProducts;
  }

  /**
   * The LIVE pinned-card source for the carousel: the full {@link liveActiveProducts} when
   * non-empty (multi-product carousel + 分頁點); ELSE the single {@link pinnedProduct}
   * (`activeProduct` ?? first `isHot==1`) as a 1-element list. Empty → no card. Pure computed
   * (no second state). Mirrors iOS `PlayerShellModel.livePinnedProducts`.
   */
  get livePinnedProducts(): readonly LBProduct[] {
    const active = this.liveActiveProducts;
    if (active.length > 0) return active;
    const single = this.pinnedProduct;
    return single == null ? [] : [single];
  }

  /**
   * Announce-marquee copy for the LIVE overlay (`LBLiveAnnounce`). REACHABLE
   * source is the notice-tab `notice` text — mirrors the iOS/Android/Flutter
   * bridge's `announceText = noticeTab.notice`. Empty → the banner is omitted.
   */
  get announceText(): string {
    return this.notice;
  }

  // -- VOD/回放 playback-progress (rb-rn-vod-playback-progress-bar) ------------
  //
  // Mirrors `playbackProgressState` (`position` / `duration` / `isPlaying`) — already
  // published by the archived `rn-vod-playback-progress-template` — for the new
  // `PlaybackProgressBarView` surface. `isReplay` on that state is the narrow DVR
  // concept already exposed above as {@link isReplay}; the progress-bar's OWN display
  // gate reads {@link isFinishedLiveReplay} instead (see that getter's doc comment).

  /** Current playhead, seconds (`playbackProgressState.position`). */
  get position(): number {
    return this.template?.playbackProgressState.position ?? PlayerShellSeeds.position;
  }

  /** Total duration, seconds (`playbackProgressState.duration`). `<= 0` ⇒ no scrubbable timeline. */
  get duration(): number {
    return this.template?.playbackProgressState.duration ?? PlayerShellSeeds.duration;
  }

  /** Whether the stream is currently playing (`playbackProgressState.isPlaying`) — drives the
   *  progress bar's play/pause button icon. */
  get isPlaying(): boolean {
    return this.template?.playbackProgressState.isPlaying ?? PlayerShellSeeds.isPlaying;
  }

  // -- VOD CC 字幕開關（rb-react-native-subtitle-vtt-caption-display） ----------------------------
  //
  // `subtitleEnabled` HAS a template home (`DefaultPlayerTemplate.subtitleState.enabled`, an
  // existing template-layer view-model that is a long-lived stored property on the `template`
  // instance itself — unlike this `PlayerShellModel` wrapper, which is re-`new`'d every render).
  // The turnkey container writes it via the template's existing public `handleMomentSnapshot`
  // when the unified `SUBTITLE_TOGGLE` event fires. Mirrors the `position` / `duration` getters
  // above (parity iOS/Android `PlayerShellModel.subtitleEnabled`) — NO stored state added here.
  //
  // `subtitleCues` (the parsed VTT cue list) has NO template home — there is no core / template
  // concept of "the active caption text", only the `enabled` boolean above — so it is threaded
  // down as a `PlayerShellView` PROP (container-held React state) instead of a model getter; see
  // that prop's doc comment and design.md D1/D2 for the full rationale.

  /** VOD CC (字幕) toggle state (`template.subtitleState.enabled`). For demo instances returns
   *  {@link PlayerShellSeeds.subtitleEnabled} (`false`). */
  get subtitleEnabled(): boolean {
    return this.template?.subtitleState.enabled ?? PlayerShellSeeds.subtitleEnabled;
  }

  /**
   * VOD/replay play-pause forwarder — the EXISTING `template.togglePlayPause()` (from
   * `rn-vod-playback-progress-template`; the host wires the player ref's `togglePlayPause()`
   * at `attachPlayerTemplate()` time). No-op for demo instances (no bound template). No new
   * core/template API — pure forwarder, mirrors iOS `PlayerShellModel.togglePlayPause()`.
   */
  togglePlayPause(): void {
    this.template?.togglePlayPause();
  }

  /**
   * VOD/replay absolute-seek forwarder — the EXISTING `template.seek(seconds)`. `seconds`
   * unchanged; the core RN bridge's `vodScrubAllowed` gate already lives client-side, this
   * layer MUST NOT re-implement it. No-op for demo instances. Mirrors iOS
   * `PlayerShellModel.seek(to:)`.
   */
  seek(seconds: number): void {
    this.template?.seek(seconds);
  }

  /**
   * VOD/replay relative-seek forwarder (rb-rn-gesture-clean-mode-v2) — the EXISTING
   * `template.seekBy(delta)` (`rn-vod-playback-progress-template`'s `requestSeekBy`
   * forwarder; no new view-model API). Used by the double-tap seek ±10s gesture and the
   * long-press 2x-speed-approximation tick. `delta` unchanged. No-op for demo instances.
   * Mirrors iOS `PlayerShellModel.seekBy(_:)`.
   */
  seekBy(delta: number): void {
    this.template?.seekBy(delta);
  }

  // -- Read-only host intent (template-owned navigation, NOT a core simulate*) --

  /**
   * Forward an info-panel tab switch to the bound template
   * (`DefaultPlayerTemplate.selectInfoTab`). `info` is always honoured; `notice`
   * is honoured by the template only when `noticeTabState.canOpen`. No-op for
   * demo instances (no bound template). `selectInfoTab` only flips presentation
   * state — it does NOT call any API (so this stays a navigation intent, not a
   * core `simulate*`).
   */
  selectInfoTab(tab: LBInfoPanelTabType): void {
    this.template?.selectInfoTab(tab);
  }

  // -- Adjacent-video navigation (swipe-navigate) ----------------------------
  //
  // Republishes the template's read-only navigation ids and exposes thin
  // forwarders so `PlayerShellView`'s vertical-swipe (PanResponder) can drive
  // prev/next. Parity of iOS `PlayerShellModel.{prevVideoId, nextVideoId,
  // navigateToPrev, navigateToNext}` / Android `PlayerShellModel`. Read-only
  // mirror: the getters read `template.navigationState` each call (no stored
  // second copy); `null` template (demo / snapshot) → null ids + no-op forwarders.

  /**
   * Previous adjacent video id (`navigationState.prevVideoId`), or `null` when
   * there is no previous video / no bound template (demo / snapshot).
   */
  get prevVideoId(): string | null {
    return this.template?.navigationState.prevVideoId ?? null;
  }

  /**
   * Next adjacent video id (`navigationState.nextVideoId`), or `null` when there
   * is no next video / no bound template (demo / snapshot).
   */
  get nextVideoId(): string | null {
    return this.template?.navigationState.nextVideoId ?? null;
  }

  /**
   * Whether there is a next / previous adjacent video to switch to. Derived from
   * {@link nextVideoId} / {@link prevVideoId} (swipe-nav-close-on-empty): a swipe toward a
   * direction with NO video closes the player instead of no-op'ing. NO new state source —
   * single source of truth stays core channel → template navigation. Parity iOS / Android
   * `PlayerShellModel.hasNextVideo` / `hasPrevVideo`.
   */
  get hasNextVideo(): boolean {
    return this.nextVideoId != null;
  }

  get hasPrevVideo(): boolean {
    return this.prevVideoId != null;
  }

  /**
   * Switch to the previous adjacent video — forwards to the bound template's
   * `navigateToPrev()` (→ core `load(videoId)`). No-op when there is no previous
   * video (`prevVideoId == null`) or no bound template (demo / snapshot).
   */
  navigateToPrev(): void {
    this.template?.navigateToPrev();
  }

  /**
   * Switch to the next adjacent video — forwards to the bound template's
   * `navigateToNext()` (→ core `load(videoId)`). No-op when there is no next
   * video (`nextVideoId == null`) or no bound template (demo / snapshot).
   */
  navigateToNext(): void {
    this.template?.navigateToNext();
  }
}

// GAP NOTES (reachability of family-1 surfaces — parity with iOS / Android / Flutter)
//
// Per D-4 this layer ONLY reads what `DefaultPlayerTemplate` exposes publicly. It
// MUST NOT add pixels or add accessors to `livebuy-react-native-ui`. These
// family-1 surface inputs are NOT reachable from the template's public read
// surface today; the surfaces treat them as host-supplied static copy:
//
//   • LiveOverlayChrome — host caption (`LBLiveHostCaption`): there is NO public
//     host-caption / subtitle-text view-model on `DefaultPlayerTemplate`. The
//     model exposes `announceText` (← notice) + `pinnedProduct` (← activeProduct);
//     the host caption + gesture-hint copy stay STATIC sub-view inputs.
//   • PlayerHeaderBar — PiP affordance: no public PiP-state mirror; the mute icon
//     binds `muted`, the PiP control (if drawn) is a static affordance whose
//     action goes through the host's wiring.

/**
 * Deterministic demo seeds for the family-1 surfaces' previews + the per-surface
 * structural snapshot tests. Plain-literal so a snapshot does NOT depend on a
 * live player. Mirrors the iOS / Android / Flutter `PlayerShellSeeds`.
 *
 * NOTE the RN `LBProduct` shape DIFFERS from Flutter's: `price` /
 * `originalPrice` are STRINGS (`originalPrice` nullable) and `id` / `goodsGpn`
 * are strings (JS Number-precision rule); same rendered result, different
 * view-model shape.
 */
export const PlayerShellSeeds = {
  // -- Surface 1 (+ shared mute): header chrome ------------------------------

  /** Demo header title (live-looking top bar). */
  title: '夏日彩妝特賣',

  /** Demo host / shop name. */
  hostName: 'BeautyTown 官方',

  /** Demo shop logo URL — empty so the surface draws a deterministic placeholder. */
  shopLogo: '',

  /** Demo running viewer count. */
  viewerCount: 12345,

  /** Not subscribed at the demo seed (subscribe badge off). */
  isSubscribed: false,

  /** Demo share-context URL. */
  shareUrl: 'https://livebuy.tv/s/demo',

  /** Auto-muted on start (CLAUDE.md Player States) — both header + rail mirror it. */
  muted: true,

  /** Demo LIVE/VOD flag — `false` so demo / existing player-shell snapshots keep
   *  showing the side rail (unchanged). The LIVE bottom bar is exercised by its OWN
   *  snapshot / structural test constructing `LiveBottomBarView` directly. */
  isLive: false,

  /** Demo replay flag — `false` (normal LIVE bar, not the "聊天室已關閉" variant). */
  isReplay: false,

  /** Demo restriction flag — `false` (no upgrade mask; existing player-shell
   *  snapshots byte-identical). The restriction-mask snapshot constructs the shell
   *  with a stub template whose `isRestricted === true` directly (restriction-mask ②). */
  isRestricted: false,

  /** Demo finished-live-replay flag — `false` (normal VOD/LIVE branching; existing
   *  player-shell snapshots unaffected). rb-rn-vod-playback-progress-bar's own tests
   *  construct a stub template whose `playerHeaderState.isFinishedLiveReplay === true`
   *  directly. */
  isFinishedLiveReplay: false,

  // -- VOD/回放 playback-progress demo seeds (rb-rn-vod-playback-progress-bar) ------

  /** Demo playhead position, seconds — `0` (matches `DefaultPlaybackProgressState`'s own
   *  unfed default; the demo template=null path never shows the progress bar anyway, see
   *  `PlayerShellModel.startPhase`'s `Loading` default). */
  position: 0,

  /** Demo duration, seconds — `0` (unfed default; see `position` above). */
  duration: 0,

  /** Demo isPlaying — `false` (unfed default). */
  isPlaying: false,

  /** Demo CC 字幕開關 — `false` (unfed default; matches `DefaultSubtitleState`'s own default).
   *  rb-react-native-subtitle-vtt-caption-display. */
  subtitleEnabled: false,

  // -- Upcoming (直播預告) demo seeds (player-shell-upcoming snapshot) ---------

  /** Demo upcoming flag — `false` (the default chrome is LIVE / VOD; existing
   *  player-shell snapshots are unchanged). The upcoming snapshot constructs the
   *  shell with a stub template whose `upcomingState.active === true` directly
   *  (parity with iOS / Android / Flutter `PlayerShellSeeds`). */
  isUpcoming: false,

  /** Demo scheduled start (`publish_at`, UTC+8) → the upcoming surface shows
   *  「6月20日」/「20:00」. Deterministic for the snapshot. */
  upcomingStartAt: '2026-06-20 20:00:00',

  /** Demo upcoming cover URL — empty for the snapshot (the surface paints the
   *  deterministic placeholder / solid background, no remote load). */
  upcomingCover: '',

  // -- Surface 2: side-rail ---------------------------------------------------

  /**
   * The side-rail items as they appear pre-channel (matches `DefaultOperationRail`'s
   * default order: goods / chat / like / share / subtitle / serviceLink /
   * guestNameEdit / more; conditional kinds disabled). Parity with iOS /
   * Android / Flutter `defaultRailItems`.
   */
  // Demo / golden seed only (runtime rail = template.operationRailState). Aligned to the design's
  // VOD side rail (CC / share / contact): Subtitle/Share/ServiceLink enabled; Like/More/Chat/
  // GuestNameEdit not in the VOD rail (OperationRail renders only RAIL_PRESENTATION_ORDER). Goods
  // enabled feeds bagCount / the separate floating bag (the rail no longer renders it).
  railItems: [
    { kind: LBSideRailKind.Goods, enabled: true },
    { kind: LBSideRailKind.Chat, enabled: false },
    { kind: LBSideRailKind.Like, enabled: false },
    { kind: LBSideRailKind.Share, enabled: true },
    { kind: LBSideRailKind.Subtitle, enabled: true },
    { kind: LBSideRailKind.ServiceLink, enabled: true },
    { kind: LBSideRailKind.GuestNameEdit, enabled: false },
    { kind: LBSideRailKind.More, enabled: false },
  ] as readonly LBSideRailItem[],

  /** Demo bag badge of 3 (so the badge renders in the snapshot). */
  bagCount: 3,

  /** Demo heart-burst tick (static first-frame in the snapshot). */
  heartBurstTick: 0,

  // -- Surface 3: info-tab + notice-tab --------------------------------------

  /**
   * Demo info-tab fields (a 點播 show with title / publishAt / shop / intro).
   * On RN `LBInfoTabState` bundles `isSubscribed` (single truth via header) —
   * the seed mirrors the header's `isSubscribed` above.
   */
  infoTab: {
    title: '夏日通勤彩妝 LIVE 精選',
    publishAt: '點播影片 · Feb 04, 2026',
    shopName: 'BeautyToYou',
    shopIntro:
      '這場直播主推夏日通勤彩妝。整理出 8 款熱銷商品,觀眾可一邊看示範一邊下單,精選色號限時 5 折。',
    shopLogo: '',
    isSubscribed: false,
  } as LBInfoTabState,

  /** Demo active info-panel tab (info first). */
  activeTab: LBInfoPanelTab.Info as LBInfoPanelTabType,

  /**
   * Demo notice tab snapshot — selectable (both notices present). The notice-tab
   * snapshot exercises the `canOpen == true` two-段 path; the disabled
   * 「目前沒有公告」path is covered by a test with an empty seed override.
   */
  noticeTab: {
    canOpen: true,
    isOpen: false,
    systemNotice: '系統公告:本場次將於 21:00 開始,敬請準時收看。',
    notice: '本場直播限定:單筆滿 NT$999 免運,結帳輸入折扣碼 LIVE5 享 5 折。',
  } as LBNoticeTabState,

  // -- Surface 4: pinned narrating product ------------------------------------

  /**
   * Demo pinned narrating product (`narrateStatus == 2` → 介紹中 tag, `isHot == 1`
   * → 熱銷 tag). RN `LBProduct.id` / `goodsGpn` are STRINGS and `price` /
   * `originalPrice` are STRINGS (`originalPrice` nullable) — cross-platform
   * parity / JS Number-precision rule (differs from Flutter's `double` price).
   * Mirrors the iOS / Android / Flutter pinned card demo product. `pic` empty →
   * surface draws a deterministic placeholder.
   */
  activeProduct: {
    id: '90001',
    goodsNo: 'DEMO-90001',
    name: '保濕亮顏精華液 30ml',
    price: '690',
    priceShow: 'NT$ 690',
    originalPrice: '1280',
    originalPriceShow: 'NT$ 1,280',
    goodsGpn: '90001',
    stock: 42,
    pic: '',
    photos: [],
    brief: '限時直播價,熱銷補貨到。',
    soldOut: 0,
    isHot: 1,
    isOutSoon: 0,
    narrateStatus: 2, // narrating → pinned card shows the 介紹中 tag
    isAwait: 0,
    isAwaitNotice: 0,
    beginTime: null,
    endTime: null,
    diversionUrl: '',
    specifications: [],
    specOptions: [],
  } as LBProduct,
} as const;
