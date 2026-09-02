// FeedWinModel — family-2 feed + win read-only snapshot bridge (RN).
//
// Spec: `reference-ui-rendering/spec.md` (family-2 feed-win, 3 surfaces).
// Phase-4 RN sibling of the DONE iOS `FeedWinModel.swift` (rb-ios-feed-win),
// Android `FeedWinModel.kt` (rb-android-feed-win), and Flutter
// `feed_win_model.dart` (rb-flutter-feed-win). The EMAIL-LESS win-claim reconcile this
// family originally baked in is RETIRED (rb-rn-win-claim-email-flow): the claim submit now
// CARRIES the user-entered email (`submitAwardClaim(winner, email)`), and this model mirrors
// the template's `submitInFlight` + forwards `dismissClaim()`.
//
// It bridges the headless template view-models exposed by `DefaultPlayerTemplate`
// (obtained at runtime by the host via `attachPlayerTemplate`) into a read-only
// snapshot the three family-2 RN surface components read. It is a pure read-only
// MIRROR — IDENTICAL pattern to family-1 `PlayerShellModel`:
//
//   - It owns NO second copy of authoritative state. Every getter reads the
//     template's own public getter each call (`feedItems` / `unclaimedCount` /
//     `unclaimedWinners` / `awardClaimResultState` / `classifyAward`), so there
//     is nothing to drift from the template (D-1).
//   - It adds NO pixels and adds NO accessor / view-model to
//     `livebuy-react-native-ui` (a template-layer concern, out of scope — D-4).
//   - The data layer already merged / ordered / tail-retained (N = 7) the feed;
//     this layer MUST NOT slice / merge / re-sort it (a second copy would
//     violate single-truth). `text` is the backend-prebuilt full string —
//     surfaces MUST NOT split it.
//
// React components re-render via the container's `useState` + the template's
// coalesced `subscribe()` (ChangeEmitter); on each notify the container RE-READS
// these getters — so this holder keeps NO React state of its own. It just
// centralizes the read mapping + deterministic demo seeds (parity with the
// Flutter `FeedWinModel`, which holds no Flutter state either).
//
// No react / react-native import here — pure reads + plain-literal demo seeds,
// so it stays unit-testable in a plain node environment.
//
// HOST-WIRED ACTIONS (NOT carried here): the family-2 interactions exit through
// the bound template's own intents — the win claim through
// `DefaultPlayerTemplate.submitAwardClaim(winner, email)` (internally
// `requestAwardClaim(winner, { email })`), its close through `dismissClaim()`, and the
// event-join through `DefaultPlayerTemplate.joinEvent(eid, keyword)` (internally
// `requestEventJoin` + optimistic `feed.markJoined`). This read-only Model exposes thin
// no-op-for-demo forwarders ([submitClaim] / [dismissClaim] / [joinEvent]) mirroring the
// iOS / Android / Flutter model, but the reference-ui SURFACES forward via their host
// callbacks (`onSubmit` / `onDismiss` / `onJoin`) and NEVER call core directly.

import type { DefaultPlayerTemplate } from 'livebuy-react-native-ui';
import { AwardClaimClassification, classifyAward } from 'livebuy-react-native-ui';
import type { AwardClaimResultState, FeedItem, PinnedMessage } from 'livebuy-react-native-ui';
import type { LBActiveEvent, LBWinner } from 'livebuy-react-native';

// rb-rn-loading-announce-restyle — the event-join row's host-bubble header needs the channel's
// host name. `PlayerShellModel.hostName` already reads the SAME single source
// (`playerHeaderState.hostName`); reusing `PlayerShellSeeds.hostName` as the demo fallback here
// (rather than a second duplicate literal) keeps ONE canonical demo host name across both
// family-1 and family-2 fixtures.
import { PlayerShellSeeds } from '../playershell/PlayerShellModel';

/**
 * Read-only snapshot bridge for the family-2 feed-win surfaces. Wraps a live
 * {@link DefaultPlayerTemplate}; every accessor reads the template's public
 * getter each call (no stored mirror). For demos / previews / structural
 * snapshot tests, construct with `template = null` and the accessors return the
 * deterministic {@link FeedWinSeeds} defaults instead (parity with the Flutter
 * `FeedWinModel(template: null)`).
 */
export class FeedWinModel {
  /** The bound template, or `null` for demo / snapshot instances. */
  readonly template: DefaultPlayerTemplate | null;

  /**
   * OPTIONAL「加入活動」three-tier join gate injected by the drop-in container (rb-rn-event-join-gate,
   * parity iOS / Android `FeedWinModel.joinEventGate`). Consulted by {@link joinEvent} BEFORE
   * forwarding: `true` → the gate INTERCEPTED the intent (raised a login / nickname modal) →
   * `joinEvent` MUST NOT forward to the template (MUST NOT join / `markJoined`). `undefined` (demo /
   * snapshot / standalone instances, no injection) → NO gating, `joinEvent` forwards unconditionally →
   * baseline byte-identical. The gate shares the 留言 pill's SAME pure predicates
   * (`liveCommentRequiresLogin` / `liveCommentRequiresNickname`, via `eventJoinGateDecision`) so the
   * 「加入活動」CTA and the 留言 pill can never diverge. A plain mutable field (NOT React state) — only
   * read at TAP time inside `joinEvent` (a callback), never during render → triggers no re-render →
   * snapshot-neutral. Container-internal wiring seam (NOT a host API): `FeedWinView` owns this model
   * (constructed fresh each render), so the container threads the gate down as a prop and `FeedWinView`
   * assigns `model.joinEventGate = ...` (mirrors Android `SideEffect { model.joinEventGate = ... }`).
   */
  joinEventGate?: (eid: number, keyword: string) => boolean;

  /**
   * Bridge a live template (host-supplied) — or `null`/omitted for the
   * deterministic demo seeds (previews / structural snapshot tests).
   */
  constructor(template?: DefaultPlayerTemplate | null) {
    this.template = template ?? null;
  }

  // -- Surface 1: ChatFeed ← merged activity + chat feed ----------------------

  /**
   * The merged, ordered, tail-retained (N = 7) feed (`feedItems`). Already
   * merged / ordered by the data layer (newest at the tail) — this layer MUST
   * NOT slice / merge / re-sort (a second copy would violate single-truth).
   * For demo instances returns {@link FeedWinSeeds.feedItems}.
   */
  get feedItems(): readonly FeedItem[] {
    return this.template?.feedItems ?? FeedWinSeeds.feedItems;
  }

  /**
   * The deeper scrollable history buffer (`DefaultPlayerTemplate.feedHistory`, cap
   * 50) — bound by the SCROLLABLE ChatFeed so the user can scroll up to view recent
   * history (parity with iOS `feedHistory`). Demo instances reuse the same seed.
   */
  get feedHistory(): readonly FeedItem[] {
    return this.template?.feedHistory ?? FeedWinSeeds.feedItems;
  }

  /**
   * 置頂留言（chat-message-taxonomy ⑤，`template.pinnedMessage`，來自 `poll.top`）。非 null →
   * ChatFeed 上緣渲染置頂橫幅；無釘選 → null（demo 預設 {@link FeedWinSeeds.pinned} = null）。
   */
  get pinned(): PinnedMessage | null {
    return this.template?.pinnedMessage ?? FeedWinSeeds.pinned;
  }

  /**
   * Whether the LIVE 公告橫幅 (`LBLiveAnnounce`) is currently showing — the bound template's
   * notice-tab `notice` is non-empty (the SAME single source as `PlayerShellModel.announceText`,
   * kept current by `rn-notice-poll-ingest`). The chat feed reads this to add the 公告橫幅 height to
   * its bottom inset so the lowest chat rows don't overlap the bottom-left 公告橫幅 (問題4,
   * rb-rn-live-announce-chat-clearance). demo / unbound template → `false` (no extra clearance →
   * baseline byte-identical).
   */
  get hasAnnounce(): boolean {
    return (this.template?.noticeTabState.notice ?? '').length > 0;
  }

  /**
   * Host name for the `EventJoinLineRow` host-bubble header (rb-rn-loading-announce-restyle).
   * Reads the SAME single source `PlayerShellModel.hostName` reads (`playerHeaderState.hostName`)
   * — this is one more read of that existing value, not a new view-model. Unbound (demo /
   * structural snapshot) → {@link PlayerShellSeeds.hostName} (reused directly, not duplicated).
   */
  get hostName(): string {
    return this.template?.playerHeaderState.hostName ?? PlayerShellSeeds.hostName;
  }

  // -- Surface 2: WinEntry ← unclaimed win entry ------------------------------

  /**
   * Unclaimed winners, insertion-ordered, deduped by `winner.id`
   * (`unclaimedWinners`). The entry opens the claim sheet on the EARLIEST
   * unclaimed winner ({@link nextUnclaimedWinner}). For demo instances returns
   * {@link FeedWinSeeds.unclaimedWinners}.
   */
  get unclaimedWinners(): readonly LBWinner[] {
    return this.template?.unclaimedWinners ?? FeedWinSeeds.unclaimedWinners;
  }

  /**
   * Distinct unclaimed-win count (== `unclaimedWinners.length`); the entry badge
   * is drawn only when `> 0`, with the badge number == this count.
   */
  get unclaimedCount(): number {
    return this.unclaimedWinners.length;
  }

  // -- Surface: ActivityEntry / ActivitySheet ← currently-running activity ----
  // (rb-rn-live-activity-sheet)

  /**
   * The single currently-running live-shopping activity, or `null` when none is running
   * (`DefaultPlayerTemplate.currentActivity` — a thin readonly delegate, same style as
   * {@link unclaimedCount} / {@link unclaimedWinners} above). `ActivityEntry` draws ONLY when this
   * is non-null; `ActivitySheet` is mounted only when it is ALSO non-null (`activitySheetOpen &&
   * model.currentActivity != null`, `FeedWinView.tsx`).
   *
   * Demo / unbound instances (`template == null`) return `null` (no running activity) — NOT a
   * demo seed like {@link unclaimedWinners} — so an existing standalone / preview `FeedWinView`
   * instance with no bound template keeps rendering byte-identically (no new floating button
   * appears out of nowhere for a host that has not wired a live template).
   */
  get currentActivity(): LBActiveEvent | null {
    return this.template?.currentActivity ?? null;
  }

  /**
   * The full running-activity list (rb-rn-activity-sheet-pagination /
   * `activity-sheet-pagination-reference-ui-rn`, `DefaultPlayerTemplate.activities` — a thin
   * readonly delegate, same style as {@link currentActivity} above). `ActivitySheet` reads
   * `activities.length` as its `pageCount` prop. Demo / unbound instances (`template == null`)
   * return `[]` (no pagination) — NOT a demo seed, so a standalone / preview `FeedWinView`
   * instance with no bound template keeps rendering byte-identically (matches
   * {@link currentActivity}'s own "no seed" convention).
   */
  get activities(): readonly LBActiveEvent[] {
    return this.template?.activities ?? [];
  }

  /**
   * The currently displayed activity page index (0-based, `DefaultPlayerTemplate.
   * currentActivityPageIndex`). `ActivitySheet` reads this as its `pageIndex` prop. Demo / unbound
   * instances → `0` (the only valid index for an empty {@link activities} list anyway).
   */
  get currentActivityPageIndex(): number {
    return this.template?.currentActivityPageIndex ?? 0;
  }

  /**
   * Forward a page switch (dot tap / qualifying swipe inside `ActivitySheetView`) to the bound
   * template (`DefaultPlayerTemplate.setActivityPageIndex(index)` — internally clamped, diff-
   * then-notify). No-op for demo instances (`?.` short-circuits — no explicit guard needed, unlike
   * {@link submitClaim} which has two call shapes to disambiguate).
   *
   * The page index itself is NOT mirrored as a second copy of state anywhere in this read-only
   * model or its container — the template is the single authoritative source
   * ({@link currentActivityPageIndex} always re-reads it), so there is nothing to keep in sync
   * here beyond forwarding the intent.
   */
  setActivityPageIndex(index: number): void {
    this.template?.setActivityPageIndex(index);
  }

  // -- Surface 3: WinClaimSheet ← claim result feedback -----------------------

  /**
   * Latest mapped claim-result feedback (`awardClaimResultState`); `null` until
   * a result arrives (pre-submit prompt). On a claimed result the template
   * removes the winner and `unclaimedCount` decrements — both re-read here via
   * the container's `subscribe()` re-read. For demo instances always `null`
   * (the pre-submit prompt). See {@link AwardClaimResultState} for the exact
   * field shape (`outcome` + optional `awardCode` (SuccessDiscount only) +
   * optional `eventId`).
   */
  get resultState(): AwardClaimResultState | null {
    return this.template?.awardClaimResultState ?? null;
  }

  /**
   * 領獎送出中旗標（`DefaultPlayerTemplate.submitInFlight`，rb-rn-win-claim-email-flow）——
   * the `submitting` stage's SINGLE truth. Read straight off the template on EVERY read (no
   * cached mirror, same pattern as every other accessor here), so it can never drift. Demo /
   * unbound instances → `false`（各 stage 結構快照才能決定式重現）。
   */
  get submitInFlight(): boolean {
    return this.template?.submitInFlight ?? false;
  }

  /**
   * CTA classification for `winner` (`classifyAward` — the single rule the
   * template's classifier applies: `award.type === 'discount'` →
   * {@link AwardClaimClassification.Discount}「立即使用」(+ awardCode), else →
   * {@link AwardClaimClassification.Product}「查看獎品」). Uses the live
   * template's `classifyAward` when bound (same standalone rule), so the claim
   * sheet still classifies correctly in previews / structural snapshot tests.
   */
  classify(winner: LBWinner): AwardClaimClassification {
    return this.template?.classifyAward(winner) ?? classifyAward(winner);
  }

  /**
   * The earliest unclaimed winner the entry should open the sheet on, or `null`
   * when there is nothing to claim (`unclaimedCount === 0`).
   */
  get nextUnclaimedWinner(): LBWinner | null {
    const winners = this.unclaimedWinners;
    return winners.length > 0 ? winners[0]! : null;
  }

  // -- Read-only host intents (pass-through to the bound template) ------------
  //
  // The feed-win layer does NOT carry actions. These are thin forwarders for the
  // template-owned intents the family-2 surfaces need (no direct core
  // `simulate*` reachable here). They are no-ops for demo instances (no
  // template). In the drop-in default wiring the reference-ui forwards via the
  // surface `onClaim` / `onJoin` host callbacks; these forwarders mirror the
  // iOS / Android / Flutter model so a container that funnels the intent has one
  // place to call, but a host that takes over the intent can ignore them.
  //
  // rb-rn-win-claim-email-flow — the surface callbacks are now `onSubmit(email)` /
  // `onDismiss()`; the deprecated EMAIL-LESS `onClaim(winner)` shape is kept only for
  // source compatibility.

  /**
   * EMAIL-LESS 領獎轉發。
   *
   * @deprecated EMAIL-LESS 領獎在未被 host 攔截時**必然失敗**（core 預設領獎路徑 `email`
   * 必填，缺 email 直接 fail-fast、**連 `POST /sdk/video/claim` 都不送**）。改用
   * {@link submitClaim}`(winner, email)`；本多載保留僅為源碼相容，SHALL NOT 再被本層任何
   * 生產路徑呼叫（`FeedWinView` 已改走帶 email 的入口）。
   */
  submitClaim(winner: LBWinner): void;
  /**
   * Forward a win claim CARRYING the user-entered email to the bound template
   * (`DefaultPlayerTemplate.submitAwardClaim(winner, email)` → core
   * `requestAwardClaim(winner, { email })`, rb-rn-win-claim-email-flow). Returns the
   * template's own guard verdict (`true` = handed to core and the model entered
   * `submitInFlight`; `false` = a guard rejected it — re-entrancy or an invalid address —
   * and NOTHING changed). The result then arrives via the template's `subscribe()`
   * notification → the container re-reads {@link resultState}.
   *
   * `false` for demo instances (no bound template — a safe no-op).
   */
  submitClaim(winner: LBWinner, email: string): boolean;
  submitClaim(winner: LBWinner, email?: string): boolean {
    if (this.template == null) return false;
    if (email === undefined) {
      // DEPRECATED EMAIL-LESS path — kept for source compatibility only.
      this.template.submitAwardClaim(winner);
      return true;
    }
    return this.template.submitAwardClaim(winner, email);
  }

  /**
   * Close the claim modal (`DefaultPlayerTemplate.dismissClaim()`).
   *
   * 🔴 **純 dismiss（反直覺）**：view-model 只清 `awardClaimResultState` + `submitInFlight`。
   * MUST NOT 從 `unclaimedWinners` 移除該 winner、MUST NOT 呼叫任何 API、MUST NOT 遞減未領
   * 徽章 —— 設計稿的強勸阻文案是**刻意的 UX 摩擦**，行為不跟隨文案（權威：
   * `design/contract/claude-design-sync.md` R13「刻意分歧（1/2）」）。No-op for demo instances.
   */
  dismissClaim(): void {
    this.template?.dismissClaim();
  }

  /**
   * Forward an「加入活動」intent to the bound template (`DefaultPlayerTemplate.joinEvent(eid,
   * keyword)` — internally core `requestEventJoin` + optimistic `feed.markJoined`). No-op for demo
   * instances.
   *
   * rb-rn-live-activity-sheet — this forwarder now serves TWO callers with the SAME join
   * semantics: the merged feed's `LBEventJoinLine`「加入活動」CTA (originally the only caller) and
   * `ActivitySheet`'s「立即參加」CTA (fed by {@link currentActivity}, `FeedWinView.tsx`). This is
   * ALREADY general enough for both — `eid` / `keyword` are plain values with no chat-feed-item
   * context baked in — so no second forwarding method was added here, mirroring
   * `DefaultPlayerTemplate.joinEvent`'s own equivalent note at the template layer.
   *
   * rb-rn-event-join-gate (parity iOS / Android): consult the container-injected {@link joinEventGate}
   * FIRST. `true` → the gate INTERCEPTED the intent (raised a login / nickname modal) → this method
   * MUST NOT forward (MUST NOT join / `markJoined`). `undefined` gate (demo / snapshot / standalone) →
   * NO gating, forward as before (baseline byte-identical).
   *
   * rn-event-join-gate-suppress-host-callback (parity Android `d33ce9d0`) — RETURNS whether the intent
   * was handed on: `false` = the gate INTERCEPTED it (nothing joined), `true` = NOT intercepted, this
   * layer forwarded it (a demo instance with no bound template still returns `true` — nothing was
   * gated, so the caller's host observation stays exactly as before → baseline byte-identical).
   *
   * The caller MUST use this return value — NOT a second gate consultation — to decide whether to
   * notify the host observer (`FeedWinViewProps.onJoin`): {@link joinEventGate} has SIDE EFFECTS
   * (it presents the login / 設定暱稱 modal and records the pending join), so consulting it twice
   * would present the modal twice and write the pending join twice. The gate predicate below is
   * therefore untouched — the result of the ONE existing consultation is simply reported out.
   */
  joinEvent(eid: number, keyword: string): boolean {
    if (this.joinEventGate?.(eid, keyword) === true) return false;
    this.template?.joinEvent(eid, keyword);
    return true;
  }
}

// MARK: - Deterministic demo seeds (previews / structural snapshot tests)

/**
 * Plain-literal deterministic seeds for the family-2 surfaces' previews + the
 * per-surface structural snapshot tests. Built from the public template / core
 * view-model shapes (`FeedItem` union / `LBWinner` / `LBAward`) so a snapshot
 * does NOT depend on a live player. Mirrors the iOS demo seeds
 * (`ChatFeedView.demoFeed` / `WinEntryView.demoUnclaimedWinners` /
 * `WinClaimSheetView.demoDiscountWinner`), the Android `FeedWinSeeds`, and the
 * Flutter `FeedWinSeeds`.
 *
 * NOTE the RN `LBWinner.id` is a STRING (cross-platform parity / JS Number-
 * precision rule); `eventId` is a number.
 */
export const FeedWinSeeds = {
  // -- Surface 1: merged chat-feed demo --------------------------------------

  /**
   * Deterministic demo feed (oldest → newest, tail at end), covering all four
   * row shapes the merged feed produces: `ChatFeedItem` (kind `'chat'`), an
   * UN-joined `EventJoinFeedItem` (kind `'eventJoin'` — the only interactive
   * row), and all four `ActivityFeedItem` tiers (`ActivityTier.Join` (0) /
   * `.Purchase` (1) / `.Intro` (2) / `.Win` (3)). `text` is the backend-prebuilt
   * full string — surfaces MUST NOT split it. Mirrors iOS `ChatFeedView.demoFeed`
   * + Android / Flutter `FeedWinSeeds.feedItems`. The win-tier row carries the win
   * winner so the feed stays self-contained.
   */
  feedItems: [
    { kind: 'chat', text: 'Boa:博士心動 💛' },
    { kind: 'activity', tier: 0, text: '王小明 剛剛加入' },
    {
      kind: 'eventJoin',
      eid: 8821,
      keyword: '抽獎',
      text: '🎉 抽獎開始!留言「抽獎」即可參加',
      joined: false,
    },
    { kind: 'activity', tier: 2, text: '開始介紹「玫瑰精華水 150ml」' },
    { kind: 'chat', text: 'CoCo:這個顏色好美 😍' },
    { kind: 'activity', tier: 1, text: 'Mia 購買了「絲絨唇釉 #04 焦糖」' },
    {
      kind: 'activity',
      tier: 3,
      text: 'boacat77 中獎了!',
      winner: {
        id: 'demo-feed-win-001',
        eventId: 4203,
        title: '直播限定抽獎',
        award: {
          type: 'product',
          code: 'SKU-FEED-WIN',
          name: '限定週邊禮盒',
        },
      },
    },
  ] as readonly FeedItem[],

  /** Demo pinned message — `null` (no 置頂橫幅; existing ChatFeed baselines byte-identical). */
  pinned: null as PinnedMessage | null,

  // -- Surface 2: unclaimed win entry demo -----------------------------------

  /**
   * Deterministic unclaimed-win set: two winners (a discount award + a product
   * award), insertion-ordered, so a `count === 2` badge renders and the entry
   * opens the sheet on the first ({@link discountWinner}). Built ONLY from real
   * public `LBWinner` / `LBAward` shape. Mirrors iOS
   * `WinEntryView.demoUnclaimedWinners` + Android / Flutter
   * `FeedWinSeeds.unclaimedWinners` (order: discount then product so the demo
   * sheet shows the「立即使用」+ awardCode path, matching the
   * `win-claim-sheet-discount` baseline).
   */
  get unclaimedWinners(): readonly LBWinner[] {
    return [
      FeedWinSeeds.discountWinner,
      {
        id: 'demo-win-product-001',
        eventId: 4201,
        title: '週年慶限定抽獎',
        award: {
          type: 'product',
          code: 'SKU-AURORA-LIP',
          name: 'Aurora 霧面唇釉 #03 珊瑚橘',
        },
      },
    ];
  },

  // -- Surface 3: discount winner for the win-claim sheet --------------------

  /**
   * The deterministic demo DISCOUNT winner (CTA「立即使用」+ awardCode) — the same
   * winner the entry opens the sheet on first, driving the
   * `win-claim-sheet-discount` baseline. Mirrors iOS
   * `WinClaimSheetView.demoDiscountWinner` + Android / Flutter
   * `FeedWinSeeds.discountWinner`.
   */
  discountWinner: {
    id: 'demo-win-discount-001',
    eventId: 4202,
    title: '整點快閃抽獎',
    award: {
      type: 'discount',
      code: 'LIVE5OFF',
      name: '全館 5 折優惠券',
    },
  } as LBWinner,
} as const;
