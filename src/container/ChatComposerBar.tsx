// ChatComposerBar + useChatComposer — the on-demand LIVE「留言...」chat composer
// (introduce-dropin-player-container-rn, D-6 / R5; new pixel surface).
//
// Parity source: iOS `ChatComposerBar.swift` + `ChatComposerController`.
//
// The reference-ui `LiveBottomBarView` only has the「留言...」TAP-PILL (it raises
// `onComment`; its comment explicitly says "the real composer is the host's").
// The composer the pill is meant to OPEN is a PIXEL surface and therefore belongs
// in the reference-ui layer — it lived nowhere on RN (it never existed, unlike
// iOS where it lived in the Example). This is its first home: hidden until the
// pill opens it, it forwards a sent message to `onSend` (the container wires this
// to `playerRef.sendChat(text)` → core `sendChat`). A guest send that needs login
// surfaces `AUTH_REQUIRED`, handled by the host listener (existing behaviour,
// unchanged); this layer never calls core / login itself.
//
// `editable` flag (the family-6 lesson): a LIVE `TextInput` paints as a yellow/red
// unsupported-control box under the structural renderer (and the in-package
// `react-native` mock provides no `TextInput`). So the field is a STATIC
// placeholder `Text` when `editable === false` (demo / structural snapshot) and a
// real `TextInput` only when `editable === true` (host runtime, the default).
//
// Plain `View` / `Text` / `Pressable` / `TextInput` only — NO ScrollView /
// FlatList / Animated (structural determinism). VOD has no「留言...」pill (side
// rail), so the composer never opens there.

import { useCallback, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { View, Pressable, TextInput, Keyboard } from 'react-native';
import { Text } from '../TightText';

import { LBTestIDs } from '../testing/LBTestIDs';
import type { ReferenceUITheme } from '../theme';
import { LBAuthTriggerAction } from 'livebuy-react-native-ui';

/**
 * Presentation + focus state for the on-demand chat composer. `open()` shows the
 * bar and bumps `focusToken` (so a host field can request first-responder focus);
 * `close()` hides it. The container's default `onComment` calls `open()`.
 *
 * Returned by {@link useChatComposer}. The shape mirrors the iOS
 * `ChatComposerController` (`isPresented` / `focusToken` / `open` / `close`).
 */
export interface ChatComposerController {
  /** Whether the composer bar is currently shown. */
  readonly isOpen: boolean;
  /** Monotonic focus-request counter — a host field focuses when it changes. */
  readonly focusToken: number;
  /** Show the composer and request focus (the LIVE「留言...」pill's default action). */
  open(): void;
  /** Hide the composer (e.g. after a send / when the field ends editing). */
  close(): void;
}

/**
 * Hook owning the on-demand composer's presentation + focus state machine
 * (D-6 / R5). The container holds ONE controller and passes it to both the
 * default `onComment` (which calls `open()`) and the {@link ChatComposerBar}.
 *
 * State machine: `open()` → `isOpen = true` + `focusToken += 1`; `close()` →
 * `isOpen = false` (focusToken unchanged). Pure React state — no side effects.
 */
export function useChatComposer(): ChatComposerController {
  const [isOpen, setIsOpen] = useState(false);
  const [focusToken, setFocusToken] = useState(0);

  const open = useCallback((): void => {
    setIsOpen(true);
    setFocusToken((t) => t + 1);
  }, []);

  const close = useCallback((): void => {
    setIsOpen(false);
  }, []);

  return { isOpen, focusToken, open, close };
}

/**
 * The outcome kind of a rejected checkName-gated nickname submit
 * (rb-rn-nickname-taken-inline-error, parity Android `NicknameSubmitFailureKind`):
 * `'taken'` — checkName rejected the name (`error.code === 'guestNameTaken'`); `'other'` —
 * any other rejection (network / server / anything non-403). Drives
 * {@link NicknamePromptController.submitFailure} → `GuestNameEditModal`'s inline error text.
 */
export type NicknameSubmitFailureKind = 'taken' | 'other';

/**
 * Presentation state for the on-demand 設定暱稱 modal (`GuestNameEditModal`) — the
 * nickname-modal analogue of {@link ChatComposerController} (parity with iOS
 * `NicknamePromptController` / Android `NicknamePromptController`).
 *
 * The container composes the modal gated on `isOpen` (default `false` → snapshot-neutral);
 * the LIVE bottom-bar 暱稱 button and the 留言 pill's 未設定-暱稱 branch call `present`; a
 * scrim tap / submit calls `dismiss`. `composeAfter` carries the ENTRY intent: when opened
 * FROM the 留言 pill the guest must set a nickname before commenting, so a successful submit
 * hands off to the chat composer; when opened from the 暱稱 button directly it just dismisses.
 *
 * `submitting` / `submitFailure` (rb-rn-nickname-taken-inline-error) carry the checkName-gated
 * `setGuestNicknameVerified` submit's in-flight / rejected呈現 state. They live HERE (container-
 * held presentation state, the same shape as `composeAfter` / `pendingJoin`) rather than as local
 * `GuestNameEditModal` state, because the code that WRITES them (`container/seams.ts`'s
 * `onSubmitName` turnkey default) already lives in the container, and `GuestNameEditModal.onSubmit`
 * stays a plain `(name: string) => void` — it is a **public** re-exported component (also usable
 * directly by a host bypassing the turnkey `LivebuyPlayer` container), so changing its callback
 * type to a Promise would be a breaking signature change for any such direct caller (see
 * `rb-rn-nickname-taken-inline-error`'s design.md Decision 1).
 */
export interface NicknamePromptController {
  /** Whether the 設定暱稱 modal is currently shown. Default `false` (snapshot-neutral). */
  readonly isOpen: boolean;
  /** Whether a successful submit should hand off to the chat composer (留言 pill entry). */
  readonly composeAfter: boolean;
  /**
   * A pending「加入活動」(event-join) intent the NICKNAME gate deferred (rb-rn-event-join-gate, parity
   * iOS / Android `pendingJoinEvent`): when a 未設名訪客 taps 加入活動, the container records the join's
   * `(eid, keyword)` HERE and presents this modal; a successful submit then completes that ONE join
   * (bypassing the gate). `null` when the modal was NOT opened for a pending join (直接暱稱編輯 / 留言
   * pill). Cleared by `dismiss` (取消 / 關閉 → 不 join) and by `present` (mutually-exclusive entry). No
   * pixel reads this → render-neutral.
   */
  readonly pendingJoin: { eid: number; keyword: string } | null;
  /**
   * Whether a checkName-gated `setGuestNicknameVerified` submit is currently in flight
   * (rb-rn-nickname-taken-inline-error). Default `false` (snapshot-neutral). Drives
   * `GuestNameEditModal`'s CTA disabled state +「送出中…」label. Set by `beginSubmit()`; cleared by
   * `submitFailed(...)` or by a successful submit's `dismiss()`.
   */
  readonly submitting: boolean;
  /**
   * The most recent submit failure kind, or `null` (no failure yet / cleared)
   * (rb-rn-nickname-taken-inline-error). `'taken'` → checkName rejected the name; `'other'` → any
   * other rejection. Drives `GuestNameEditModal`'s inline error text. Cleared by `present` /
   * `presentPendingJoin` / `dismiss` / the next `beginSubmit()` (a retry clears the stale message
   * the moment the user taps 送出 again) — editing the input buffer alone does NOT clear it (a
   * deliberate simplification, see design.md Risk).
   */
  readonly submitFailure: NicknameSubmitFailureKind | null;
  /** Show the 設定暱稱 modal. `composeAfter === true` → after submit the container opens the composer. */
  present(composeAfter: boolean): void;
  /**
   * Show the 設定暱稱 modal to satisfy a PENDING「加入活動」join gate (rb-rn-event-join-gate, parity iOS
   * `present(pendingJoin:)` / Android `presentPendingJoin`): records the join's `(eid, keyword)` so a
   * successful submit completes that ONE join; sets `composeAfter = false` (this entry does NOT hand
   * off to the composer).
   */
  presentPendingJoin(eid: number, keyword: string): void;
  /** Hide the 設定暱稱 modal (scrim tap / close / after submit). */
  dismiss(): void;
  /**
   * Mark a checkName-gated `setGuestNicknameVerified` submit as in flight
   * (rb-rn-nickname-taken-inline-error): sets `submitting = true`, clears any stale `submitFailure`
   * left over from a previous attempt, and returns this attempt's **submission token**. Called by
   * the turnkey `onSubmitName` seam BEFORE calling `setGuestNicknameVerified`.
   *
   * 🔴 The returned token MUST be handed back to {@link isCurrentSubmission} at the TOP of BOTH
   * async continuations — see that method for the failure modes it exists to prevent.
   */
  beginSubmit(): number;
  /**
   * Whether `token` (from a previous {@link beginSubmit}) still identifies the CURRENT submission
   * intent (rb-rn-nickname-taken-inline-error). Returns `false` once the user has moved on —
   * `present` / `presentPendingJoin` / `dismiss` (cancel / re-open / a different entry point) and a
   * newer `beginSubmit` all invalidate the previous token.
   *
   * 🔴 WHY THIS EXISTS (do not remove — the guarded sequences are reachable with any network
   * latency, and the modal's scrim has NO in-flight guard, so cancelling mid-request is a normal
   * user action). Before this change the whole submit path was SYNCHRONOUS, so nothing could run
   * after `dismiss()`; introducing the awaited `setGuestNicknameVerified` opened a window between
   * "user submitted" and "result arrived" in which the user can cancel or re-present the modal. Two
   * DIFFERENT staleness bugs live in that window and BOTH must be handled:
   *
   *   1. **The closure snapshot goes stale.** `useNicknamePrompt` returns a NEW object literal each
   *      render and `buildGapHandlers(deps)` is rebuilt each render, so a continuation closure holds
   *      the controller from the render that STARTED the submit — its `composeAfter` / `pendingJoin`
   *      are frozen at that instant.
   *   2. **The setters hit the LATEST state.** `dismiss` / `submitFailed` are `useCallback`-stable
   *      and act on whatever state is current when the late result lands — NOT on the presentation
   *      that started the submit.
   *
   * Concretely, without this guard: submit a pending-join nickname → cancel via scrim (which clears
   * `pendingJoin`, per that method's own「never join after the fact」contract) → the late resolve
   * still completes the join the user CANCELLED and notifies the host; or, after cancel + re-open,
   * a late resolve closes the modal the user is currently typing in / a late reject paints the
   * previous attempt's error onto a presentation that has not submitted anything yet.
   *
   * Backed by `isCurrentSubmission` being read through a `useRef` (NOT React state), so a STALE
   * controller snapshot still observes the CURRENT generation — a state-derived field could not,
   * since the stale object would carry the stale value (which is failure mode 1 all over again).
   */
  isCurrentSubmission(token: number): boolean;
  /**
   * Record a checkName-gated submit failure (rb-rn-nickname-taken-inline-error): sets
   * `submitting = false` and `submitFailure = kind`. Called by the turnkey `onSubmitName` seam's
   * rejection handler. MUST NOT be called on success — the success path calls `dismiss()` instead
   * (which also clears `submitFailure`).
   *
   * Deliberately does NOT invalidate the submission token: a failure leaves the user IN the modal
   * to retry, and the retry's own `beginSubmit()` issues the next token.
   */
  submitFailed(kind: NicknameSubmitFailureKind): void;
}

/**
 * Hook owning the on-demand 設定暱稱 modal's presentation state (parity with
 * {@link useChatComposer}). The container holds ONE controller and passes it to the
 * default `onComment` gating, the LIVE bottom-bar 暱稱 button (`onNickname`), and the
 * {@link GapSurfacesOverlayView}.
 *
 * State machine: `present(c)` → `isOpen = true` + `composeAfter = c`; `dismiss()` →
 * `isOpen = false` (composeAfter unchanged). Pure React state — no side effects.
 *
 * `submitting` / `submitFailure` (rb-rn-nickname-taken-inline-error): `present` /
 * `presentPendingJoin` / `dismiss` ALL clear both to their defaults (`false` / `null`) — a fresh
 * presentation (or a closed one) MUST NOT carry a stale in-flight / failure state from a previous
 * attempt. `beginSubmit()` sets `submitting = true` and clears `submitFailure`; `submitFailed(kind)`
 * sets `submitting = false` and `submitFailure = kind`.
 *
 * SUBMISSION GENERATION (rb-rn-nickname-taken-inline-error): a `useRef` counter — deliberately NOT
 * React state — bumped by `beginSubmit` (issuing that attempt's token) and by every intent-ending
 * transition (`present` / `presentPendingJoin` / `dismiss`). `isCurrentSubmission(token)` reads the
 * ref, so a continuation closure holding a STALE controller snapshot still observes the CURRENT
 * generation and can bail out. See {@link NicknamePromptController.isCurrentSubmission} for the
 * full rationale and the sequences it prevents.
 */
export function useNicknamePrompt(): NicknamePromptController {
  const [isOpen, setIsOpen] = useState(false);
  const [composeAfter, setComposeAfter] = useState(false);
  // rb-rn-event-join-gate: the pending「加入活動」intent the NICKNAME gate deferred. `useState` (mirrors
  // `composeAfter`): its change always coincides with the necessary `isOpen` re-render (present /
  // presentPendingJoin / dismiss all flip isOpen), so it adds NO extra render; no pixel reads it →
  // render-neutral. The `onSubmitName` continuation reads it BEFORE `dismiss`, so the re-render has
  // already threaded the latest value into the current render's controller (same proven flow as
  // `composeAfter`).
  const [pendingJoin, setPendingJoin] = useState<{ eid: number; keyword: string } | null>(null);
  // rb-rn-nickname-taken-inline-error: checkName-gated submit in-flight / rejected呈現 state.
  const [submitting, setSubmitting] = useState(false);
  const [submitFailure, setSubmitFailure] = useState<NicknameSubmitFailureKind | null>(null);
  // rb-rn-nickname-taken-inline-error: the submission GENERATION. A `useRef` (NOT state) on purpose —
  // `isCurrentSubmission` closes over it, so a continuation holding a stale controller snapshot still
  // reads the CURRENT generation. Bumped by `beginSubmit` (new attempt) and by every intent-ending
  // transition below (`present` / `presentPendingJoin` / `dismiss`), never by `submitFailed` (a
  // failure keeps the user in the modal to retry). Never rendered → no re-render needed.
  const submissionRef = useRef(0);

  const present = useCallback((compose: boolean): void => {
    // Any in-flight submission belongs to a superseded intent — invalidate its token.
    submissionRef.current += 1;
    setComposeAfter(compose);
    // 留言 pill / 暱稱鈕 entry is mutually exclusive with the 加入活動 entry — clear any pending join.
    setPendingJoin(null);
    setSubmitting(false);
    setSubmitFailure(null);
    setIsOpen(true);
  }, []);

  const presentPendingJoin = useCallback((eid: number, keyword: string): void => {
    submissionRef.current += 1;
    // The pending-join entry never hands off to the composer.
    setComposeAfter(false);
    setPendingJoin({ eid, keyword });
    setSubmitting(false);
    setSubmitFailure(null);
    setIsOpen(true);
  }, []);

  const dismiss = useCallback((): void => {
    // 🔴 Invalidating here is what makes the「never join after the fact」contract below actually hold
    // once the submit path became async: a request still in flight when the user cancels MUST NOT be
    // allowed to complete the cancelled join when it lands.
    submissionRef.current += 1;
    setIsOpen(false);
    // Cancelled / closed / post-submit → never join after the fact (the submit continuation captures
    // `pendingJoin` at SUBMIT TIME and re-checks its token before using it).
    setPendingJoin(null);
    setSubmitting(false);
    setSubmitFailure(null);
  }, []);

  const beginSubmit = useCallback((): number => {
    submissionRef.current += 1;
    setSubmitting(true);
    setSubmitFailure(null);
    return submissionRef.current;
  }, []);

  const isCurrentSubmission = useCallback(
    (token: number): boolean => submissionRef.current === token,
    [],
  );

  const submitFailed = useCallback((kind: NicknameSubmitFailureKind): void => {
    // No generation bump: the user stays in this presentation and may retry; the retry's own
    // `beginSubmit()` issues the next token.
    setSubmitting(false);
    setSubmitFailure(kind);
  }, []);

  return {
    isOpen,
    composeAfter,
    pendingJoin,
    submitting,
    submitFailure,
    present,
    presentPendingJoin,
    dismiss,
    beginSubmit,
    isCurrentSubmission,
    submitFailed,
  };
}

/**
 * Presentation state for the on-demand「請先登入」(commentSend) modal raised by the LIVE 留言 login
 * gate — the login-modal analogue of {@link NicknamePromptController} (parity with iOS / Android
 * `LoginPromptController`; rb-rn-live-comment-login-gate, 方案 A).
 *
 * The container composes the modal gated on `isOpen` (default `false` → snapshot-neutral). When a
 * guest taps the LIVE 留言 pill on a `chatEnabled === false` live (`guest_comment == 0`) the default
 * `onComment` calls `present`; 前往登入 routes to the host's `config.onLogin` (reference-ui NEVER logs
 * in itself); 稍後再說 / scrim / a successful login calls `dismiss`.
 */
export interface LoginPromptController {
  /** Whether the「請先登入」modal is currently shown. Default `false` (snapshot-neutral). */
  readonly isOpen: boolean;
  /**
   * Which interaction raised the modal — drives `AuthGateModal`'s body copy per kind (via
   * `GapSurfacesOverlayView`'s login-gate branch `LBAuthGateState(triggerAction, …)`). The
   * container sets it via `present(triggerAction)`; the composed modal reads it dynamically so
   * ONE controller serves every gate (留言 → `CommentSend`, 訂閱 → `Subscribe`, …). Default
   * `CommentSend` (the original gate) keeps the existing 留言 / 暱稱 gate behaviour unchanged
   * (rb-rn-subscribe-login-gate, parity iOS / Android `LoginPromptController.triggerAction`).
   */
  readonly triggerAction: LBAuthTriggerAction;
  /**
   * Show the「請先登入」modal for the given trigger. Default `CommentSend` (the 留言 pill's guest +
   * `guest_comment == 0` branch) so existing no-arg call sites (`onComment` / `onNickname`) need no
   * change; 訂閱 gate passes `Subscribe`.
   */
  present(triggerAction?: LBAuthTriggerAction): void;
  /** Hide the「請先登入」modal (前往登入 hand-off / 稍後再說 / scrim). */
  dismiss(): void;
}

/**
 * Hook owning the on-demand「請先登入」modal's presentation state (parity with
 * {@link useNicknamePrompt}). The container holds ONE controller and passes it to the default
 * `onComment` gating and the {@link GapSurfacesOverlayView}.
 *
 * State machine: `present()` → `isOpen = true`; `dismiss()` → `isOpen = false`. Pure React state.
 */
export function useLoginPrompt(): LoginPromptController {
  const [isOpen, setIsOpen] = useState(false);
  // Which interaction raised the modal (留言 / 暱稱 → CommentSend, 訂閱 → Subscribe). Default
  // CommentSend keeps the existing gate copy / behaviour unchanged (rb-rn-subscribe-login-gate).
  const [triggerAction, setTriggerAction] = useState<LBAuthTriggerAction>(
    LBAuthTriggerAction.CommentSend,
  );

  const present = useCallback(
    (action: LBAuthTriggerAction = LBAuthTriggerAction.CommentSend): void => {
      setTriggerAction(action);
      setIsOpen(true);
    },
    [],
  );

  const dismiss = useCallback((): void => {
    setIsOpen(false);
  }, []);

  return { isOpen, triggerAction, present, dismiss };
}

/** Props for the on-demand chat composer bar. */
export interface ChatComposerBarProps {
  /** The resolved reference-ui theme (accent for the send glyph). */
  readonly theme: ReferenceUITheme;
  /** Presentation / focus state — driven by the LIVE「留言...」pill's `onComment`. */
  readonly controller: ChatComposerController;
  /**
   * Forward the trimmed comment to the host (the container wires this to
   * `playerRef.sendChat(text)` → core `sendChat`). The field is cleared and the
   * bar hidden after a send.
   */
  readonly onSend?: (text: string) => void;
  /**
   * Whether the input is a LIVE editable `TextInput` (runtime default `true`).
   * Demo / structural-snapshot callers pass `false` so the field renders as a
   * static placeholder `Text` (a live `TextInput` paints as an unsupported-control
   * box under the structural renderer, and the in-package `react-native` mock
   * provides no `TextInput`). Hosts using the drop-in at runtime keep the default.
   */
  readonly editable?: boolean;
}

/**
 * The on-demand「留言...」input bar. Hidden until `controller.isOpen`; renders a
 * dark translucent pill (static placeholder `Text` when `editable === false`, a
 * live `TextInput` when `true`) + an accent send button. Tapping send forwards the
 * trimmed text to `onSend` and closes the bar. Returns `null` when not open.
 */
export function ChatComposerBar(props: ChatComposerBarProps): ReactElement | null {
  const { theme, controller, onSend, editable = true } = props;
  const [text, setText] = useState('');

  if (!controller.isOpen) return null;

  const trimmed = text.trim();
  const canSend = trimmed.length > 0;

  const send = (): void => {
    if (trimmed.length === 0) return;
    onSend?.(trimmed);
    setText('');
    controller.close();
  };

  // "不留言返回": dismiss the keyboard and close the bar WITHOUT sending. Parity iOS
  // rb-ios-chat-composer-dismiss-without-send / Android rb-android-composer-dismiss.
  const dismissWithoutSending = (): void => {
    Keyboard.dismiss();
    controller.close();
  };

  // The transparent tap-to-dismiss layer is rendered BEFORE the bar (a sibling), so the
  // bar paints on top: taps on the bar hit the field / send button, taps ABOVE it dismiss
  // without sending. When not open the whole component returns null (no tap capture).
  return (
    <>
      <Pressable
        onPress={dismissWithoutSending}
        testID={LBTestIDs.chatComposerDismiss}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 10,
          paddingTop: 8,
          paddingBottom: 10,
          // OPAQUE charcoal bar (rgb(20,20,24)) so the video does NOT show through the on-demand
          // composer (parity iOS rb-ios-chat-composer-opaque); the old 0.55 scrim let it bleed.
          backgroundColor: '#141418',
        }}
      >
      <View
        style={{
          flex: 1,
          height: 36,
          justifyContent: 'center',
          paddingHorizontal: 14,
          borderRadius: 18,
          // Solid input fill (iOS Color(white:0.18)) — opaque, not translucent.
          backgroundColor: '#2E2E2E',
          marginRight: 8,
        }}
      >
        {editable ? (
          <TextInput
            value={text}
            onChangeText={setText}
            testID={LBTestIDs.chatComposer}
            placeholder="留言..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            returnKeyType="send"
            autoCorrect={false}
            onSubmitEditing={send}
            style={{ color: '#FFFFFF', fontSize: 13, padding: 0 }}
          />
        ) : (
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>留言...</Text>
        )}
      </View>

      <Pressable
        onPress={send}
        disabled={!canSend}
        testID={LBTestIDs.chatSend}
        accessibilityRole="button"
        accessibilityLabel="送出留言"
      >
        <Text
          style={{
            fontSize: 26,
            color: canSend ? theme.accent : 'rgba(255,255,255,0.35)',
          }}
        >
          ⬆
        </Text>
      </Pressable>
      </View>
    </>
  );
}
