// GapSurfacesOverlayView — family-6 gap-surface modal container (RN SKELETON).
//
// Spec: `reference-ui-rendering/spec.md` (family-6 gap-surfaces, 2 ADDED modals).
// Phase-4 RN sibling of the DONE iOS `GapSurfacesOverlayView.swift`
// (rb-ios-gap-surfaces), Android `GapSurfacesOverlayView.kt` (rb-android-gap-surfaces),
// and Flutter `gap_surfaces_view.dart` (rb-flutter-gap-surfaces — the authoritative
// blueprint translated here 1:1).
//
// The top-level family-6 container. It conditionally shows the single ACTIVE
// gap-surface modal over the player area — at most ONE modal on screen:
//
//   1. AuthGateModal       — 「請先登入」gate (`LBAuthGateState`)
//   2. GuestNameEditModal  — guest display-name edit (`LBIdentityLabel`)
//
// ─────────────────────────────────────────────────────────────────────────────
// RN vs Android SCOPE — this change is PURELY ADDITIVE (2 ADDED, 0 MODIFIED)
// ─────────────────────────────────────────────────────────────────────────────
// iOS family-6 was reconciled to: auth-gate modal + guest-name-edit modal, PLUS
// folding 公告 into family-1 `VideoInfoPanel` and 收藏鈕 into family-3
// `ProductDetail`. Android gap-surfaces needed 2 ADDED + 2 MODIFIED because Android
// family-1/3 were built BEFORE the reconcile. The RN family-1
// (`playershell/VideoInfoPanelView.tsx` 公告 notice-tab two-segment) and family-3
// (`productsheets/ProductDetailSheetView.tsx` 收藏鈕) were built AFTER the reconcile
// and ALREADY carry those surfaces. So the RN gap-surfaces change is PURELY ADDITIVE
// — ONLY the 2 NEW modals here; ZERO MODIFIED. This container touches NEITHER
// `VideoInfoPanelView.tsx` NOR `ProductDetailSheetView.tsx`.
//
// ─────────────────────────────────────────────────────────────────────────────
// MODAL PRIORITY (mutually exclusive — at most ONE modal is shown)
// ─────────────────────────────────────────────────────────────────────────────
//   1. authGate != null && !isLoggedIn        → AuthGateModal       (HIGHEST)
//   2. else showNameEdit                       → GuestNameEditModal
//   3. else                                    → nothing (`null`)
//
// The auth-gate modal wins: an un-intercepted `AUTH_REQUIRED` is a blocking
// 「請先登入」prompt, so it pre-empts the (host-triggered) guest-name editor. Once
// the user logs in (`isLoggedIn` flips true), the auth-gate state clears (core
// clears it on `AUTH_STATE_CHANGED.logged_in`) and the gate falls away.
//
// ─────────────────────────────────────────────────────────────────────────────
// HOST-WIRED ACTION CALLBACKS + the ONE core exit (Model is PURE read-only)
// ─────────────────────────────────────────────────────────────────────────────
// login / dismiss are HOST-WIRED CONTAINER callbacks — EXACTLY like family-2's
// event-join / family-3's product-tap / family-4's moment exits (the actual login /
// clearAuthGate is the host's / core's job, not this layer's). submit-name's TURNKEY
// default funnels to the guest-nickname core exit through the gap seam (the container
// already depends on core), but a host override REPLACES it. The exits:
//   • onLogin       → host → `LivebuySDK.login(...)` (open the host's login flow)
//   • onDismiss     → host → `template.clearAuthGate()` (auth-gate「稍後再說」/ scrim)
//   • onSubmitName  → turnkey checkName-驗證的 `playerRef.setGuestNicknameVerified(name)`
//                     (rb-rn-nickname-taken-inline-error; NEVER `setUser` — 設名 ≠ 登入; and no
//                     longer the older unvalidated `LivebuySDK.setGuestNickname`), or the host
//                     override. Wired via the gap seam in `LivebuyPlayerOverlays`. Only a
//                     SUCCESSFUL verification dismisses; a rejection keeps the modal open and
//                     surfaces an inline error (see `submitting` / `submitFailure` below).
//   • guest-name scrim → `nicknameController.dismiss()` (close-only; does NOT clear the gate)
//
// The ONLY core exit this container funnels DIRECTLY is the rename ENTRY:
// `handleRequestNameEdit()` calls `template?.requestGuestNameEdit()` — the headless
// core exit that emits `GUEST_NAME_EDIT_REQUEST` (a safe no-op if the host wired no
// requester). That is a fire-and-forget INTENT, not a state mutation; the container
// owns NO core action beyond it (it MUST NOT call `LivebuySDK.login` / `setUser` /
// `clearAuthGate` itself — those flow through the host callbacks). The
// {@link GapSurfacesModel} carries NO mutating forwarder (mirrors iOS / Android /
// Flutter `GapSurfacesModel`, all pure read-only snapshots).
//
// Every callback is optional, so the container renders correctly action-free
// (demo / golden / structural-snapshot tests construct it without host wiring); an
// omitted callback means the corresponding CTA is inert.
//
// ─────────────────────────────────────────────────────────────────────────────
// SUB-VIEW INPUT PATTERN — the contract the 2 Surfaces agents MUST follow
// ─────────────────────────────────────────────────────────────────────────────
// Every family-6 modal surface is a function component
// `(props: { theme: ReferenceUITheme; ...byValueSnapshot; ...trailingCallbacks })`
// returning `ReactElement`, with props IN THIS ORDER:
//
//   1. `theme` (ReferenceUITheme)   — FIRST, always.
//   2. its bound SNAPSHOT VALUE(S)  — read-only state, passed BY VALUE from the
//                                      GapSurfacesModel (never the model, never the
//                                      template).
//   3. optional action callbacks    — trailing, EACH defaulting to a no-op. The
//                                      container owns NO host action; the host wires
//                                      the exits.
//
// A surface reads ONLY its passed-in values — it MUST NOT reach back into the
// GapSurfacesModel or DefaultPlayerTemplate (one-way data flow), MUST NOT hold a
// second copy of the auth-gate / identity state, MUST render correctly with all
// callbacks omitted (so structural-snapshot tests construct it action-free), and MUST
// use plain View/Text/Pressable only (NO ScrollView/FlatList/SectionList/
// VirtualizedList; NO network-uri Image; NO animation / randomness; Text-glyph icons
// e.g. lock 🔒 / person 👤). Both modals are LBPAlertModal-style centered cards on a
// black 0.55 scrim (tap = dismiss; card radius 18, theme.background).
//
// The two Surfaces agents implement EXACTLY these prop signatures (see the call sites
// in the render body below):
//
//   AuthGateModal(props: {
//       theme: ReferenceUITheme;
//       gate: LBAuthGateState;                         // non-null (container gates on non-null)
//       isLoggedIn?: boolean;                          // read-only convenience (modal shown only !isLoggedIn)
//       onLogin?: () => void;                          // 前往登入 → host (LivebuySDK.login)
//       onDismiss?: () => void;                        // 稍後再說 / scrim → host (clearAuthGate)
//   }): ReactElement
//
//     依 `gate.triggerAction` 切換人話文案 (NO raw code): `CartAdd`「登入後即可將商品
//     加入購物車」/ `CommentSend`「登入後即可參與留言互動」/ `CouponClaim`「登入後即可
//     領取優惠與獎品」/ `Other`「登入後即可使用完整功能」. Centered card: overhanging
//     accent lock badge + title「請先登入」+ trigger-specific body + vertical
//     two-button footer (primary「前往登入」→ onLogin / plain「稍後再說」→ onDismiss).
//     GATE RULE: if (isLoggedIn || gate == null) render nothing. reference-ui NEVER
//     logs in / clears the gate itself — it ONLY forwards onLogin / onDismiss.
//
//   GuestNameEditModal(props: {
//       theme: ReferenceUITheme;
//       displayName: string;                           // current name (seeds the field)
//       editable?: boolean;                            // demo/golden MUST pass false → static placeholder Text
//       submitting?: boolean;                          // rb-rn-nickname-taken-inline-error: CTA disabled +「送出中…」
//       submitFailure?: ('taken' | 'other') | null;    // rb-rn-nickname-taken-inline-error: inline error text
//       onSubmit?: (name: string) => void;             // 送出 → host (turnkey: checkName-驗證的 setGuestNicknameVerified)
//       onDismiss?: () => void;                         // scrim → host (close)
//   }): ReactElement
//
//     Centered card: floating logo badge (accent circle + person glyph) + title
//     「設定暱稱」+ subtitle「請輸入直播留言的暱稱」+ input row (person icon + field) +
//     送出 primary (enabled only when trimmed length 1..10 AND !submitting). CRITICAL
//     golden lesson (from iOS family-6): a LIVE `TextInput` renders as a yellow/red
//     unsupported-control box under the structural renderer — so the surface MUST take
//     `editable: boolean` and, when `false` (demo / golden), render a STATIC
//     placeholder `Text`「暱稱字數上限 10 個字」instead of a real field; only when
//     `true` (host runtime) does it use a real `TextInput`. `submitting` /
//     `submitFailure` (rb-rn-nickname-taken-inline-error, additive, default `false` /
//     `null`) drive the送出中 CTA label + the inline error text below the input row when
//     a checkName-gated submit is rejected. reference-ui NEVER calls `setUser` /
//     `setGuestNicknameVerified` itself — it ONLY forwards the typed name to onSubmit
//     (still `(name: string) => void` — the three-state result is carried by the bound
//     `submitting` / `submitFailure` props, NOT by onSubmit's return value; see this
//     change's design.md Decision 1 for why onSubmit stays void-returning).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import type { ReferenceUITheme } from '../theme';
import type {
  NicknamePromptController,
  LoginPromptController,
} from '../container/ChatComposerBar';
import { GapSurfacesModel, GapSurfacesSeeds } from './GapSurfacesModel';
import { lbForwardLogin } from '../container/seams';

import { AuthGateModal } from './AuthGateModalView';
import { GuestNameEditModal } from './GuestNameEditModalView';

import type { DefaultPlayerTemplate, LBAuthGateState } from 'livebuy-react-native-ui';
import { LBAuthTriggerAction } from 'livebuy-react-native-ui';

// Re-export the two family-6 gap-surface modals so hosts (and the family barrel) can
// pull them from the container module (parity with the iOS/Android/Flutter family
// barrels).
export { AuthGateModal } from './AuthGateModalView';
export { GuestNameEditModal } from './GuestNameEditModalView';

/** Props for the family-6 gap-surfaces container. */
export interface GapSurfacesOverlayViewProps {
  /** Live template (host-supplied). `null`/omitted → deterministic demo seeds. */
  readonly template?: DefaultPlayerTemplate | null;

  /** The resolved reference-ui theme. */
  readonly theme: ReferenceUITheme;

  // Host-wired interaction callbacks. The container owns NO host action (the lone core
  // exit it owns is `template.requestGuestNameEdit()`); each callback is forwarded to
  // the host (which wires it to the core exit). All optional; an omitted callback means
  // an inert CTA. The Model carries NO forwarder for these (gap-surface actions are NOT
  // template state-mutating methods — mirrors iOS / Android / Flutter `GapSurfacesModel`).

  /** Auth-gate「前往登入」→ host → `LivebuySDK.login(...)` (open login flow). */
  readonly onLogin?: () => void;
  /**
   * Auth-gate「稍後再說」/ scrim tap → host → `template.clearAuthGate()`; also closes
   * the guest-name editor. This layer NEVER clears the gate itself.
   */
  readonly onDismiss?: () => void;
  /**
   * Guest-name「送出」→ host → the turnkey checkName-驗證的
   * `playerRef.setGuestNicknameVerified(name)` (the turnkey container wires this through the gap
   * seam; rb-rn-nickname-taken-inline-error — it is NO LONGER the older unvalidated
   * `LivebuySDK.setGuestNickname`). This layer NEVER calls the SDK itself; it ONLY forwards the
   * typed name — the verification's three-state outcome comes BACK through
   * {@link nicknameController}'s `submitting` / `submitFailure`, never through this callback's
   * return value (it stays `void`-returning).
   */
  readonly onSubmitName?: (name: string) => void;
  /**
   * The container's 設定暱稱 modal controller (parity iOS / Android). When wired (host runtime),
   * it DRIVES the guest-name modal's visibility (`isOpen`) — replacing the dead local
   * `showNameEdit` state that nothing could flip from outside — and the modal renders a LIVE
   * editable `TextInput`. When omitted (demo / standalone / structural snapshot) the modal stays
   * controlled by the local state (default closed) and renders the static placeholder, so the
   * baselines stay byte-identical. A guest-name scrim dismiss funnels to `controller.dismiss()`,
   * SEPARATE from the auth-gate `onDismiss` (which clears the auth gate).
   */
  readonly nicknameController?: NicknamePromptController;
  /**
   * The container's「請先登入」modal controller (rb-rn-live-comment-login-gate, 方案 A). When wired
   * (host runtime) and `isOpen`, the container composes `AuthGateModal` with a synthetic
   * `CommentSend` gate — raised when a guest taps the LIVE 留言 pill on a `chatEnabled === false`
   * live (`guest_comment == 0`). 前往登入 → host `onLogin` + `dismiss`; 稍後再說 / scrim → `dismiss`.
   * Default unwired → not shown (snapshot-neutral). SEPARATE from the template-driven auth gate.
   */
  readonly loginController?: LoginPromptController;
}

/**
 * The family-6 gap-surface modal container. Subscribes to the bound template's
 * coalesced `subscribe()` notification, re-reads the read-only {@link GapSurfacesModel}
 * on each notify (via a `useState` tick), and shows the single ACTIVE modal (auth-gate
 * > guest-name-edit, mutually exclusive) by passing snapshot values BY VALUE to the
 * surface components. Paints with the resolved {@link ReferenceUITheme}. login /
 * dismiss / submit are host-wired container callbacks; the rename ENTRY funnels to the
 * core exit `template.requestGuestNameEdit()`.
 *
 * `template == null` → the container uses the deterministic {@link GapSurfacesSeeds}
 * (nothing to subscribe to); the host normally supplies a live
 * {@link DefaultPlayerTemplate}.
 */
export function GapSurfacesOverlayView(
  props: GapSurfacesOverlayViewProps,
): ReactElement | null {
  const {
    template = null,
    theme,
    onLogin,
    onDismiss,
    onSubmitName,
    nicknameController,
    loginController,
  } = props;

  // Coalesced re-read tick (parity with the family-1/2/3/4/5 containers + the Flutter
  // ListenableBuilder re-read). On each template notify we bump the tick so React
  // re-renders and re-reads every getter off a freshly-constructed read-only model
  // (the model holds no state of its own). The demo path (template == null) has nothing
  // to subscribe to and renders the seeds.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (template == null) return;
    const unsubscribe = template.subscribe(() => setTick((t) => t + 1));
    return unsubscribe;
  }, [template]);

  // Whether the host-triggered guest-name editor is open. Unlike the auth-gate (whose
  // visibility is template state), the rename modal has NO template visibility flag.
  // When the container wires `nicknameController` (host runtime), IT is the source of
  // truth (`controller.isOpen`); otherwise this local state governs visibility (default
  // closed → snapshot-neutral). Demo / golden flip the local state directly.
  const [showNameEdit, setShowNameEdit] = useState(false);

  // The guest-name modal is open when the wired controller says so (host runtime), else
  // when the local state is set (demo / standalone). A wired controller ALSO means we are
  // at runtime, so the field renders as a LIVE editable `TextInput` (the demo / golden path
  // — no controller — keeps the static placeholder, baselines byte-identical).
  const nameEditOpen = nicknameController != null ? nicknameController.isOpen : showNameEdit;
  const nameEditEditable = nicknameController != null;

  const model = new GapSurfacesModel(template);

  // -- Host-wired action funnels + the ONE core exit --------------------------
  //
  // login / dismiss / submit forward to the host callback (the host wires it to the
  // core exit it owns: LivebuySDK.login / clearAuthGate / setUser). The rename ENTRY is
  // the ONLY core exit this container funnels directly
  // (`template.requestGuestNameEdit()`). reference-ui NEVER logs in / sets the user /
  // clears the gate itself; the Model carries NO forwarder.

  // 「前往登入」on the auth gate forwards `onLogin` DIRECTLY (optional — undefined when host did not
  // wire `config.onLogin`, so `AuthGateModal` hides the dead button; dropin-hide-unwired-affordances-rn).
  // MUST NOT wrap into an eternally-defined fn.

  // Auth-gate「稍後再說」/ scrim → host (→ `clearAuthGate()`). The blocking auth-gate's dismiss
  // is SEPARATE from the guest-name editor's dismiss (parity iOS / Android): clearing the auth
  // gate MUST NOT be triggered by closing the (non-blocking) 設定暱稱 modal.
  const handleAuthDismiss = (): void => {
    onDismiss?.();
  };

  // Guest-name editor scrim / close → close the modal ONLY (controller-driven when wired, else
  // local state). Does NOT clear the auth gate (so it never calls `onDismiss`).
  const handleNameDismiss = (): void => {
    setShowNameEdit(false);
    nicknameController?.dismiss();
  };

  // Forward the typed display name on「送出」→ host (→ the gap seam's turnkey checkName-驗證的
  // `playerRef.setGuestNicknameVerified`; rb-rn-nickname-taken-inline-error). 🔴 That seam dismisses
  // the controller ONLY on a SUCCESSFUL verification — a rejected name (taken / other error) leaves
  // the controller OPEN and instead sets `submitFailure` so this container re-renders the modal with
  // an inline error for the user to retry. (Before that change the seam dismissed unconditionally;
  // this comment used to say so, and saying so now would be false.)
  //
  // The local `showNameEdit` clear below is UNCONDITIONAL and stays that way on purpose: it governs
  // ONLY the no-controller demo / standalone path, which has no verification round-trip at all (the
  // seam that would run one is never wired there). Whenever a controller IS wired it owns visibility
  // outright (`nameEditOpen` reads `nicknameController.isOpen`), so this line cannot close a modal
  // that a rejected submit is meant to keep open.
  const handleSubmitName = (name: string): void => {
    setShowNameEdit(false);
    onSubmitName?.(name);
  };

  // Login-gate「前往登入」→ dismiss the local modal + host login flow (`config.onLogin`, reuse the
  // same host exit as the auth gate). Optional-preserving (lbForwardLogin): undefined onLogin → undefined
  // → button hidden (dismiss still via 稍後再說). reference-ui NEVER logs in itself.
  const handleLoginGateLogin = lbForwardLogin(onLogin, () => {
    loginController?.dismiss();
  });

  // Login-gate「稍後再說」/ scrim → dismiss the local modal ONLY (does NOT clear the template auth gate).
  const handleLoginGateDismiss = (): void => {
    loginController?.dismiss();
  };

  // The rename ENTRY — funnels DIRECTLY to the core exit
  // `template.requestGuestNameEdit()` (emits `GUEST_NAME_EDIT_REQUEST`; safe no-op when
  // the host wired no requester). This is the one core exit the container owns. A host
  // entry-point (e.g. a 「編輯名稱」affordance composed elsewhere) calls this to fire the
  // intent AND open the local editor. Mutually exclusive with the auth-gate (the
  // auth-gate wins in the render body regardless).
  //
  // Exposed for the host / demo to open the editor; never called automatically.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleRequestNameEdit = (): void => {
    template?.requestGuestNameEdit();
    setShowNameEdit(true);
  };

  // The single active modal by priority, or `null` when no gap surface is active.
  // Mutually exclusive — the blocking auth-gate wins, then the host-triggered
  // guest-name editor.
  const authGate = model.authGate;
  const isLoggedIn = model.isLoggedIn;

  if (authGate != null && !isLoggedIn) {
    // 1. 「請先登入」gate — HIGHEST priority (blocking). The surface takes a non-null
    //    gate (the container gates on non-null here).
    return (
      <AuthGateModal
        theme={theme}
        gate={authGate}
        isLoggedIn={isLoggedIn}
        onLogin={onLogin}
        onDismiss={handleAuthDismiss}
      />
    );
  }

  if (loginController?.isOpen) {
    // 1b. drop-in login gate, raised locally by a container gate: the LIVE 留言 login gate (guest
    //     taps 留言 on a `chatEnabled === false` live, `guest_comment == 0`; rb-rn-live-comment-
    //     login-gate, 方案 A) OR the 訂閱 login gate (guest taps subscribe; rb-rn-subscribe-login-
    //     gate). Compose `AuthGateModal` with a SYNTHETIC gate whose `triggerAction` follows
    //     `loginController.triggerAction` (CommentSend for 留言 / 暱稱, Subscribe for 訂閱) so the
    //     body copy is dynamic (parity iOS `AuthGateModalView(triggerAction: loginController
    //     .triggerAction)` / Android `loginGateTriggerAction`); `isLoggedIn={false}` (a guest
    //     raised it). 前往登入 → host login + dismiss; 稍後再說 / scrim → dismiss. SEPARATE from the
    //     template-driven auth gate above (which wins if a real AUTH_REQUIRED is also pending).
    const loginGate: LBAuthGateState = {
      triggerAction: loginController?.triggerAction ?? LBAuthTriggerAction.CommentSend,
      productId: null,
      videoId: null,
    };
    return (
      <AuthGateModal
        theme={theme}
        gate={loginGate}
        isLoggedIn={false}
        onLogin={handleLoginGateLogin}
        onDismiss={handleLoginGateDismiss}
      />
    );
  }

  if (nameEditOpen) {
    // 2. Guest display-name editor. Visibility is driven by the wired `nicknameController`
    //    (host runtime) or the local state (demo / golden). Seeds the field from the current
    //    identity display name (or the demo guest seed when no live identity yet). `editable`
    //    is `true` only when a controller is wired (host runtime → real `TextInput`); demo /
    //    golden render the static placeholder (baselines byte-identical). The scrim funnels to
    //    `handleNameDismiss` (close-only; does NOT clear the auth gate). `submitting` /
    //    `submitFailure` (rb-rn-nickname-taken-inline-error) mirror the same controller-driven
    //    pattern as `editable`: forwarded straight from `nicknameController` when wired (host
    //    runtime), else the additive defaults (`false` / `null` — demo / golden byte-identical).
    return (
      <GuestNameEditModal
        theme={theme}
        displayName={
          model.identity?.displayName ?? GapSurfacesSeeds.guestIdentity.displayName
        }
        editable={nameEditEditable}
        submitting={nicknameController?.submitting ?? false}
        submitFailure={nicknameController?.submitFailure ?? null}
        onSubmit={handleSubmitName}
        onDismiss={handleNameDismiss}
      />
    );
  }

  // 3. No active gap surface.
  return null;
}
