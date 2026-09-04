// FeedWinView — family-2 feed + win container (RN SKELETON).
//
// Spec: `reference-ui-rendering/spec.md` (family-2 feed-win, 3 surfaces).
// Phase-4 RN sibling of the DONE iOS `FeedWinOverlayView.swift`
// (rb-ios-feed-win), Android `FeedWinOverlayView.kt` (rb-android-feed-win), and
// Flutter `feed_win_view.dart` (rb-flutter-feed-win). This RN family bakes in the
// EMAIL-LESS win-claim reconcile — RETIRED by rb-rn-win-claim-email-flow (the claim
// modal now collects an email and submits it).
//
// The top-level family-2 container. It lays out the THREE family-2 surface
// components over the LIVE area:
//
//   1. ChatFeed       — bottom-leading merged feed (`LBLiveChatStream` /
//                        `LBLiveChatOverlay` / `LBPChatOverlay`)
//   2. WinEntry       — floating square entry + bottom「領獎」label (`LBWinEntry`)
//   3. WinClaimSheet  — 四階段領獎 modal (claim / confirm / submitting / done / fail),
//                        shown when an entry is opened (`LBWinSheet` v2)
//
// This SKELETON owns the layout, a read-only {@link FeedWinModel}, the resolved
// {@link ReferenceUITheme}, and composes the three surface components by import
// name. The three parallel Surfaces agents land those files after this skeleton —
// until they exist this file will not type-check on its own; that is the EXPECTED
// skeleton state. The container FIXES the call-site shapes so the agents converge
// on the SUB-VIEW INPUT PATTERN documented below.
//
// ─────────────────────────────────────────────────────────────────────────────
// SUB-VIEW INPUT PATTERN — the contract the 3 Surfaces agents MUST follow
// ─────────────────────────────────────────────────────────────────────────────
//
// Every family-2 surface is a function component
// `(props: { theme: ReferenceUITheme; ...byValueSnapshot; ...trailingCallbacks })`
// returning `ReactElement`, with props IN THIS ORDER:
//
//   1. `theme` (ReferenceUITheme)   — FIRST, always.
//   2. its bound SNAPSHOT VALUE(S)  — read-only state, passed BY VALUE from the
//                                      FeedWinModel (never the model, never the
//                                      template).
//   3. optional action callbacks    — trailing, EACH defaulting to a no-op. The
//                                      container does NOT own actions; the host
//                                      wires the exits (win claim / event join).
//
// A surface reads ONLY its passed-in values — it MUST NOT reach back into the
// FeedWinModel or DefaultPlayerTemplate (one-way data flow, D-1/D-4), MUST NOT
// hold a second copy of state, MUST render correctly with all callbacks omitted
// (so structural snapshot tests construct it action-free), MUST use plain
// View/Text/Pressable only (NO ScrollView/FlatList/SectionList/VirtualizedList —
// the merged feed is a FIXED SMALL set drawn as a plain column, mirroring Flutter
// `chat_feed`'s plain Column, NOT a list view; NO network-uri Image).
//
// The three Surfaces agents implement EXACTLY these prop signatures (see the call
// sites in the render body below):
//
//   ChatFeed(props: {
//       theme: ReferenceUITheme;
//       items: readonly FeedItem[];
//       onJoin?: (eid: number, keyword: string) => void;
//   }): ReactElement
//
//     Renders the merged feed (tail-retain 7, newest at the tail) as a plain
//     non-scrolling column; dispatches each row by `FeedItem.kind`
//     ('chat' → LBChatLine / 'eventJoin' → LBEventJoinLine / 'activity' →
//     LBActivityLine by `tier`). The ONLY interactive row is 'eventJoin' (its
//    「加入」forwards `onJoin(eid, keyword)`); `joined === true` draws the
//    「已參加」state.
//
//   WinEntry(props: {
//       theme: ReferenceUITheme;
//       unclaimedCount: number; unclaimedWinners: readonly LBWinner[];
//       onOpen?: (winner: LBWinner) => void;
//   }): ReactElement
//
//     Floating square button (white bg, fixed-color glyph, bottom「領獎」label,
//     no count badge — rb-rn-win-entry-restyle); drawn ONLY when
//     `unclaimedCount > 0`. Tapping forwards `onOpen(unclaimedWinners[0])` (the
//     earliest unclaimed winner).
//
//   WinClaimSheet(props: {
//       theme: ReferenceUITheme;
//       winner: LBWinner; classification: AwardClaimClassification;
//       resultState: AwardClaimResultState | null; submitInFlight?: boolean;
//       onSubmit?: (email: string) => void; onDismiss?: () => void;
//       onCopyCode?: (code: string) => void;
//       /** @deprecated */ onClaim?: (winner: LBWinner) => void;
//       onOpenTermsOfUse?: () => void; onOpenPrivacyPolicy?: () => void;
//       pageCount?: number; pageIndex?: number; onPage?: (index: number) => void;
//   }): ReactElement
//
//     四階段領獎 modal (rb-rn-win-claim-email-flow — EMAIL-LESS 已退役; rb-rn-win-claim-
//     pagination — R27 分頁 + 關閉機制簡化):
//     claim (恭喜中獎 + award.name + ✉ email 欄 +「確認領獎」+ pageCount>1 時的分頁圓點 + footer)
//     → confirmSubmit alert → submitting (綁 `submitInFlight`) → done / fail (綁 `resultState`).
//     CTA 提交 forwards `onSubmit(email)` (host / 容器 → `submitAwardClaim(winner, email)` →
//     core `requestAwardClaim(winner, { email })`); 關閉（R27 起唯一路徑是任一 stage 點擊外層
//     scrim，無 ✕、無「關閉視窗」文字鈕、無二次確認 alert）forwards `onDismiss()`
//     (→ `dismissClaim()` —— 🔴 純 dismiss，MUST NOT 移除未領資格 / 呼叫 API /
//     遞減徽章，見 R13 刻意分歧 1/2，行為不因 R27 簡化關閉觸發方式而改變). footer 的
//     「使用條款」/「隱私政策」forward `onOpenTermsOfUse()` / `onOpenPrivacyPolicy()`
//     (rb-rn-win-claim-footer-links — 容器 `legalLinkRoute` + `openLegalLink` 以 core
//     `LBURLOpenPolicy.decide` 裁決 `LBLegalLinks.termsOfUse` / `.privacyPolicy` 該以
//     in-app browser 還是系統 router 開啟；本 container 是 RN 的唯一呼叫端，`WinClaimSheet`
//     本層不判定網域). `pageCount`/`pageIndex`/`onPage`（rb-rn-win-claim-pagination）讓
//     `claim` 卡在多筆同時待領獎項間左右滑動 / 點分頁圓點切換——本 container 把
//     `model.unclaimedWinners.length` / `claimPageIndex` / `handlePageClaim` 接上去（見下方
//     Surface 3 呼叫處）。
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Linking, View } from 'react-native';

import type { ReferenceUITheme } from '../theme';
import { FeedWinModel } from './FeedWinModel';

import { ChatFeed } from './ChatFeedView';
import { WinEntry } from './WinEntryView';
import { WinClaimSheet } from './WinClaimSheetView';
// rb-rn-live-activity-sheet — the two new family-2 surfaces (活動入口 + 抽獎活動彈窗).
import { ActivityEntry } from './ActivityEntryView';
import { ActivitySheet } from './ActivitySheetView';
// rb-rn-activity-toast — the group-② activity toast mounted ABOVE the merged chat feed (see the
// file header note below). NOT re-exported through the public family barrel below (parity
// `PinnedBanner`'s module-internal scope in `ChatFeedView`) — it is an implementation detail of
// this container, not an independently host-composable surface.
import { ActivityToastView } from './ActivityToastView';

import type { DefaultPlayerTemplate } from 'livebuy-react-native-ui';
// rb-rn-win-claim-footer-links — PACKAGE-SCOPED DEEP PATH value imports (measured, NOT copied from
// iOS/Android). `LBLegalLinks` / `LBURLOpenPolicy` are pure headless modules with ZERO
// `react-native` dependency (their own file-header docs say so), so importing them directly avoids
// pulling in anything native.
//
// The ROOT BARREL (`from 'livebuy-react-native'`) was tried first and REJECTED: it re-exports
// `LivebuySDK`, whose module-scope destructures `NativeModules.LivebuyRNBridge` at IMPORT time
// (`react-native/src/LivebuySDK.ts` line 4). This package's `react-native` mock
// (`test-support/react-native.mock.tsx`) does not export `NativeModules`, so evaluating the barrel
// throws `Cannot destructure property 'LivebuyRNBridge' of 'react_native_1.NativeModules' as it is
// undefined` — measured: it broke `FeedWinClearance.test.tsx` / `EventJoinHostCallback.test.tsx`
// (both import `FeedWinView.tsx`) the moment the root-barrel import was added, `npm test` going
// from all-green to 4 failed suites. This is the SAME root cause the container doc in
// `container/__tests__/LivebuyPlayer.test.tsx` already names for `LivebuyPlayerOverlays.tsx`
// itself ("而該檔在 jest 載不起來") — that file's existing `import { LivebuySDK, ... } from
// 'livebuy-react-native'` is NEVER actually exercised by any test (nothing renders it; its tests
// use fakes + `readFileSync` source pinning instead), so it does not demonstrate the root barrel
// is safe to value-import from a file jest DOES load — it demonstrates the opposite once a test
// tries to load it. `FeedWinView.tsx` IS loaded directly by several existing tests, so this
// distinction is load-bearing here.
import { LBLegalLinks } from 'livebuy-react-native/src/LBLegalLinks';
import { LBURLOpenPolicy } from 'livebuy-react-native/src/LBURLOpenPolicy';
import type { LBWinner } from 'livebuy-react-native';

// Re-export the three family-2 surfaces so hosts (and the family barrel) can pull
// them from the container module (parity with the iOS/Android/Flutter family
// barrels).
export { ChatFeed } from './ChatFeedView';
export { WinEntry } from './WinEntryView';
export { WinClaimSheet } from './WinClaimSheetView';
export { ActivityEntry } from './ActivityEntryView';
export { ActivitySheet } from './ActivitySheetView';

// rb-rn-live-announce-chat-clearance (問題4) — the merged chat feed and the bottom-left LBLiveAnnounce
// 公告橫幅 share the LIVE overlay's bottom space. The base anchor (96) already clears the LIVE bottom
// bar; when a 公告 is showing the chat lifts by the 公告橫幅's height so its lowest rows don't overlap.
/** Base chat-feed bottom anchor — clears the LIVE bottom bar (既有值，無公告時不變). */
const LIVE_CHAT_BASE_CLEARANCE = 96;
/** Extra bottom inset for the LBLiveAnnounce 公告橫幅 height (parity iOS `liveAnnounceClearance = 44`). */
const LIVE_ANNOUNCE_CLEARANCE = 44;

/**
 * The chat feed's bottom inset on the LIVE overlay. `hasAnnounce === false` → the base
 * {@link LIVE_CHAT_BASE_CLEARANCE} (96, 既有 baseline byte-identical); `true` → base +
 * {@link LIVE_ANNOUNCE_CLEARANCE} (96 + 44 = 140) so the lowest chat rows clear the bottom-left
 * 公告橫幅. Pure — exported for unit tests (parity iOS `liveChatBottomInset(hasAnnounce:)` 68/112).
 */
export function liveChatBottomInset(hasAnnounce: boolean): number {
  return hasAnnounce ? LIVE_CHAT_BASE_CLEARANCE + LIVE_ANNOUNCE_CLEARANCE : LIVE_CHAT_BASE_CLEARANCE;
}

// ─────────────────────────────────────────────────────────────────────────────
// rb-rn-win-claim-footer-links — footer 法務連結路由（parity iOS `FeedWinOverlayView.
// legalLinkRoute(for:)` / Android `FeedWinOverlayView.legalLinkRoute`）
// ─────────────────────────────────────────────────────────────────────────────
//
// This container is the RN sibling of both those `FeedWinOverlayView`s, so the same
// judgement/action split lands here: `legalLinkRoute` is the PURE judgement (unit-tested,
// mutation-tested), `openLegalLink` is a thin untested action shell (mirrors iOS design.md D-C /
// D-E — the action face of "did it really call the native opener" is not independently seam-
// tested on any of the three platforms; only the judgement is). Neither `WinClaimSheet` nor
// `WinClaimSheetView.tsx` may perform this judgement themselves (one-way data flow — the sub-view
// only forwards "which segment was tapped").

/** A footer legal-link tap's resolved route (mirrors iOS `LegalLinkRoute` / Android `LegalLinkRoute`). */
export type LegalLinkRoute =
  | { readonly kind: 'inApp'; readonly url: string }
  | { readonly kind: 'external'; readonly url: string }
  | { readonly kind: 'none' };

/**
 * Routes a raw URL string through `LBURLOpenPolicy.decide` (the ONLY arbiter — this function MUST
 * NOT run a second domain check). `null` (not openable) → `{ kind: 'none' }`; otherwise an
 * exhaustive `switch` over `decision.target` (`'inApp' | 'external'`) — no `default` clause, so
 * a future third `LBURLOpenTarget` member fails `tsc --noEmit` here instead of silently falling
 * into an existing branch (the `never`-typed `unhandled` below is the compile-time proof).
 *
 * Pure: no I/O, no native call. Callers MUST use `route.url` (the policy's TRIMMED string), never
 * the raw input — `decide` trims, so a padded input's `url` differs from `rawUrl` (pinned by
 * `legalLinkRoute uses the decision URL, not the raw string` in the test suite).
 */
export function legalLinkRoute(rawUrl: string): LegalLinkRoute {
  const decision = LBURLOpenPolicy.decide(rawUrl);
  if (decision === null) return { kind: 'none' };
  switch (decision.target) {
    case 'inApp':
      return { kind: 'inApp', url: decision.url };
    case 'external':
      return { kind: 'external', url: decision.url };
    default: {
      const unhandled: never = decision.target;
      return unhandled;
    }
  }
}

/**
 * Opens a footer legal link (`LBLegalLinks.termsOfUse` / `.privacyPolicy`) per {@link legalLinkRoute}:
 * `'inApp'` → the SDK's in-app browser (`LivebuySDK.openInAppBrowser`, the SAME bridge command the
 * turnkey 聯絡商家 seam already uses — `container/seams.ts` `SeamDeps.openInAppBrowser`); `'external'`
 * → the system URL router (`Linking.openURL`, a public RN API — no new bridge command, same seam
 * `ExternalLive.ts` already uses); `'none'` → safe no-op (MUST NOT throw). Exhaustive `switch` over
 * the 3-case {@link LegalLinkRoute}, no `default`. This dispatch itself is intentionally NOT unit-
 * tested (see the file-header note above) — `legalLinkRoute`'s judgement is the tested surface.
 *
 * Lazy `require('livebuy-react-native')` for the SAME reason `LBLegalLinks` / `LBURLOpenPolicy`
 * above use a deep path: a top-level value import of the root barrel evaluates `LivebuySDK.ts`'s
 * module-scope `NativeModules.LivebuyRNBridge` destructure, which throws under this package's
 * `react-native` mock (measured — see the import comment above `LBLegalLinks`). Deferring the
 * `require` to inside this branch means it only runs if the `'inApp'` case is actually reached at
 * RUNTIME; no test calls `openLegalLink` (only `legalLinkRoute`'s judgement is unit-tested), so the
 * lazy require is never evaluated under jest — same convention as `react-native-ui`'s
 * `defaultInAppBrowserOpener`.
 */
function openLegalLink(rawUrl: string): void {
  const route = legalLinkRoute(rawUrl);
  switch (route.kind) {
    case 'inApp': {
      const { LivebuySDK } = require('livebuy-react-native');
      LivebuySDK.openInAppBrowser(route.url);
      return;
    }
    case 'external':
      void Linking.openURL(route.url);
      return;
    case 'none':
      return;
    default: {
      const unhandled: never = route;
      return unhandled;
    }
  }
}

/** Props for the family-2 feed-win container. */
export interface FeedWinViewProps {
  /** Live template (host-supplied). `null`/omitted → deterministic demo seeds. */
  readonly template?: DefaultPlayerTemplate | null;

  /** The resolved reference-ui theme. */
  readonly theme: ReferenceUITheme;

  // Host-wired interaction callbacks. The container owns NO action — each is
  // forwarded to the host (which wires it to the template exit). All optional;
  // default no-op.

  /**
   * Host-wired event-join「加入」OBSERVER (host → template `joinEvent(eid, keyword)` →
   * core `requestEventJoin` + optimistic feed flip).
   *
   * 🔴 rn-event-join-gate-suppress-host-callback — this fires **iff** the tap was actually handed on:
   * when the three-tier {@link FeedWinViewProps.joinEventGate} INTERCEPTS the intent (guest not
   * logged in / no nickname yet) nothing joined, so this observer is NOT called. Its meaning is
   * 「一次加入活動發生了」, NOT「使用者點了按鈕」— a host that needs the raw tap needs a NEW seam,
   * NOT this one. No gate injected → fires exactly as before.
   */
  readonly onJoin?: (eid: number, keyword: string) => void;
  /**
   * Host-wired claim-sheet open (presentation only — the container governs the
   * sheet open/closed affordance; this lets a host observe / override it).
   */
  readonly onOpenClaim?: (winner: LBWinner) => void;
  /**
   * Host-wired win-claim submit CARRYING the user-entered email
   * (rb-rn-win-claim-email-flow — host → template `submitAwardClaim(winner, email)` →
   * core `requestAwardClaim(winner, { email })`). The container ALSO funnels through the
   * read-only model forwarder (no-op for demo instances). reference-ui NEVER calls core.
   */
  readonly onSubmitClaim?: (winner: LBWinner, email: string) => void;
  /**
   * Host-wired EMAIL-LESS win-claim submit.
   *
   * @deprecated EMAIL-LESS 領獎在未被 host 攔截時**必然失敗**（core 預設領獎路徑 `email`
   * 必填）。改用 {@link onSubmitClaim}。形狀刻意維持不變以保源碼相容；設了它的 host 行為
   * 完全不變（仍收不到 email —— 該 host 本來就自行接管領獎）。
   */
  readonly onClaim?: (winner: LBWinner) => void;
  /**
   * Host-wired claim-modal dismiss (✕ /「關閉視窗」/ `done` 點 scrim — presentation only).
   *
   * 🔴 純 dismiss：容器先呼叫 `model.dismissClaim()`（→ view-model `dismissClaim()`）再清
   * `openClaimWinner`，MUST NOT 移除未領資格 / 呼叫 API / 遞減徽章（R13 刻意分歧 1/2）。
   */
  readonly onDismissClaim?: () => void;
  /**
   * Host-wired 折扣碼「複製」(`done` / discount) —— 本層保留版面 + 本地「已複製」回饋，實際
   * 寫入剪貼簿委派 host（與 `onShareProduct` 的既有委派慣例一致）。Default no-op.
   */
  readonly onCopyClaimCode?: (code: string) => void;
  /** Scrollable chat variant (runtime): binds the deeper `feedHistory` so the user can
   *  scroll up to view history (parity #5b/#6). Default false → ambient feedItems + non-scroll. */
  readonly chatScrollable?: boolean;
  /** Whether the family-1 info panel (VideoInfoPanel bottom sheet) is currently open. The chat
   *  feed (rendered ABOVE the shell layer) would otherwise occlude / swallow taps on the sheet,
   *  so it is hidden while the panel is up (parity iOS rb-ios-info-panel-not-covered-by-chat).
   *  Default false. The chat is ALSO LIVE-only — dropped in VOD (parity rb-ios-hide-chat-feed-
   *  in-vod). */
  readonly infoPanelOpen?: boolean;
  /**
   * Whether `PlayerShellView`'s「乾淨模式」(`cleanMode`) is currently on (rb-rn-clean-mode-hide-
   * chat-feed — the container mirrors `PlayerShellView`'s `onCleanModeChange` report the SAME way
   * it already mirrors `onInfoPanelOpenChange` into {@link FeedWinViewProps.infoPanelOpen} above,
   * and threads it here). `true` hides the merged chat feed (`ChatFeed`, parity design
   * `screens.jsx:532` `LBLiveChatOverlay`'s `!cleanMode` gate, parity Android / Flutter's existing
   * wiring) — it does NOT affect `WinEntry` (win-claim badge) or its `WinClaimSheetView`, which
   * MUST NOT be gated by `cleanMode` (design `screens.jsx`'s `LBWinEntry` carries no `!cleanMode`
   * gate; this boundary is deliberate and shared by Android/Flutter/iOS). Default `false`
   * (source-compatible; standalone / snapshot instances with no container are unaffected).
   *
   * rb-rn-live-activity-sheet — `ActivityEntry` / `ActivitySheet` follow the SAME boundary: they
   * are the SAME `LBWinEntry` design component family as `WinEntry` (a second variant + a paired
   * popup), so they are likewise NOT gated by `cleanMode` — the design source's
   * `LBWinEntry(variant="activity")` / `LBActivitySheet` carry no `!cleanMode` conditional either,
   * and clearing the chat overlay is not a reason to also hide an unrelated running activity's
   * entry point.
   */
  readonly cleanMode?: boolean;
  /**
   * Whether `PlayerShellView`'s「更多」(⋯) collapsed menu (`LiveMoreMenuView`, design R32) is
   * currently presented (rb-rn-live-more-sheet-above-chat — the container mirrors
   * `PlayerShellView`'s `onMoreMenuOpenChange` report the SAME way it already mirrors
   * `onInfoPanelOpenChange` / `onCleanModeChange` into {@link FeedWinViewProps.infoPanelOpen} /
   * {@link FeedWinViewProps.cleanMode} above, and threads it here). The menu is presented from
   * INSIDE `PlayerShellView`'s own render tree (Surface 1), so it can never paint above this
   * Surface-2 sibling's merged chat feed otherwise — `true` hides the merged chat feed (`ChatFeed`)
   * so it neither occludes the menu nor swallows taps on it via its scrollable hit-testing. Same
   * as `cleanMode`, it does NOT affect `WinEntry` / `ActivityEntry` (win-claim / activity entry
   * badges) or their `WinClaimSheetView` / `ActivitySheet` — this boundary is deliberate, shared
   * with `infoPanelOpen` / `cleanMode` above. Default `false` (source-compatible; standalone /
   * snapshot instances with no container are unaffected).
   */
  readonly moreMenuOpen?: boolean;
  /**
   * OPTIONAL container-injected「加入活動」three-tier gate (rb-rn-event-join-gate, parity iOS / Android
   * `FeedWinModel.joinEventGate`). The drop-in container builds it (reads the template's identity /
   * operationRail signals + presents the login / nickname controller) and threads it here; this view
   * OWNS the `FeedWinModel`, so it injects it into `model.joinEventGate` (mirrors Android
   * `SideEffect { model.joinEventGate = joinEventGate }`). `undefined` (standalone / snapshot, no
   * container) → no gating → baseline byte-identical. Container-internal seam, NOT a host API.
   */
  readonly joinEventGate?: (eid: number, keyword: string) => boolean;
}

/**
 * The family-2 feed-win container. Subscribes to the bound template's coalesced
 * `subscribe()` notification, re-reads the read-only {@link FeedWinModel} on each
 * notify (via a `useState` tick), and passes snapshot values BY VALUE to the
 * three surface components. Paints with the resolved {@link ReferenceUITheme}.
 *
 * `template == null` → the container reads the deterministic demo seeds (nothing
 * to subscribe to); the host normally supplies a live {@link DefaultPlayerTemplate}.
 */
export function FeedWinView(props: FeedWinViewProps): ReactElement {
  const {
    template = null,
    theme,
    onJoin,
    onOpenClaim,
    onSubmitClaim,
    onClaim,
    onDismissClaim,
    onCopyClaimCode,
    chatScrollable = false,
    infoPanelOpen = false,
    cleanMode = false,
    moreMenuOpen = false,
    joinEventGate,
  } = props;

  // Coalesced re-read tick. The template's `subscribe()` carries NO diff — on
  // each notify we bump the tick so React re-renders and we re-read every getter
  // off a freshly-constructed read-only model (the model holds no state of its
  // own; parity with the Flutter ListenableBuilder re-read). The demo path
  // (template == null) has nothing to subscribe to and renders the seeds.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (template == null) return;
    const unsubscribe = template.subscribe(() => setTick((t) => t + 1));
    return unsubscribe;
  }, [template]);

  // Presentation-only open state: the winner whose claim sheet is currently
  // open, or null (no sheet). Set when the entry is tapped; cleared on「稍後再看」/
  // dismiss. The claim RESULT state itself stays driven by the template
  // (`awardClaimResultState`, re-read via the model) — this only governs the
  // sheet's open/closed affordance (parity with Flutter `_openClaimWinner`).
  const [openClaimWinner, setOpenClaimWinner] = useState<LBWinner | null>(null);

  // rb-rn-win-claim-pagination — the currently-displayed page within `model.unclaimedWinners`
  // (presentation-only, mirrors `openClaimWinner` above). Reset to 0 whenever a FRESH open picks
  // a specific winner (`handleOpenClaim`) or the sheet is dismissed (`handleDismissClaim`) so a
  // stale page index never survives past the sheet closing. `handlePageClaim` keeps this in sync
  // with `openClaimWinner` on every page flip (dot tap / swipe).
  const [claimPageIndex, setClaimPageIndex] = useState(0);

  // rb-rn-live-activity-sheet — presentation-only open state for `ActivitySheet` (parity
  // `openClaimWinner` above, but this sheet carries no data of its own — it always reads the
  // CURRENT `model.currentActivity` when presented, so a plain boolean suffices).
  const [activitySheetOpen, setActivitySheetOpen] = useState(false);

  const model = new FeedWinModel(template);
  // rb-rn-event-join-gate: inject the container-built three-tier gate into THIS view's model (the
  // container does not hold this model — it threads the gate down as a prop). `model` is constructed
  // fresh each render, so a synchronous assignment is correct + render-neutral: the gate is only
  // consulted at TAP time inside `model.joinEvent`, never during render (mirrors Android
  // `SideEffect { model.joinEventGate = ... }`). `undefined` → no gating → baseline byte-identical.
  model.joinEventGate = joinEventGate;

  // The chat feed is LIVE-only (parity iOS rb-ios-hide-chat-feed-in-vod), hidden while the
  // info panel is up (parity rb-ios-info-panel-not-covered-by-chat), hidden while clean mode
  // is on (rb-rn-clean-mode-hide-chat-feed, parity Android / Flutter, design screens.jsx:532
  // LBLiveChatOverlay `!cleanMode` gate), AND hidden while PlayerShellView's「更多」(⋯) collapsed
  // menu is presented (rb-rn-live-more-sheet-above-chat — the menu lives inside Surface 1's
  // render tree and can never paint above this Surface-2 sibling otherwise). VOD, info-panel-
  // open, clean-mode-on, or more-menu-open → the chat (and its scrollable hit-testing) is dropped
  // so it neither occludes the info-panel sheet / more menu nor swallows taps on the VOD side
  // rail nor clutters the clean-mode view. `WinEntry` / `ActivityEntry` (win-claim / activity
  // entry badges) and their `WinClaimSheetView` / `ActivitySheet` are UNAFFECTED by ANY of these
  // four gates — in particular they are NOT gated by `cleanMode` or `moreMenuOpen` (design
  // `screens.jsx`'s `LBWinEntry` carries no such conditional; this boundary is deliberate, see
  // FeedWinViewProps.cleanMode's / .moreMenuOpen's doc comments).
  const isLive = template?.playerHeaderState.isLive ?? false;
  const chatVisible = isLive && !infoPanelOpen && !cleanMode && !moreMenuOpen;

  // Forward an event-join「加入」tap. The container owns NO core action — the join exits through the
  // read-only model forwarder (`model.joinEvent` → template `joinEvent` → core `requestEventJoin` +
  // optimistic `markJoined`), which is ALSO the one chokepoint the three-tier gate sits on.
  //
  // rn-event-join-gate-suppress-host-callback (parity Android `d33ce9d0`): the host OBSERVER
  // (`onJoin`) is bound to the SAME trigger condition — it fires **iff** the intent was actually
  // handed on. When the gate INTERCEPTS (guest not logged in / no nickname yet) nothing joined, so
  // the host MUST NOT be told that it did (`onJoin` is an observation hook meaning「一次加入活動
  // 發生了」, NOT a button-tap event). The verdict comes from `joinEvent`'s RETURN VALUE — the gate
  // is NOT consulted a second time here (it has side effects: it presents the login / 設定暱稱 modal
  // and records the pending join, so a second consultation would present it twice).
  //
  // No gate injected (standalone / structural snapshot) → `joinEvent` returns `true` → the host is
  // notified exactly as before (baseline byte-identical).
  const handleJoin = (eid: number, keyword: string): void => {
    if (model.joinEvent(eid, keyword)) onJoin?.(eid, keyword);
  };

  // Open the claim sheet on the tapped (earliest unclaimed) winner —
  // presentation only, no core call.
  //
  // rb-rn-win-claim-pagination — also seeds `claimPageIndex` to the tapped winner's position
  // within `model.unclaimedWinners`, so the sheet's dots / swipe state starts on the RIGHT page
  // instead of always reopening at 0 (`findIndex` returning -1 — the winner isn't in the list,
  // e.g. a stale reference — falls back to 0, a safe no-op position).
  const handleOpenClaim = (winner: LBWinner): void => {
    setOpenClaimWinner(winner);
    const idx = model.unclaimedWinners.findIndex((w) => w.id === winner.id);
    setClaimPageIndex(idx === -1 ? 0 : idx);
    onOpenClaim?.(winner);
  };

  // Forward a claim submit CARRYING the user-entered email (rb-rn-win-claim-email-flow).
  // The container owns NO core action — it funnels through the read-only model forwarder
  // (`submitAwardClaim(winner, email)`, no-op for demo instances) and raises the host seam.
  // A host that set the DEPRECATED `onClaim` still gets it (email dropped — that host takes
  // over the claim itself). The modal stays open so the template-driven `submitInFlight` /
  // `resultState` can render submitting → done / fail.
  const handleSubmitClaim = (winner: LBWinner, email: string): void => {
    model.submitClaim(winner, email);
    onSubmitClaim?.(winner, email);
    onClaim?.(winner);
  };

  // Close the claim modal (✕ /「關閉視窗」/ `done` 點 scrim).
  //
  // 🔴 純 dismiss：先讓 view-model 清掉本次領獎的呈現暫態（`dismissClaim()` 只清
  // `awardClaimResultState` + `submitInFlight`），再清容器的呈現綁定。MUST NOT 從
  // `unclaimedWinners` 移除該 winner、MUST NOT 呼叫任何 API、MUST NOT 遞減未領徽章 ——
  // 設計稿的強勸阻文案是刻意的 UX 摩擦，行為不跟隨文案（R13 刻意分歧 1/2）。
  const handleDismissClaim = (): void => {
    model.dismissClaim();
    setOpenClaimWinner(null);
    // rb-rn-win-claim-pagination — reset the page so the NEXT open (a fresh tap, which re-seeds
    // it via `handleOpenClaim` anyway) never starts from a stale leftover index.
    setClaimPageIndex(0);
    onDismissClaim?.();
  };

  // rb-rn-win-claim-pagination — flip to a specific page within `model.unclaimedWinners` (dot tap
  // or a qualifying swipe inside `WinClaimSheetView`). Bounds-checked against the CURRENT list
  // length: an out-of-range `index` (e.g. the list shrank between renders) is a safe no-op rather
  // than seeding `openClaimWinner` with `undefined`. Presentation only, no core call — mirrors
  // `handleOpenClaim`'s "no API" posture.
  const handlePageClaim = (index: number): void => {
    const winners = model.unclaimedWinners;
    if (index < 0 || index >= winners.length) return;
    setClaimPageIndex(index);
    setOpenClaimWinner(winners[index]);
  };

  // rb-rn-live-activity-sheet — open the activity sheet. Presentation only, no core call; the
  // sheet always reads the CURRENT `model.currentActivity` when it renders (there is no data to
  // carry at open time — unlike `handleOpenClaim`, which pins a specific tapped winner).
  const handleOpenActivity = (): void => {
    setActivitySheetOpen(true);
  };

  // Close the activity sheet (scrim tap). Pure dismiss — does NOT touch `currentActivity` (the
  // activity keeps running; closing this sheet is not the same as the activity ending, parity the
  // win-claim sheet's own dismiss-is-not-forfeit convention).
  const handleCloseActivitySheet = (): void => {
    setActivitySheetOpen(false);
  };

  // rb-rn-activity-sheet-pagination (activity-sheet-pagination-reference-ui-rn) — flip to a
  // specific page within `model.activities` (dot tap or a qualifying swipe inside
  // `ActivitySheetView`). UNLIKE `handlePageClaim` above, this container does NOT hold a second
  // local copy of the page index (no `useState` here) — the page index is already owned by the
  // bound template (`DefaultPlayerTemplate.currentActivityPageIndex`, set via
  // `setActivityPageIndex`, internally clamped). This forwarder just relays the intent; the
  // template's own `notifyChange()` drives this container's EXISTING `subscribe()` tick re-read
  // (the `useEffect` near the top of this component), so `model.currentActivityPageIndex` /
  // `model.currentActivity` simply reflect the new value on the next render. No bounds-checking
  // needed here (the template already clamps).
  const handlePageActivity = (index: number): void => {
    model.setActivityPageIndex(index);
  };

  // Forward the「立即參加」CTA to the SAME `model.joinEvent` forwarder the merged feed's
  // `LBEventJoinLine`「加入活動」CTA already uses (design.md D4 — no second join path).
  // `activity.keyword` is OPTIONAL on `LBActiveEvent` (native omits it when the activity carries
  // no join keyword); this forwarder coalesces to `''` rather than widening `model.joinEvent`'s
  // `keyword: string` parameter to accept `undefined` for this one caller.
  //
  // rb-rn-activity-entry-cta-close (activity-entry-cta-close-rn): `model.joinEvent` returns a
  // `boolean` — whether the intent actually forwarded to the template, i.e. the three-tier
  // `event-join-gate` did NOT intercept it. `true` → close this sheet (`setActivitySheetOpen`
  // false); the `ActivitySheet` component itself stays fire-and-forget (unaware of this result —
  // it still flips its own local「已參加」state unconditionally). `false` → the gate intercepted
  // the intent (a login / nickname modal is about to present) — leave the sheet OPEN so the user
  // keeps the visual context of which activity they were joining while that modal is up.
  const handleJoinActivity = (): void => {
    const activity = model.currentActivity;
    if (activity == null) return;
    const forwarded = model.joinEvent(activity.id, activity.keyword ?? '');
    if (forwarded) setActivitySheetOpen(false);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Surface 1 — merged feed pinned to the bottom-leading LIVE region
          (the overlay chrome stream). Newest at the tail; non-scrolling column.
          LIVE-only + hidden while the info panel is up: dropped ENTIRELY when !chatVisible so
          its scrollable hit-testing neither occludes the info-panel sheet nor swallows the VOD
          side rail's taps (parity iOS rb-ios-hide-chat-feed-in-vod / -info-panel-not-covered). */}
      {chatVisible ? (
        // right:120 keeps the LEFT-column chat off the bottom-right pinned product card column
        // (parity iOS chatTrailingInset=liveChatTrailingClearance). LIVE-only (chatVisible gate).
        // left:10 aligns the feed's left edge with LiveBottomBarView's bag-icon left edge
        // (BAR_H_PADDING=10) — rb-rn-live-chat-card-edge-align (parity iOS liveChatLeadingClearance).
        // bottom: 動態避讓 — 有公告（model.hasAnnounce）時往上讓出 LBLiveAnnounce 橫幅高度（96→140，
        // rb-rn-live-announce-chat-clearance 問題4）；無公告 → 96（既有 baseline）。
        <View style={{ position: 'absolute', left: 10, right: 120, bottom: liveChatBottomInset(model.hasAnnounce) }}>
          {/* rb-rn-activity-toast — 群組②「炒氣氛提示」(進場/選購/搶購/中獎) now surfaces HERE,
              above the merged feed, as a transient latest-only toast (moments.jsx `LBActivityToast`
              2026-07-03 呈現位置改版) — ChatFeed itself no longer dispatches 'activity' rows
              (`isChatFeedRow`). Always reads the ambient `feedItems` (N=7 tail), independent of
              the `chatScrollable` history toggle below (the latest activity item is identical
              either way — both are suffixes of the same underlying buffer). */}
          <ActivityToastView theme={theme} items={model.feedItems} />
          {/* Scrollable variant binds the deeper history (scroll up for history); the
              ambient / snapshot path keeps the N=7 feedItems. The base anchor already
              clears the LIVE bottom bar (#2 satisfied by construction on RN). */}
          <ChatFeed
            theme={theme}
            items={chatScrollable ? model.feedHistory : model.feedItems}
            hostScrollable={chatScrollable}
            onJoin={handleJoin}
            // chat-message-taxonomy ⑤ — 置頂留言橫幅（無釘選 → null → 不出像素）。
            pinned={model.pinned}
            // EventJoinLineRow 主播訊息氣泡 header（rb-rn-loading-announce-restyle）。
            hostName={model.hostName}
          />
        </View>
      ) : null}

      {/* Surface 2 — floating entry column pinned to the RIGHT side, top edge at 25% of the
          container height (parity `moments.jsx` `LBWinEntry` `top:'25%'` / iOS `WinEntryView` /
          Android `WinEntry` rb-{ios,android}-win-entry-restyle — this restyle's
          rb-rn-win-entry-restyle raises the prior 42% pin to 25%, purely a container-layer
          position change; the entry's own visual is unaffected).
          rb-rn-live-activity-sheet (design.md D1) — `WinEntry` and the new `ActivityEntry` now
          share ONE flex-column wrapper (`gap:10`) rather than each owning its own absolute
          `top:'25%'` View: the design's `calc(25% + 58px)` expression is web CSS RN's
          `StyleSheet` cannot evaluate (`top` takes a number / percentage string, not arithmetic).
          Each child keeps its OWN "return null when below threshold" convention
          (`unclaimedCount <= 0` / `currentActivity == null`) — flex treats a `null` render as
          absent, so `gap` never leaves a blank slot: whichever ONE entry is eligible sits alone
          at `top:25%`.
          rb-rn-activity-entry-stack-reversal (R27, design.md D1) — the two entries' PRIMARY /
          SECONDARY roles are flipped from `rb-rn-live-activity-sheet`'s original order: render
          order below is now `ActivityEntry` FIRST, `WinEntry` SECOND, so when BOTH are eligible
          「活動」sits above「中獎」with exactly 58px between them (48px button + 10px gap).
          Because the stacking mechanism is flex order (not an explicit numeric offset), flipping
          which entry is primary is PURELY this render-order swap — neither entry's own
          eligibility gate nor the wrapper's own style values changed. rb-rn-clean-mode-hide-chat-
          feed: NEITHER entry is gated by `cleanMode` — unaffected, always drawn per its own
          threshold rule (see `FeedWinViewProps.cleanMode`'s doc comment). */}
      <View
        style={{
          position: 'absolute',
          right: 12,
          top: '25%',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <ActivityEntry
          theme={theme}
          currentActivity={model.currentActivity}
          onOpen={handleOpenActivity}
        />
        <WinEntry
          theme={theme}
          unclaimedCount={model.unclaimedCount}
          unclaimedWinners={model.unclaimedWinners}
          onOpen={handleOpenClaim}
        />
      </View>

      {/* Surface 3 — 四階段領獎 modal, presented over the feed when an entry has been
          opened (presentation-only open state; `submitInFlight` / `resultState` are
          template-driven, rb-rn-win-claim-email-flow). rb-rn-clean-mode-hide-chat-feed:
          WinClaimSheetView is NOT gated by `cleanMode` — unaffected, governed only by
          `openClaimWinner`.

          rb-rn-win-claim-pagination — `pageCount`/`pageIndex`/`onPage` thread `model.
          unclaimedWinners.length` / `claimPageIndex` / `handlePageClaim` through so the sheet can
          page between simultaneous unclaimed prizes (dots + swipe). `key={openClaimWinner.id}`
          forces React to fully UNMOUNT/REMOUNT `WinClaimSheet` whenever the displayed winner
          changes — whether from a fresh `handleOpenClaim` tap or a `handlePageClaim` page flip —
          which resets its local `phase`/`email`/`copied` state (design.md Decision 1). Without
          this key, paging from winner A mid-`confirmSubmit` to winner B would leave the component
          logically "inside" A's confirm alert while displaying B's data; keying by id is the
          direct RN analogue of the design source's own `<LBWinSheet key={mode} .../>` demo-harness
          remount pattern. */}
      {openClaimWinner != null ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <WinClaimSheet
            key={openClaimWinner.id}
            theme={theme}
            winner={openClaimWinner}
            classification={model.classify(openClaimWinner)}
            resultState={model.resultState}
            submitInFlight={model.submitInFlight}
            onSubmit={(email): void => handleSubmitClaim(openClaimWinner, email)}
            onDismiss={handleDismissClaim}
            onCopyCode={onCopyClaimCode}
            onOpenTermsOfUse={(): void => openLegalLink(LBLegalLinks.termsOfUse)}
            onOpenPrivacyPolicy={(): void => openLegalLink(LBLegalLinks.privacyPolicy)}
            pageCount={model.unclaimedWinners.length}
            pageIndex={claimPageIndex}
            onPage={handlePageClaim}
          />
        </View>
      ) : null}

      {/* Surface 4 — 抽獎活動彈窗 (rb-rn-live-activity-sheet), presented over the feed when the
          activity entry has been opened AND there is still a running activity to show
          (`activitySheetOpen && model.currentActivity != null` — the second half of this guard
          protects against the activity ending — via a future video-switch `clear()` — while the
          sheet happens to be open; `ActivitySheet.activity` is a REQUIRED, non-nullable prop, so
          this component is only ever mounted once a value exists). rb-rn-clean-mode-hide-chat-feed:
          NOT gated by `cleanMode`, same boundary as `WinEntry` / `WinClaimSheetView` above.

          rb-rn-activity-sheet-pagination (activity-sheet-pagination-reference-ui-rn) —
          `pageCount`/`pageIndex`/`onPage` thread `model.activities.length` /
          `model.currentActivityPageIndex` / `handlePageActivity` through so the sheet can page
          between simultaneously running activities (dots + swipe). UNLIKE Surface 3's
          `WinClaimSheet` above, this does NOT need a `key`-forced remount on page flip: the page
          index is owned entirely by the template (not a per-open container `useState` like
          `openClaimWinner`), and `ActivitySheet` holds NO local UI state at all
          (rb-rn-activity-sheet-cta-repeatable removed its former one-shot `joined` CTA-lock flag —
          the CTA is now stateless and repeatable), so there is nothing for a page flip to
          reset — paging to a different simultaneously-running activity is not "a fresh open" the
          way tapping a new winner is. */}
      {activitySheetOpen && model.currentActivity != null ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <ActivitySheet
            theme={theme}
            activity={model.currentActivity}
            onClose={handleCloseActivitySheet}
            onJoin={handleJoinActivity}
            onOpenTermsOfUse={(): void => openLegalLink(LBLegalLinks.termsOfUse)}
            onOpenPrivacyPolicy={(): void => openLegalLink(LBLegalLinks.privacyPolicy)}
            pageCount={model.activities.length}
            pageIndex={model.currentActivityPageIndex}
            onPage={handlePageActivity}
          />
        </View>
      ) : null}
    </View>
  );
}
