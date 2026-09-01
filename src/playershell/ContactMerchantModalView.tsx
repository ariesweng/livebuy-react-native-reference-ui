// ContactMerchantModalView — family-1「聯絡商家」confirm modal (LBPAlertModal, RN).
//
// Spec: `reference-ui-rendering/spec.md` (family-1 player-shell —「聯絡商家」確認 modal).
// Design: `design/templates/minimal/sdk-components.jsx` `LBPAlertModal` (centered card over a
//          black-0.55 scrim, 18pt corner card, HORIZONTAL two-button footer
//          [plain secondary][primary]) + `screens.jsx` `contact_merchant` state.
// Parity: iOS `ContactMerchantModalView.swift` + Android `ContactMerchantModalView.kt` +
//          Flutter `contact_merchant_modal.dart` (rb-*-contact-merchant-modal) — translated
//          1:1. Structural snapshot parity name: `contact-merchant-modal`.
//
// A presentation-only CONFIRM before opening the shop's customer-service link. The rail
// `serviceLink` tap and the VideoInfoPanel footer「與商家一對一對話」used to forward
// `onTapRailItem(serviceLink)` directly; now `PlayerShellView` presents THIS modal first and
// only the「確定」CTA proceeds to that existing host exit (per the design's `contact_merchant`
// flow). It owns NO link logic — it just forwards `onConfirm` / `onCancel`.
//
// SUB-VIEW INPUT PATTERN (family convention): `theme` first; then action callbacks (LAST,
// each optional). No bound snapshot value — the copy is fixed. Reads NOTHING back from the
// model (one-way data flow) and renders correctly with callbacks omitted (snapshot safe).
//
// RENDER DISCIPLINE (family lessons): plain `View` / `Text` / `Pressable` only — NO ScrollView
// / FlatList, NO network-uri `Image`, no animation / randomness. Mirrors `AuthGateModalView.tsx`
// (same LBPAlertModal shell) but WITHOUT the lock badge and with a HORIZONTAL two-button footer.
// The root is an ABSOLUTE-FILL overlay so the container can compose it over the player shell.

import type { ReactElement } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '../TightText';

import type { ReferenceUITheme } from '../theme';
import { LBTestIDs } from '../testing/LBTestIDs';

/** Full-bleed dim scrim (`rgba(0,0,0,0.55)` — design `LBPAlertModal` backdrop). */
const SCRIM = 'rgba(0,0,0,0.55)';
/** `theme.surface.textDim` (body text). Matches `AuthGateModalView`. */
const TEXT_DIM = '#6B6775';
/** `theme.surface.strokeStrong` (plain-button outline). Matches `AuthGateModalView`. */
const STROKE_STRONG = '#D8D5DE';
/** On-accent text (white) — primary CTA. */
const ON_ACCENT_TEXT = '#FFFFFF';

const TITLE = '聯繫商家';
const BODY = '確定要開啟商城指定的客服連結嗎?';
const CANCEL_LABEL = '取消';
const CONFIRM_LABEL = '確定';

/** Props for the {@link ContactMerchantModal} surface (SUB-VIEW INPUT PATTERN). */
export interface ContactMerchantModalProps {
  /** The resolved reference-ui theme (FIRST argument, always). */
  readonly theme: ReferenceUITheme;
  /**
   * Host-wired「確定」CTA → proceed to open the customer-service link (the container wires this
   * to `onTapRailItem(serviceLink)`). Defaults to a no-op (demo / snapshot).
   */
  readonly onConfirm?: () => void;
  /** 「取消」/ scrim tap → close the modal WITHOUT opening the link. Defaults to a no-op. */
  readonly onCancel?: () => void;
}

/**
 * The family-1「聯絡商家」confirm modal (`LBPAlertModal`). Renders a centered card
 * (title「聯繫商家」/ body「確定要開啟商城指定的客服連結嗎?」/ horizontal [取消][確定]
 * footer) over a black-0.55 scrim. `onConfirm` proceeds to the host-wired service-link exit;
 * `onCancel` (or a scrim tap) just closes the modal. Renders with the default no-op actions.
 */
export function ContactMerchantModal(props: ContactMerchantModalProps): ReactElement {
  const { theme, onConfirm, onCancel } = props;

  // Full-bleed ABSOLUTE-FILL dim scrim (so the container can overlay it on the shell). Tap =
  // dismiss; the centered card sits in a Pressable that ABSORBS taps so tapping inside the
  // card does NOT dismiss.
  return (
    <Pressable
      testID={LBTestIDs.contactScrim}
      onPress={() => onCancel?.()}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: SCRIM,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 320, alignItems: 'center' }}>
        {/* Centered alert card (LBPAlertModal — radius 18 over theme.background). */}
        <View
          testID={LBTestIDs.contactModal}
          style={{
            alignSelf: 'stretch',
            marginHorizontal: 36,
            paddingHorizontal: 22,
            paddingTop: 22,
            paddingBottom: 18,
            backgroundColor: theme.background,
            borderRadius: 18,
          }}
        >
          <Text
            style={{
              color: theme.text,
              fontSize: 17 * theme.fontScale,
              fontWeight: '700',
              textAlign: 'center',
            }}
          >
            {TITLE}
          </Text>
          <View style={{ height: 10 }} />
          <Text
            style={{
              color: TEXT_DIM,
              fontSize: 13 * theme.fontScale,
              lineHeight: 13 * theme.fontScale * 1.6,
              textAlign: 'center',
            }}
          >
            {BODY}
          </Text>
          <View style={{ height: 22 }} />
          <Footer theme={theme} onConfirm={onConfirm} onCancel={onCancel} />
        </View>
      </Pressable>
    </Pressable>
  );
}

// MARK: - Horizontal two-button footer (LBPAlertModal row: [plain 取消][primary 確定], gap 10)

function Footer(props: {
  theme: ReferenceUITheme;
  onConfirm?: () => void;
  onCancel?: () => void;
}): ReactElement {
  const { theme, onConfirm, onCancel } = props;
  return (
    <View style={{ flexDirection: 'row', alignSelf: 'stretch' }}>
      {/* Plain「取消」(LBPButton plain). */}
      <Pressable
        testID={LBTestIDs.contactCancel}
        onPress={() => onCancel?.()}
        style={{
          flex: 1,
          paddingVertical: 13,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: STROKE_STRONG,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: theme.text, fontSize: 15 * theme.fontScale, fontWeight: '700' }}>
          {CANCEL_LABEL}
        </Text>
      </Pressable>
      <View style={{ width: 10 }} />
      {/* Primary「確定」(LBPButton primary). */}
      <Pressable
        testID={LBTestIDs.contactConfirm}
        onPress={() => onConfirm?.()}
        style={{
          flex: 1,
          paddingVertical: 13,
          borderRadius: 12,
          backgroundColor: theme.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: ON_ACCENT_TEXT, fontSize: 15 * theme.fontScale, fontWeight: '700' }}>
          {CONFIRM_LABEL}
        </Text>
      </Pressable>
    </View>
  );
}
