// GuestNameEditModalView — family-6 gap-surface 2 (guest nickname-edit modal, RN).
//
// Spec: `reference-ui-rendering/spec.md` (family-6 gap-surfaces — the LAST Phase-4 RN
//        family closing out the reconciled "gap" surfaces; PURELY ADDITIVE, 2 ADDED
//        modals).
// Design: `design/templates/minimal/live-chrome.jsx` `LiveNicknameModal`: a centered
//          card over a 0.55 scrim, with a logo 徽章 floating above the card's top edge
//          (negative top margin), the「設定暱稱」title +「請輸入直播留言的暱稱」subtitle,
//          a person-icon + max-10 input row, and a 送出 primary CTA enabled only while
//          the trimmed buffer is 1..10 chars.
// Parity: iOS `GapSurfaces/GuestNameEditModalView.swift` (rb-ios-gap-surfaces), Android
//          `gapsurfaces/GuestNameEditModalView.kt` (rb-android-gap-surfaces), and the
//          AUTHORITATIVE Flutter blueprint `gapsurfaces/guest_name_edit_modal.dart`
//          (rb-flutter-gap-surfaces), translated here 1:1. Structural snapshot parity
//          name: `guest-name-edit-modal`.
//
// The guest nickname-edit modal — the guest 態 rename affordance. It is the second of
// the two family-6 gap-surface modal sub-views composed by `GapSurfacesOverlayView`,
// and it implements the agreed SUB-VIEW INPUT PATTERN (shared with every family
// surface — see `GapSurfacesOverlayView.tsx`):
//
//   1. `theme` (ReferenceUITheme)  — FIRST, always.
//   2. bound SNAPSHOT VALUE        — `displayName: string`, passed BY VALUE from
//      `GapSurfacesModel.identity?.displayName` (never the model, never the template).
//      It is read-only PREFILL / context (a guest's `Guest_XXXX` default). `editable`
//      is the snapshot/runtime mode flag (see below).
//   3. action callbacks (LAST, each default no-op):
//      `onSubmit(name)` (送出 → host → `LivebuySDK.setUser`), `onDismiss` (取消 / scrim
//      tap / close → host clears the container's presentation state).
//
// One-way data flow: this surface reads ONLY its passed-in `displayName`; it never
// reaches back into `GapSurfacesModel` / `DefaultPlayerTemplate`. It renders correctly
// with all actions omitted (so demo / structural-snapshot tests construct it
// action-free). reference-ui NEVER calls core directly — the 送出 CTA funnels to
// `onSubmit`, which the container forwards to the host's `LivebuySDK.setUser`. This
// layer MUST NOT call any core rename API and MUST NOT add / mutate any view-model.
//
// THE RENAME ENTRY is NOT here: opening this modal is the container's lone CORE EXIT
// `GapSurfacesOverlayView` → `template.requestGuestNameEdit()` (emits
// `GUEST_NAME_EDIT_REQUEST`). This modal only renders the editor + forwards the typed
// name on 送出; it never fires the rename INTENT itself.
//
// PRESENTATION-ONLY INPUT BUFFER: the nickname buffer is a LOCAL `useState` (RN edit
// state — ALLOWED, NOT a second copy of view-model state; `displayName` stays the
// single source of truth, the new name flows to the host on 送出 and is written back to
// core, returning via the template `identityLabelState` notify). The buffer is SEEDED
// from `displayName`.
//
// RENDER DISCIPLINE (family-1..5 lessons): plain `View` / `Text` / `Pressable` /
// `TextInput` (runtime only) — NO ScrollView / FlatList / SectionList /
// VirtualizedList, NO network-uri `Image` (the logo 徽章 is a deterministic white
// circle + a self-drawn accent-colored vector person glyph, `GuestNamePersonGlyph` —
// rb-rn-icon-parity-guestname-person-glyph replaced the earlier bare emoji `👤`;
// rb-rn-icon-parity-guestname-badge-color-role-fix corrected the badge's color roles
// to match iOS/Android/Flutter, white circle + accent glyph, not the reverse). No
// animation / randomness
// so the structural
// baseline is byte-stable. CRITICAL golden lesson (iOS / Android / Flutter family-6): a
// LIVE `TextInput` renders as a yellow/red unsupported-control box under the structural
// renderer (and the in-package `react-native` mock provides no `TextInput`) — so when
// `editable === false` (demo / snapshot) the field is a STATIC placeholder `Text` (the
// seeded buffer, or the design's empty-field placeholder when blank); only when
// `editable === true` (host runtime) is it a real editable `TextInput`.

import { useState } from 'react';
import type { ReactElement } from 'react';
import { View, Pressable, TextInput } from 'react-native';
import { Text } from '../TightText';

import { LBTestIDs } from '../testing/LBTestIDs';
import type { ReferenceUITheme } from '../theme';
import type { NicknameSubmitFailureKind } from '../container/ChatComposerBar';
import { GuestNamePersonGlyph } from './GuestNamePersonGlyph';

// MARK: - Max nickname length (design `slice(0, 10)`).

export const MAX_NICKNAME_LENGTH = 10;

// MARK: - Fixed localized copy (static presentation strings, 繁中 — parity verbatim)

const TITLE = '設定暱稱';
const SUBTITLE = '請輸入直播留言的暱稱';
const INPUT_PLACEHOLDER = '暱稱字數上限 10 個字';
const SUBMIT_LABEL = '送出';
/** CTA label while a checkName-gated submit is in flight (rb-rn-nickname-taken-inline-error). */
const SUBMITTING_LABEL = '送出中…';
/** Inline error copy when checkName rejects the name (`error.code === 'guestNameTaken'`). */
const TAKEN_ERROR_MESSAGE = '此暱稱已被使用，請換一個';
/** Inline error copy for any other submit rejection (network / server — retryable). */
const GENERIC_ERROR_MESSAGE = '發生錯誤，請稍後再試';

// MARK: - Decorative design tokens (literal minimal hex — NOT theme-resolved)
//
// accent / text / background come from the resolved `ReferenceUITheme`. These are FIXED
// decorative colors lifted verbatim from the design `theme.surface.*` (light mode).
// They mirror the iOS / Android / Flutter `GuestNameEditModalView` static colors
// byte-for-byte (same `#6B6775` / `#B6B2BE` / `#ECEAF0` / `#D8D5DE` / `#F4F4F6` as
// `ProductDetailSheetView.tsx`), so the four platforms read as one family.

/** Full-bleed dim scrim (`rgba(0,0,0,0.55)` — design backdrop). */
const SCRIM = 'rgba(0,0,0,0.55)';
/** `theme.surface.textDim` (secondary / caption text + person glyph). */
const TEXT_DIM = '#6B6775';
/** `theme.surface.textFaint` (placeholder + disabled CTA label). */
const TEXT_FAINT = '#B6B2BE';
/** `theme.surface.stroke` (hairline — badge ring / input outline). */
const STROKE = '#ECEAF0';
/** `theme.surface.strokeStrong` (disabled CTA fill). */
const STROKE_STRONG = '#D8D5DE';
/** `theme.surface.bgSunken` (sunken input fill). */
const BG_SUNKEN = '#F4F4F6';
/** On-accent text (white) — enabled CTA + logo glyph. */
const ON_ACCENT_TEXT = '#FFFFFF';
/**
 * Danger / error text color (rb-rn-nickname-taken-inline-error) — the same literal hex already
 * used by the family-2 `WinClaimSheetView`'s danger token (`DANGER`), reused here verbatim so the
 * two family error surfaces read as one system.
 */
const DANGER = '#EB6E5F';

/** Floating logo 徽章 size (design `marginTop: -52` straddles half its height). */
const BADGE_SIZE = 44;

/** Props for the {@link GuestNameEditModal} surface (SUB-VIEW INPUT PATTERN). */
export interface GuestNameEditModalProps {
  /** The resolved reference-ui theme (FIRST argument, always). */
  readonly theme: ReferenceUITheme;
  /**
   * Current display name (`GapSurfacesModel.identity?.displayName`). Read-only — used
   * as the initial buffer + prefill context (a guest's `Guest_XXXX` default).
   */
  readonly displayName: string;
  /**
   * Whether the nickname field is a LIVE editable `TextInput` (runtime default `true`)
   * or a STATIC read-only placeholder display (`false`). The demo / snapshot seed
   * passes `false` because the structural renderer paints a live `TextInput` as a
   * yellow/red unsupported-control box (iOS / Android / Flutter family-6 lesson; the
   * in-package mock provides no `TextInput`). Hosts using the drop-in at runtime keep
   * the default `true`.
   */
  readonly editable?: boolean;
  /**
   * Whether a checkName-gated submit is currently in flight (rb-rn-nickname-taken-inline-error).
   * Default `false` (snapshot-neutral). Bound BY VALUE from the container's
   * `NicknamePromptController.submitting` — this component does NOT track its own submit state
   * (see `onSubmit`'s doc for why). Disables the 送出 CTA (even when `canSubmit` is true) and
   * switches its label to「送出中…」.
   */
  readonly submitting?: boolean;
  /**
   * The most recent checkName-gated submit failure, or `null` (no failure / cleared)
   * (rb-rn-nickname-taken-inline-error). Default `null` (snapshot-neutral). Bound BY VALUE from
   * the container's `NicknamePromptController.submitFailure`. `'taken'` → the name was rejected
   * by checkName (shows a specific「此暱稱已被使用」message); `'other'` → any other rejection
   * (shows a generic retry message). Drives an inline error `Text` below the input row; `null`
   * renders nothing extra.
   */
  readonly submitFailure?: NicknameSubmitFailureKind | null;
  /**
   * Host-wired 送出 → the container forwards the new name to the host's checkName-gated
   * `setGuestNicknameVerified` (turnkey) or a host override. reference-ui NEVER calls core
   * directly. Passes the trimmed nickname. Defaults to a no-op (demo / snapshot — inert CTA).
   *
   * **Signature stays `(name: string) => void`** (rb-rn-nickname-taken-inline-error) — this
   * component is a PUBLIC re-exported surface (also directly usable by a host bypassing the
   * turnkey `LivebuyPlayer` container), so a Promise-returning callback would be a breaking
   * signature change for any such direct caller. The three-state submit result (success / taken /
   * other error) is instead carried top-down by the {@link submitting} / {@link submitFailure}
   * bound props (container-held presentation state, the SAME shape as `displayName`), not by
   * `onSubmit`'s return value — this component never awaits or inspects what `onSubmit` returns.
   */
  readonly onSubmit?: (name: string) => void;
  /**
   * Host-wired 取消 / scrim tap / close → the container clears its presentation state.
   * Defaults to a no-op (demo / snapshot).
   */
  readonly onDismiss?: () => void;
}

/**
 * The family-6 guest nickname-edit modal. Renders a full-bleed dim scrim, a centered
 * card with a floating logo 徽章, the「設定暱稱」title + subtitle, a nickname input row
 * (a live `TextInput` seeded from {@link GuestNameEditModalProps.displayName} at
 * runtime, or a static placeholder `Text` on the demo / snapshot path), an optional
 * inline error line (rb-rn-nickname-taken-inline-error, driven by {@link
 * GuestNameEditModalProps.submitFailure}), and a 送出 CTA enabled only while the trimmed
 * buffer is 1..10 AND no submit is in flight ({@link GuestNameEditModalProps.submitting}
 * disables it and swaps its label to「送出中…」). The `displayName` bind is the prefill
 * / context (a guest's `Guest_XXXX` default); the actual rename is host-fulfilled via
 * `onSubmit` (still fire-and-forget — the submit RESULT is reflected back via `submitting`
 * / `submitFailure`, not via anything `onSubmit` returns). reference-ui NEVER renames
 * itself.
 *
 * Renders correctly with `onSubmit` / `onDismiss` omitted (snapshot / preview safe); the
 * additive `submitting` / `submitFailure` props default to `false` / `null` so every
 * existing call site is unaffected.
 */
export function GuestNameEditModal(props: GuestNameEditModalProps): ReactElement {
  const {
    theme,
    displayName,
    editable = true,
    submitting = false,
    submitFailure = null,
    onSubmit,
    onDismiss,
  } = props;

  // Presentation-only input buffer (RN edit state — NOT a second copy of view-model
  // state). SEEDED from the bound `displayName`; the trimmed buffer drives the 送出
  // enabled gate, and on 送出 it is handed to the host. `displayName` stays the single
  // source of truth.
  const [text, setText] = useState(displayName);
  const trimmed = text.trim();
  const canSubmit = trimmed.length >= 1 && trimmed.length <= MAX_NICKNAME_LENGTH;
  // TWO SEPARATE AXES (rb-rn-nickname-taken-inline-error) — see `SubmitButton`'s header for the
  // design-source contract that forbids collapsing them. `canSubmit` itself (the trim-length gate)
  // is UNCHANGED.
  //   • pressability: locked by the length gate OR an in-flight submit (no double-submit).
  //   • brand fill:   an in-flight CTA KEEPS the accent fill — `submitting` OVERRIDES the length
  //     gate here rather than being excluded from it. The design source computes
  //     `background: loading && filled ? accent : s.bg`, where a primary's
  //     `s.bg = disabled ? strokeStrong : accent` — so `loading` wins over `disabled`, and the
  //     fill stays accent even when the length gate is failing. That matters because the field
  //     is NOT locked while submitting: clearing it mid-flight flips `canSubmit` to false, and
  //     keying the fill off `canSubmit` alone would flash the grey disabled surface
  //     (rb-rn-nickname-cta-brand-fill-in-flight; parity iOS `isSubmitting || canSubmit`,
  //     Flutter `_isSubmitting || _canSubmit`).
  const ctaInteractive = canSubmit && !submitting;
  const ctaBrandFilled = submitting || canSubmit;
  // Inline error copy derived from the bound `submitFailure` (rb-rn-nickname-taken-inline-error):
  // `'taken'` → the specific「已被使用」message; `'other'` → a generic retry message; `null` → none.
  // This component does NOT clear it on keystroke (a deliberate simplification — see design.md);
  // it clears the moment the container's `beginSubmit()` runs (the next 送出 tap).
  const errorMessage: string | null =
    submitFailure === 'taken'
      ? TAKEN_ERROR_MESSAGE
      : submitFailure === 'other'
        ? GENERIC_ERROR_MESSAGE
        : null;

  // Forward the trimmed name on 送出 (guarded by canSubmit AND submitting — no double-fire while
  // a previous attempt is still in flight). reference-ui never renames itself; the three-state
  // submit RESULT (success / taken / other error) is reflected back via the bound `submitting` /
  // `submitFailure` props (driven by the container), NOT by anything `onSubmit` returns — this
  // component never awaits or inspects `onSubmit`'s return value.
  const submit = (): void => {
    if (!canSubmit || submitting) return;
    onSubmit?.(trimmed);
  };

  // Full-bleed dim scrim (tap → dismiss). The centered card sits in a Pressable that
  // ABSORBS taps so tapping inside the card does NOT dismiss; the logo 徽章 floats above
  // the card's top edge.
  return (
    <Pressable
      onPress={() => onDismiss?.()}
      testID={LBTestIDs.guestNameScrim}
      style={{
        flex: 1,
        backgroundColor: SCRIM,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Pressable
        onPress={() => {}}
        style={{
          width: '100%',
          // 320 matches the design's LiveNicknameModal maxWidth + iOS card + sibling AuthGate.
          maxWidth: 320,
          marginHorizontal: 28,
          // Reserve room above the card for the 徽章's upper half so it is not clipped.
          paddingTop: BADGE_SIZE / 2,
          alignItems: 'center',
        }}
      >
        {/* Card body (rounded, hairline ring). Top inset is tall enough to clear the
            徽章 that half-overlaps the top edge. */}
        <View
          testID={LBTestIDs.guestNameModal}
          style={{
            alignSelf: 'stretch',
            backgroundColor: theme.background,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: STROKE,
            paddingHorizontal: 22,
            paddingTop: 48,
            paddingBottom: 20,
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
          <View style={{ height: 16 }} />
          <Text
            style={{
              color: TEXT_DIM,
              fontSize: 13 * theme.fontScale,
              textAlign: 'center',
            }}
          >
            {SUBTITLE}
          </Text>
          <View style={{ height: 16 }} />
          <InputRow
            theme={theme}
            editable={editable}
            text={text}
            onChangeText={setText}
          />
          {errorMessage != null ? (
            <>
              <View style={{ height: 8 }} />
              <Text
                testID={LBTestIDs.guestNameError}
                style={{
                  color: DANGER,
                  fontSize: 12 * theme.fontScale,
                  fontWeight: '600',
                  textAlign: 'center',
                }}
              >
                {errorMessage}
              </Text>
            </>
          ) : null}
          <View style={{ height: 16 }} />
          <SubmitButton
            theme={theme}
            interactive={ctaInteractive}
            brandFilled={ctaBrandFilled}
            submitting={submitting}
            onTap={submit}
          />
        </View>

        {/* Floating logo 徽章 — straddles the card top edge (design `marginTop: -52`).
            Absolutely positioned at the reserved overhang + horizontally centered. */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            alignItems: 'center',
          }}
        >
          <LogoBadge theme={theme} />
        </View>
      </Pressable>
    </Pressable>
  );
}

// MARK: - Floating logo 徽章 (44×44 white circle, accent person glyph)
//
// A 44×44 white circle (`theme.background`) with a hairline ring, holding a self-drawn
// vector person glyph (`GuestNamePersonGlyph`, react-native-svg) in the theme accent
// color. Mirrors the design's floating brand-mark badge (the design uses the LB logo
// image and a `#fff` badge background; reference-ui keeps the structural baseline
// deterministic with a white circle + accent-colored person glyph instead of a network
// image) and iOS / Android / Flutter's white-circle-plus-accent-glyph color roles
// (rb-rn-icon-parity-guestname-badge-color-role-fix corrected an earlier reversed
// color-role bug — accent circle + fixed white glyph).

function LogoBadge(props: { theme: ReferenceUITheme }): ReactElement {
  const { theme } = props;
  return (
    <View
      style={{
        width: BADGE_SIZE,
        height: BADGE_SIZE,
        borderRadius: BADGE_SIZE / 2,
        backgroundColor: theme.background,
        borderWidth: 1,
        borderColor: STROKE,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <GuestNamePersonGlyph size={26 * theme.fontScale} color={theme.accent} />
    </View>
  );
}

// MARK: - Input row (person icon + field, sunken pill with hairline stroke)
//
// Runtime (`editable === true`): a live `TextInput` seeded from `displayName`, clamped
// to 10 chars, with the「暱稱字數上限 10 個字」hint. Demo / snapshot (`editable ===
// false`): a STATIC placeholder `Text` of the current buffer (else the hint in
// textFaint) — the structural renderer paints a live `TextInput` as a yellow/red
// unsupported-control box (iOS / Android / Flutter family-6 lesson), so the read-only
// rendering reproduces the design's empty-field placeholder state.

function InputRow(props: {
  theme: ReferenceUITheme;
  editable: boolean;
  text: string;
  onChangeText: (value: string) => void;
}): ReactElement {
  const { theme, editable, text, onChangeText } = props;
  return (
    <View
      style={{
        backgroundColor: BG_SUNKEN,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: STROKE,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <GuestNamePersonGlyph size={16 * theme.fontScale} color={TEXT_DIM} />
      <View style={{ width: 10 }} />
      <View style={{ flex: 1 }}>
        {editable ? (
          <LiveField theme={theme} text={text} onChangeText={onChangeText} />
        ) : (
          <StaticField theme={theme} text={text} />
        )}
      </View>
    </View>
  );
}

/**
 * Live nickname `TextInput` (runtime path). Seeded from `displayName`, clamped to
 * {@link MAX_NICKNAME_LENGTH}, with the placeholder hint. Re-reads the canSubmit gate
 * on every change (the parent owns the buffer state).
 */
function LiveField(props: {
  theme: ReferenceUITheme;
  text: string;
  onChangeText: (value: string) => void;
}): ReactElement {
  const { theme, text, onChangeText } = props;
  return (
    <TextInput
      value={text}
      onChangeText={onChangeText}
      testID={LBTestIDs.guestNameField}
      maxLength={MAX_NICKNAME_LENGTH}
      placeholder={INPUT_PLACEHOLDER}
      placeholderTextColor={TEXT_FAINT}
      style={{
        padding: 0,
        color: theme.text,
        fontSize: 13 * theme.fontScale,
      }}
    />
  );
}

/**
 * Static read-only field rendering (demo / snapshot path). Shows the buffer text if
 * any, else the placeholder hint in textFaint — matching the design's empty-field
 * state. Snapshot-safe (plain `Text`, no live control).
 */
function StaticField(props: { theme: ReferenceUITheme; text: string }): ReactElement {
  const { theme, text } = props;
  const isEmpty = text.length === 0;
  return (
    <Text
      numberOfLines={1}
      style={{
        color: isEmpty ? TEXT_FAINT : theme.text,
        fontSize: 13 * theme.fontScale,
      }}
    >
      {isEmpty ? INPUT_PLACEHOLDER : text}
    </Text>
  );
}

// MARK: - 送出 CTA (LBPButton primary — locked while disabled OR submitting)
//
// 🔴 TWO INDEPENDENT AXES — do NOT collapse them back into one boolean.
//
// The design source `design/templates/minimal/sdk-components.jsx:1080-1111` (`LBPButton`) is
// explicit that `loading` is NOT `disabled`:
//
//     // `loading` puts the button into an in-flight state: it locks (no clicks) but
//     // — unlike `disabled` — KEEPS its brand fill so the action still reads as
//     // active/committed, swapping the leading icon for a matching spinner and
//     // (optionally) the label.
//     const locked = disabled || loading;
//     background: loading && filled ? accent : s.bg,   // "Loading keeps the brand fill
//                                                      //  (does NOT fall back to the grey
//                                                      //  disabled surface)"
//     opacity: loading ? 0.96 : 1,
//
// So the two axes are:
//   • `interactive` (= `canSubmit && !submitting`) — may it be pressed. Locked by EITHER a
//     failed length gate OR an in-flight submit.
//   • `brandFilled` (= `submitting || canSubmit`) — does it keep the accent fill. `submitting`
//     OVERRIDES the length gate here: `loading && filled ? accent : s.bg` picks `accent` before
//     `s.bg` (= `disabled ? strokeStrong : accent`) is ever consulted, so an in-flight CTA reads
//     as committed even while the gate is failing. Writing this as `canSubmit` alone is a real
//     regression, not a style nit — the field is NOT locked while submitting, so clearing it
//     mid-flight flips the gate and flashes the grey disabled surface
//     (rb-rn-nickname-cta-brand-fill-in-flight fixed exactly that).
//
// Driving the FILL off the pressability boolean is the exact regression this comment exists to
// prevent (it makes 送出中 render as the grey `strokeStrong` disabled surface, which the design
// source bans in so many words). `check-design-contract` does NOT cover this — do not rely on it.
//
// Enabled (1..10 trimmed) → accent fill / white fg. Disabled (length gate) → strokeStrong fill /
// textFaint fg. Submitting → accent fill / white fg + `opacity 0.96`, locked, label「送出中…」.
// Tap guards `interactive`, then forwards the trimmed name to onSubmit (host fulfils via the
// checkName-gated `setGuestNicknameVerified` turnkey, or a host override).
//
// The design's 4th loading affordance — a spinner replacing the leading icon — is deliberately
// NOT reproduced here; the label swap carries the in-flight signal instead (the design source
// itself makes the label swap part of the contract: "(optionally) the label"). Rationale in this
// change's design.md: this CTA has no leading icon to swap, the in-package `react-native` mock
// ships no `ActivityIndicator`, and this file's render discipline bans animation outright so the
// structural baseline stays byte-stable.

function SubmitButton(props: {
  theme: ReferenceUITheme;
  interactive: boolean;
  brandFilled: boolean;
  submitting: boolean;
  onTap: () => void;
}): ReactElement {
  const { theme, interactive, brandFilled, submitting, onTap } = props;
  return (
    <Pressable
      onPress={interactive ? () => onTap() : undefined}
      disabled={!interactive}
      testID={LBTestIDs.guestNameSubmit}
      style={{
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: brandFilled ? theme.accent : STROKE_STRONG,
        alignItems: 'center',
        justifyContent: 'center',
        // `opacity` is applied ONLY while submitting (design `opacity: loading ? 0.96 : 1`).
        // Spread conditionally rather than always emitting `opacity: 1`, so the resting style
        // object — and therefore every pre-existing structural snapshot — stays byte-identical.
        ...(submitting ? { opacity: 0.96 } : null),
      }}
    >
      <Text
        style={{
          color: brandFilled ? ON_ACCENT_TEXT : TEXT_FAINT,
          fontSize: 15 * theme.fontScale,
          fontWeight: '700',
        }}
      >
        {submitting ? SUBMITTING_LABEL : SUBMIT_LABEL}
      </Text>
    </Pressable>
  );
}
