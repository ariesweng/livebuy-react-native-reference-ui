// AuthGateModalView — family-6 gap-surface 1 (「請先登入」auth-gate modal, RN).
//
// Spec: `reference-ui-rendering/spec.md` (family-6 gap-surfaces — the LAST Phase-4 RN
//        family; this surface is one of the 2 ADDED gap modals).
// Design: `design/templates/minimal/sdk-components.jsx` `LBPAuthGate` + `LBP_AUTH_COPY`
//          — a centered card over a black-0.55 scrim, 18pt corner card, OVERHANGING
//          accent lock badge, trigger-specific body, and a VERTICAL two-button footer
//          (`LBPButton` primary「前往登入」over plain「稍後再說」).
// Parity: iOS `GapSurfaces/AuthGateModalView.swift` (rb-ios-gap-surfaces +
//          rb-ios-gap-surfaces-design-reconcile), Android `gapsurfaces/AuthGateModalView.kt`
//          (rb-android-gap-surfaces), and the AUTHORITATIVE Flutter blueprint
//          `gapsurfaces/auth_gate_modal.dart` (rb-flutter-gap-surfaces), translated here
//          1:1. Structural snapshot parity name: `auth-gate-modal-cart-add`.
//
// The「請先登入」auth-gate modal for ONE pending un-intercepted `AUTH_REQUIRED`. It is
// the first of the TWO ADDED family-6 surface sub-views composed by
// `GapSurfacesOverlayView`, and it implements the agreed SUB-VIEW INPUT PATTERN
// documented verbatim in `GapSurfacesOverlayView.tsx`:
//
//   1. `theme` (ReferenceUITheme)  — FIRST, always.
//   2. bound SNAPSHOT VALUE(S) (read-only, BY VALUE):
//        `gate: LBAuthGateState`  — drives the body copy via `gate.triggerAction`;
//        `isLoggedIn?: boolean`   — read-only context.
//      Both passed BY VALUE from `GapSurfacesModel` (never the model, never the
//      template).
//   3. action callbacks (LAST, each defaulting to a no-op):
//        `onLogin`   (「前往登入」CTA → the HOST's own login flow wired by the
//                      container; reference-ui NEVER logs in itself), and
//        `onDismiss` (「稍後再說」/ scrim tap → host → `template.clearAuthGate()`).
//
// This sub-view reads ONLY its passed-in `gate` / `isLoggedIn`; it never reaches back
// into `GapSurfacesModel` / `DefaultPlayerTemplate` (one-way data flow), holds NO
// second copy of the auth-gate state, and renders correctly with all callbacks omitted
// (so demo / structural-snapshot tests construct it action-free).
//
// GATE RULE (read-only guard — mirrors the spec + iOS / Android / Flutter): if
// `isLoggedIn === true` (or `gate == null`) it draws NOTHING (returns `null`). The
// container's priority predicate (auth-gate shown only `authGate != null &&
// !isLoggedIn`) already encodes the same gate, so this is belt-and-braces /
// spec-literal — a logged-in user needs no login gate.
//
// RENDER DISCIPLINE (family-1..5 lessons, CRITICAL): plain `View` / `Text` / `Pressable`
// only — NO ScrollView / FlatList / SectionList / VirtualizedList, NO network-uri
// `Image`. The lock badge is a deterministic accent circle + a white Text glyph 🔒
// (react-native-vector-icons is unavailable in this layer). No animation / no
// randomness so the structural baseline is byte-stable.
//
// TRIGGER COPY TABLE (verbatim from the design's `LBP_AUTH_COPY` + iOS / Android /
// Flutter):
//   LBAuthTriggerAction.CartAdd     → 「登入後即可將商品加入購物車」
//   LBAuthTriggerAction.CommentSend → 「登入後即可參與留言互動」
//   LBAuthTriggerAction.CouponClaim → 「登入後即可領取優惠與獎品」
//   LBAuthTriggerAction.Subscribe   → 「登入後即可訂閱直播主，第一時間掌握開播與專屬優惠」(rb-rn-subscribe-login-gate)
//   LBAuthTriggerAction.Other       → 「登入後即可使用完整功能」(forward-compat bucket)

import type { ReactElement } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '../TightText';

import { LBTestIDs } from '../testing/LBTestIDs';
import type { ReferenceUITheme } from '../theme';
import { LBAuthTriggerAction } from 'livebuy-react-native-ui';
import type { LBAuthGateState } from 'livebuy-react-native-ui';

// MARK: - Decorative design tokens (literal minimal hex — NOT theme-resolved)
//
// accent / text / background come from the resolved `ReferenceUITheme`. These are
// FIXED decorative colors lifted verbatim from the design's `theme.surface.*` (light
// mode). They mirror the iOS / Android / Flutter `AuthGateModalView` static colors
// byte-for-byte so the four platforms read as one family.

/** Full-bleed dim scrim (`rgba(0,0,0,0.55)` — design `LBPAuthGate` backdrop). */
const SCRIM = 'rgba(0,0,0,0.55)';
/** `theme.surface.textDim` (secondary / body reason text). */
const TEXT_DIM = '#6B6775';
/** `theme.surface.strokeStrong` (plain-button outline —「稍後再說」border). */
const STROKE_STRONG = '#D8D5DE';
/** On-accent text (white) — primary CTA + lock glyph. */
const ON_ACCENT_TEXT = '#FFFFFF';

// MARK: - Fixed localized copy (static presentation strings, 繁中 — parity verbatim)

const TITLE = '請先登入';
const DISMISS_LABEL = '稍後再說';
const LOGIN_LABEL = '前往登入';

// Trigger-specific body copy — verbatim from the design's `LBP_AUTH_COPY`.
const BODY_CART_ADD = '登入後即可將商品加入購物車';
const BODY_COMMENT_SEND = '登入後即可參與留言互動';
const BODY_COUPON_CLAIM = '登入後即可領取優惠與獎品';
// 訂閱情境（rb-rn-subscribe-login-gate，parity iOS `bodySubscribe` / Android `BODY_SUBSCRIBE`）— 未登入點訂閱時顯示。
const BODY_SUBSCRIBE = '登入後即可訂閱直播主，第一時間掌握開播與專屬優惠';
const BODY_OTHER = '登入後即可使用完整功能';

/**
 * Trigger-specific body copy (`LBAuthTriggerAction` → 繁中 reason line). `.Other`
 * is the forward-compatible bucket (a generic「使用完整功能」line). Pure — maps the
 * PRE-CLASSIFIED trigger to human copy (NO raw code shown).
 */
export function authGateBodyCopy(triggerAction: LBAuthTriggerAction): string {
  switch (triggerAction) {
    case LBAuthTriggerAction.CartAdd:
      return BODY_CART_ADD;
    case LBAuthTriggerAction.CommentSend:
      return BODY_COMMENT_SEND;
    case LBAuthTriggerAction.CouponClaim:
      return BODY_COUPON_CLAIM;
    // 訂閱情境（rb-rn-subscribe-login-gate）— 未登入點訂閱時的訂閱專屬文案。
    case LBAuthTriggerAction.Subscribe:
      return BODY_SUBSCRIBE;
    // `.Other` is also the forward-compatible bucket for any unmapped trigger.
    case LBAuthTriggerAction.Other:
    default:
      return BODY_OTHER;
  }
}

/** Props for the {@link AuthGateModal} surface (SUB-VIEW INPUT PATTERN). */
export interface AuthGateModalProps {
  /** The resolved reference-ui theme (FIRST argument, always). */
  readonly theme: ReferenceUITheme;
  /**
   * The pending auth-gate SNAPSHOT VALUE (`triggerAction` drives the body copy), or
   * `null` when no gate is pending → draws nothing. Read-only, BY VALUE.
   */
  readonly gate: LBAuthGateState | null;
  /**
   * Whether the user is already logged in. When `true` the gate is suppressed (a
   * logged-in user needs no login gate). Read-only convenience; default `false`.
   */
  readonly isLoggedIn?: boolean;
  /**
   * Host-wired「前往登入」CTA → host → `LivebuySDK.login(...)` (open the host's login
   * flow). reference-ui NEVER logs in itself. Defaults to a no-op (demo / snapshot).
   */
  readonly onLogin?: () => void;
  /**
   * Host-wired「稍後再說」/ scrim tap → host → `template.clearAuthGate()`. This layer
   * NEVER clears the gate itself. Defaults to a no-op (demo / snapshot).
   */
  readonly onDismiss?: () => void;
}

/**
 * The family-6「請先登入」auth-gate modal for one pending `AUTH_REQUIRED`. Renders a
 * centered `LBPAuthGate` card (overhanging accent lock badge / title「請先登入」/
 * trigger-specific body / vertical two-button footer) over a black-0.55 scrim.
 * `gate.triggerAction` drives the body copy; `onLogin` / `onDismiss` are host-wired.
 *
 * GATE RULE: when `isLoggedIn === true` (or `gate == null`) it draws NOTHING (returns
 * `null`) — the gate is only for a pending un-intercepted `AUTH_REQUIRED` on a guest.
 * Renders correctly with the default no-op actions (snapshot / preview safe).
 */
export function AuthGateModal(props: AuthGateModalProps): ReactElement | null {
  const { theme, gate, isLoggedIn = false, onLogin, onDismiss } = props;

  // Read-only visibility guard (spec GATE RULE): logged-in OR no pending gate → nothing.
  if (isLoggedIn || gate == null) return null;

  const bodyCopy = authGateBodyCopy(gate.triggerAction);

  // Full-bleed dim scrim (LBPAuthGate backdrop). Tap = dismiss (design `onClick=
  // {onDismiss}`). The centered card sits in a Pressable that ABSORBS taps so tapping
  // inside the card does NOT dismiss; the accent lock badge overhangs the card top.
  return (
    <Pressable
      onPress={() => onDismiss?.()}
      testID={LBTestIDs.authGateScrim}
      style={{
        flex: 1,
        backgroundColor: SCRIM,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Pressable
        onPress={() => {}}
        style={{ width: '100%', maxWidth: 320, alignItems: 'center' }}
      >
        {/* Centered alert card (LBPAuthGate — radius 18 over theme.background). The
            34pt top padding clears the overhanging lock badge. */}
        <View
          testID={LBTestIDs.authGateModal}
          style={{
            alignSelf: 'stretch',
            marginHorizontal: 36,
            paddingHorizontal: 22,
            paddingTop: 34,
            paddingBottom: 20,
            backgroundColor: theme.background,
            borderRadius: 18,
          }}
        >
          <Text
            style={{
              color: theme.text,
              fontSize: 18 * theme.fontScale,
              fontWeight: '700',
              textAlign: 'center',
            }}
          >
            {TITLE}
          </Text>
          <View style={{ height: 8 }} />
          <Text
            style={{
              color: TEXT_DIM,
              fontSize: 13 * theme.fontScale,
              lineHeight: 13 * theme.fontScale * 1.6,
              textAlign: 'center',
            }}
          >
            {bodyCopy}
          </Text>
          <View style={{ height: 22 }} />
          <Footer theme={theme} onLogin={onLogin} onDismiss={onDismiss} />
        </View>

        {/* Overhanging accent lock badge — straddles the card top edge (design
            `top: -30`). Absolutely positioned + horizontally centered. */}
        <View
          style={{
            position: 'absolute',
            top: -30,
            left: 0,
            right: 0,
            alignItems: 'center',
          }}
        >
          <LockBadge theme={theme} />
        </View>
      </Pressable>
    </Pressable>
  );
}

// MARK: - Overhanging accent lock badge (LBPAuthGate brand badge)
//
// accent-filled 60×60 circle + a `theme.background` ring (4pt) + a white lock Text glyph
// 🔒 + a soft accent glow halo. Reads instantly as "login required" and keeps it
// on-brand. The glow mirrors the design badge `boxShadow: '0 8px 20px ${accent}55'`
// (iOS `.shadow(accent 0.33, r10, y8)` / Android deterministic radial) via RN's
// shadow* props (iOS) + `elevation` (Android).

function LockBadge(props: { theme: ReferenceUITheme }): ReactElement {
  const { theme } = props;
  return (
    <View
      style={{
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: theme.accent,
        borderWidth: 4,
        borderColor: theme.background,
        alignItems: 'center',
        justifyContent: 'center',
        // Soft accent glow halo (design boxShadow 0 8px 20px accent@0.33).
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.33,
        shadowRadius: 10,
        elevation: 8,
      }}
    >
      <Text style={{ fontSize: 26 * theme.fontScale, color: ON_ACCENT_TEXT }}>🔒</Text>
    </View>
  );
}

// MARK: - Vertical two-button footer (LBPButton primary over plain)
//
// Primary「前往登入」(accent fill, white fg) → onLogin, on TOP. Plain「稍後再說」
// (transparent fill, strokeStrong 1pt border, theme.text) → onDismiss, BELOW. Full
// width, 12pt corner, 13pt vertical padding, gap 10 (design `column`).

function Footer(props: {
  theme: ReferenceUITheme;
  onLogin?: () => void;
  onDismiss?: () => void;
}): ReactElement {
  const { theme, onLogin, onDismiss } = props;
  return (
    <View style={{ alignSelf: 'stretch' }}>
      {/* Primary「前往登入」(LBPButton primary). Rendered ONLY when host-wired (`onLogin != null`) —
          an un-wired login CTA is a dead button (reference-ui NEVER logs in itself;
          dropin-hide-unwired-affordances-rn). null → footer degrades to「稍後再說」only. */}
      {onLogin != null ? (
        <>
          <Pressable
            onPress={() => onLogin()}
            testID={LBTestIDs.authGateLogin}
            style={{
              paddingVertical: 13,
              borderRadius: 12,
              backgroundColor: theme.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: ON_ACCENT_TEXT,
                fontSize: 15 * theme.fontScale,
                fontWeight: '700',
              }}
            >
              {LOGIN_LABEL}
            </Text>
          </Pressable>
          <View style={{ height: 10 }} />
        </>
      ) : null}
      {/* Plain「稍後再說」(LBPButton plain). */}
      <Pressable
        onPress={() => onDismiss?.()}
        testID={LBTestIDs.authGateLater}
        style={{
          paddingVertical: 13,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: STROKE_STRONG,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: theme.text,
            fontSize: 15 * theme.fontScale,
            fontWeight: '700',
          }}
        >
          {DISMISS_LABEL}
        </Text>
      </Pressable>
    </View>
  );
}
