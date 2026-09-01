// GapSurfacesModel — family-6 gap-surfaces read-only snapshot bridge (RN).
//
// Spec: `reference-ui-rendering/spec.md` (family-6 gap-surfaces, 2 ADDED modals).
// Phase-4 RN sibling of the DONE iOS `GapSurfacesModel.swift` (rb-ios-gap-surfaces),
// Android `GapSurfacesModel.kt` (rb-android-gap-surfaces), and Flutter
// `gap_surfaces_model.dart` (rb-flutter-gap-surfaces — the authoritative blueprint
// translated here 1:1).
//
// It bridges the headless template gap-surface view-models exposed by
// `DefaultPlayerTemplate` (obtained at runtime by the host via
// `attachPlayerTemplate`) into a read-only snapshot the two family-6 RN modal
// surface components read. It is a pure read-only MIRROR — IDENTICAL pattern to
// family-1 `PlayerShellModel` / family-2 `FeedWinModel` / family-3
// `ProductSheetsModel` / family-4 `MomentsModel`:
//
//   - It owns NO second copy of authoritative state. Every getter reads the
//     template's own public getter each call (`authGateState` / `identityLabelState`),
//     so there is nothing to drift from the template.
//   - It adds NO pixels and adds NO accessor / view-model to
//     `livebuy-react-native-ui` (a template-layer concern, out of scope here).
//
// ── CRITICAL: NO mutating forwarders (like family-4) ─────────────────────────────
//   The gap-surface actions — login (host → `LivebuySDK.login`) / dismiss
//   (host → `template.clearAuthGate()`) / submit-name (host → `LivebuySDK.setUser`) /
//   request-name-edit (core exit `template.requestGuestNameEdit()` emitting
//   `GUEST_NAME_EDIT_REQUEST`) — are NOT model methods. login / dismiss / submit are
//   HOST-WIRED CONTAINER callbacks (like family-2's event-join / family-3's
//   product-tap / family-4's moment exits), and request-name-edit is a CORE EXIT the
//   CONTAINER funnels DIRECTLY. So this model is a PURE read-only snapshot; it carries
//   NO mutating methods. The container (`GapSurfacesOverlayView`) holds the host-wired
//   exits (`onLogin` / `onDismiss` / `onSubmitName`) and the single core exit
//   (`template.requestGuestNameEdit()`). Do NOT invent template forwarders for
//   login / dismiss / submit — none belong on this model (mirrors iOS / Android /
//   Flutter `GapSurfacesModel`, all pure read-only snapshots).
//
// ── RN vs Android scope NOTE (this change is PURELY ADDITIVE — 2 ADDED, 0 MODIFIED) ─
//   Android family-6 needed 2 ADDED + 2 MODIFIED because Android family-1/3 were
//   built BEFORE the 2026-06-06 design reconcile. The RN family-1
//   (`playershell/VideoInfoPanelView.tsx` 公告 notice-tab two-segment) and family-3
//   (`productsheets/ProductDetailSheetView.tsx` 收藏鈕) were built AFTER the reconcile
//   and ALREADY carry those surfaces. So the RN gap-surfaces change is PURELY ADDITIVE
//   — ONLY the 2 NEW modals (auth-gate + guest-name-edit); ZERO MODIFIED. This model
//   touches NEITHER the family-1 公告 NOR the family-3 收藏 view-models.
//
// ── RN TEMPLATE BINDING NOTES ────────────────────────────────────────────────────
//   Confirmed by reading react-native-ui/src/{AuthGate.ts, DefaultTemplate.ts}:
//   • auth-gate is read via `template.authGateState: LBAuthGateState | null`
//     ({ triggerAction: LBAuthTriggerAction (cartAdd / commentSend / couponClaim /
//     other), productId: string | null, videoId: string | null }) — iOS
//     `authGate.current`, Android `authGateState.current`, Flutter
//     `authGate.current`.
//   • identity is read via `template.identityLabelState: LBIdentityLabel | null`
//     ({ displayName, isLoggedIn }). `isLoggedIn` is surfaced as a convenience getter
//     so the container can gate the auth-gate modal (shown only while NOT logged in)
//     without re-reaching into the template.
//
// React components re-render via the container's `useState` + the template's
// coalesced `subscribe()` (ChangeEmitter); on each notify the container RE-READS
// these getters off a freshly-constructed read-only model (the model holds no state
// of its own). It just centralizes the read mapping + deterministic demo seeds
// (parity with the Flutter `GapSurfacesModel`, which holds no Flutter state either).
//
// No react / react-native import here — pure reads + plain-literal demo seeds, so it
// stays unit-testable in a plain node environment.

import type { DefaultPlayerTemplate } from 'livebuy-react-native-ui';
import { LBAuthTriggerAction } from 'livebuy-react-native-ui';
import type { LBAuthGateState, LBIdentityLabel } from 'livebuy-react-native-ui';

/**
 * Read-only snapshot bridge for the family-6 gap-surface modals. Wraps a live
 * {@link DefaultPlayerTemplate}; every accessor reads the template's public getter
 * each call (no stored mirror). For demos / previews / structural snapshot tests,
 * construct with `template = null` and the accessors return the deterministic
 * at-attach defaults instead (matching a freshly-constructed template: no auth-gate /
 * no identity label); the surfaces' richer fixtures are passed by value from
 * {@link GapSurfacesSeeds} (parity with the Flutter `GapSurfacesModel(template: null)`).
 *
 * ★ CRITICAL: this model carries NO mutating forwarder. The gap-surface actions
 *   (login / dismiss / submit-name / request-name-edit) are HOST-WIRED container
 *   callbacks or a CONTAINER-owned core exit, NOT template methods on this model —
 *   mirrors iOS / Android / Flutter `GapSurfacesModel`.
 */
export class GapSurfacesModel {
  /** The bound template, or `null` for demo / snapshot instances. */
  readonly template: DefaultPlayerTemplate | null;

  /**
   * Bridge a live template (host-supplied) — or `null`/omitted for the
   * deterministic demo seeds (previews / structural snapshot tests).
   */
  constructor(template?: DefaultPlayerTemplate | null) {
    this.template = template ?? null;
  }

  // -- Surface 1: AuthGateModal ← 「請先登入」snapshot ---------------------------

  /**
   * Auth-gate「請先登入」snapshot (`DefaultPlayerTemplate.authGateState`); non-null
   * ONLY after an un-intercepted `AUTH_REQUIRED` (cleared on login or host-dismiss).
   * `{ triggerAction, productId, videoId }`. The container shows the auth-gate modal
   * ONLY while this is non-null AND NOT logged in. For demo instances returns `null`
   * (the at-attach default; the richer fixture is passed by value from
   * {@link GapSurfacesSeeds.cartAddGate}).
   */
  get authGate(): LBAuthGateState | null {
    return this.template?.authGateState ?? null;
  }

  // -- Surface 2: GuestNameEditModal ← identity label --------------------------

  /**
   * Identity-label snapshot (`DefaultPlayerTemplate.identityLabelState`); `null`
   * before the first `AUTH_STATE_CHANGED`. `{ displayName, isLoggedIn }`. The
   * guest-name-edit modal seeds its field from `displayName`. For demo instances
   * returns `null` (the at-attach default; the richer fixture is
   * {@link GapSurfacesSeeds.guestIdentity}).
   */
  get identity(): LBIdentityLabel | null {
    return this.template?.identityLabelState ?? null;
  }

  /**
   * Convenience: whether the user is logged in (`identity?.isLoggedIn`, default
   * `false`). Gates the auth-gate modal (shown only while NOT logged in) without the
   * container re-reaching into the template. Demo default `false`.
   */
  get isLoggedIn(): boolean {
    return this.template?.identityLabelState?.isLoggedIn ?? false;
  }
}

// MARK: - Deterministic demo seeds (previews / structural snapshot tests)

/**
 * Plain-literal deterministic seeds for the family-6 surfaces' previews + the
 * per-surface structural snapshot tests. Built from the public template value shapes
 * (`LBAuthGateState` / `LBIdentityLabel`) so a snapshot does NOT depend on a live
 * player. Mirrors the iOS demo seeds (the memberwise `GapSurfacesModel` demo init
 * values), the Android `GapSurfacesSeeds`, and the Flutter `GapSurfacesSeeds`.
 *
 * The golden baselines each drive ONE modal from these seeds:
 *   • {@link cartAddGate} — the auth-gate modal baseline (`auth-gate-modal-cart-add`,
 *     triggered by a gated 加入購物車 → 「請先登入」).
 *   • {@link guestIdentity} — the guest-name-edit modal baseline
 *     (`guest-name-edit-modal`, seeded from a guest display name).
 */
export const GapSurfacesSeeds = {
  // -- Surface 1: auth-gate「請先登入」-------------------------------------------

  /**
   * A deterministic auth-gate fixture raised by a gated add-to-cart
   * (`triggerAction == CartAdd`; no productId / videoId). Drives the
   * `auth-gate-modal-cart-add` baseline.
   */
  cartAddGate: {
    triggerAction: LBAuthTriggerAction.CartAdd,
    productId: null,
    videoId: null,
  } as LBAuthGateState,

  // -- Surface 2: guest identity label -----------------------------------------

  /**
   * A deterministic guest identity fixture (`Guest_4F2A`, not logged in). Drives the
   * `guest-name-edit-modal` baseline (the field seeds from `displayName`).
   */
  guestIdentity: {
    displayName: 'Guest_4F2A',
    isLoggedIn: false,
  } as LBIdentityLabel,
} as const;
