// SelectVariantPromptModalView — family-3「請選規格」acknowledge modal (LBPAlertModal, RN).
//
// Spec: `reference-ui-rendering/spec.md` (family-3 product-sheets —「請選規格」prompt 由容器在
//        overlay root 呈現且可關閉).
// Design: `design/templates/minimal/sdk-components.jsx` `LBPAlertModal` / `LBPCenterPopup`
//          (centered card over a black-0.55 full-bleed scrim, 18pt corner card) — a player-root
//          overlay, NEVER nested inside `LBPBottomSheet`.
// Parity: iOS `SelectVariantPromptModalView.swift` + Android `SelectVariantPromptModalView.kt`
//          (ios/android-variant-prompt-overlay-fix). This is the RN four-platform parity.
//          Structural snapshot parity name: `select-variant-prompt-modal`.
//
// WHY HOISTED: the「請選規格」prompt used to be drawn INSIDE `ProductDetailSheetView` (the sheet
// element) as a `position:'absolute'` full-bleed scrim. Mounting it inside the sheet (slid in by
// the container's `BottomSheetPresenter`, height measured by `SheetScaffold`) broke the sheet
// layout (跑版); the old「我知道了」was a tapless `View` and the scrim covered the variant chips
// → 死鎖. Hoisting it to the container's player overlay root (mirroring the cart-needs-login gate
// `AuthGateModal`) fixes both — same LBPAlertModal shell, but「我知道了」/ scrim now dismiss it so
// the chips become reachable.
//
// SUB-VIEW INPUT PATTERN (family convention): `theme` first; then the dismiss callback (LAST,
// optional). No bound snapshot value — the copy is fixed. Renders correctly with `onDismiss`
// omitted (snapshot safe). Mirrors `playershell/ContactMerchantModalView.tsx` (same LBPAlertModal
// shell) but WITHOUT the lock badge and with a SINGLE full-width acknowledge button.
//
// RENDER DISCIPLINE (family lessons): plain `View` / `Text` / `Pressable` only — NO ScrollView /
// FlatList, NO network-uri `Image`, no animation / randomness. The root is an ABSOLUTE-FILL
// overlay so the container can compose it over the sheet stack.

import type { ReactElement } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '../TightText';

import type { ReferenceUITheme } from '../theme';
import { LBTestIDs } from '../testing/LBTestIDs';

/** Full-bleed dim scrim (`rgba(0,0,0,0.55)` — design `LBPAlertModal` backdrop). */
const SCRIM = 'rgba(0,0,0,0.55)';
/** `theme.surface.textDim` (body text). Matches `ContactMerchantModalView` / `AuthGateModalView`. */
const TEXT_DIM = '#6B6775';
/** On-accent text (white) — primary CTA. */
const ON_ACCENT_TEXT = '#FFFFFF';

const TITLE = '請選規格';
const BODY = '請先選擇商品規格,再加入購物車。';
const PRIMARY_LABEL = '我知道了';

/** Props for the {@link SelectVariantPromptModal} surface (SUB-VIEW INPUT PATTERN). */
export interface SelectVariantPromptModalProps {
  /** The resolved reference-ui theme (FIRST argument, always). */
  readonly theme: ReferenceUITheme;
  /**
   * 「我知道了」/ scrim tap → close the prompt (clears the container's local
   * `variantPromptPresented`, mirroring the cart-needs-login gate). The template's
   * `selectSpecRequired` is read-only — it is cleared by `selectVariant` once the user picks a
   * spec. Defaults to a no-op (demo / snapshot).
   */
  readonly onDismiss?: () => void;
}

/**
 * The family-3「請選規格」acknowledge modal (`LBPAlertModal`). Renders a centered card
 * (title「請選規格」/ body「請先選擇商品規格,再加入購物車。」/ single full-width primary
 * 「我知道了」) over a black-0.55 scrim. The「我知道了」CTA and a scrim tap both call `onDismiss`
 * so the variant chips become reachable. Renders with the default no-op action.
 */
export function SelectVariantPromptModal(props: SelectVariantPromptModalProps): ReactElement {
  const { theme, onDismiss } = props;

  // Full-bleed ABSOLUTE-FILL dim scrim (so the container can overlay it on the sheet stack). Tap =
  // dismiss; the centered card sits in a Pressable that ABSORBS taps so tapping inside the card
  // does NOT dismiss.
  return (
    <Pressable
      testID={LBTestIDs.variantPromptScrim}
      onPress={() => onDismiss?.()}
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
      <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 300, alignItems: 'center' }}>
        {/* Centered alert card (LBPAlertModal — radius 18 over theme.background). */}
        <View
          testID={LBTestIDs.variantPrompt}
          style={{
            alignSelf: 'stretch',
            marginHorizontal: 28,
            paddingHorizontal: 22,
            paddingVertical: 22,
            backgroundColor: theme.background,
            borderRadius: 18,
            alignItems: 'center',
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
              lineHeight: 19.5,
              textAlign: 'center',
            }}
          >
            {BODY}
          </Text>
          <View style={{ height: 22 }} />
          {/* Single full-width primary「我知道了」(acknowledge) — accent fill, #fff fg,
              theme.cornerRadius (rb-rn-button-corner-radius-unify). Tap = dismiss. */}
          <Pressable
            testID={LBTestIDs.variantPromptAck}
            onPress={() => onDismiss?.()}
            style={{
              alignSelf: 'stretch',
              borderRadius: theme.cornerRadius,
              paddingVertical: 12,
              backgroundColor: theme.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: ON_ACCENT_TEXT, fontSize: 15 * theme.fontScale, fontWeight: '700' }}>
              {PRIMARY_LABEL}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  );
}
