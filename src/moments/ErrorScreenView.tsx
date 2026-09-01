// ErrorScreenView — family-4 player moment surface 3 (full-screen terminal error).
//
// Spec: `reference-ui-rendering/spec.md` (family-4 moments, surface 3 error).
// Phase-4 RN sibling of the DONE iOS `ErrorScreenView.swift` (rb-ios-moments §3),
// Android `ErrorScreenView.kt` (rb-android-moments), and the AUTHORITATIVE Flutter
// blueprint `error_screen.dart` (rb-flutter-moments), translated here 1:1.
//   Design source: `design/templates/minimal/moments.jsx` · `LBPErrorScreen`
//     (kind / phase / onRetry / onDismiss — the dark-scrim terminal error overlay).
//
// The full-screen TERMINAL error moment for ONE `PlayerErrorState`. It is the third
// of the three family-4 moment sub-views composed by `MomentsView`, and it
// implements the agreed SUB-VIEW INPUT PATTERN documented in `MomentsView.tsx`:
//
//   1. `theme` (ReferenceUITheme)  — FIRST, always.
//   2. bound SNAPSHOT VALUE        — `error: PlayerErrorState` (`{ kind, phase }`),
//        passed BY VALUE from `MomentsModel` (never the model, never the template).
//        The container gates on `error != null`, so this sub-view takes a NON-null
//        value (mirrors the iOS non-optional `error`).
//   3. action callbacks (LAST, each optional / default no-op):
//        `onRetry?` (host wires to the core player re-load; shown only when retry can
//        help, i.e. `stream`) + `onDismiss?` (the 返回 / 關閉 exit). The container
//        owns NO core action — these forward to the host-wired container callbacks.
//        NO template / player moment intent exists for retry / dismiss (the Model is
//        pure read-only — see `MomentsModel.ts`).
//
// This sub-view reads ONLY its passed-in value; it never reaches back into
// `MomentsModel` / `DefaultPlayerTemplate` (one-way data flow). It MUST NOT
// re-classify the error — `kind` is ALREADY classified by the template
// (`errorKindFromType`); this layer ONLY maps the pre-classified `kind` to HUMAN
// copy (NO raw code shown). It MUST NOT drive / call retry itself — retry is the
// CORE player's job (the SDK auto-retries 3×/3s); the 重試 CTA ONLY forwards
// `onRetry`. `phase` is always `failed` (the only case core exposes).
//
// COPY BY KIND (人話, NO raw code — design §"訊息一律人話"; mirrors the Flutter /
// Android family-4 copy):
//   • `stream`   「連線發生問題」 → 重試 (onRetry) + 返回 (onDismiss, outlined)
//   • `notFound` 「找不到這部影片」 → 返回 (onDismiss) only (retry won't help)
//   • `outdated` 「請更新 App 以繼續觀看」 → 前往更新 ONLY (onDismiss; design secondary
//                  is null — no 返回; the host treats it as the upgrade entry)
//
// Retrying won't change the outcome for `notFound` (gone) / `outdated` (rejected
// build). `stream` shows 重試 + 返回; `notFound` shows a solo 返回; `outdated` shows a
// single accent 前往更新 CTA (aligned to design `LBPErrorScreen`, iOS / Android / Flutter
// parity). NO raw code.
//
// RENDER DISCIPLINE (inherited from family-1/2/3 / iOS / Android / Flutter): plain
// `View` / `Text` / `Pressable` only — NO ScrollView / FlatList / SectionList /
// VirtualizedList, NO network-uri Image, NO Canvas / react-native-svg / Animated.
// Glyphs are deterministic Text glyphs (react-native-vector-icons is unavailable in
// this layer). The error moment is a dark full-bleed scrim regardless of the light
// surface theme (design-literal). No animation / no randomness so the structural
// baseline is stable.

import type { ReactElement } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '../TightText';

import type { ReferenceUITheme } from '../theme';
import { LBTestIDs } from '../testing/LBTestIDs';
import { PlayerErrorKind } from 'livebuy-react-native-ui';
import type { PlayerErrorState } from 'livebuy-react-native-ui';

// MARK: - Decorative design tokens (literal — lifted verbatim from LBPErrorScreen)
//
// accent / fontScale come from the resolved `ReferenceUITheme`. These are FIXED
// decorative colors lifted verbatim from the design's `LBPErrorScreen` (the dark
// scrim + on-scrim whites + danger). They mirror the iOS / Android / Flutter
// `ErrorScreenView` static colors so the four platforms read as one family. NOT
// theme-resolved (the error moment is a dark full-bleed scrim regardless of the
// light surface theme).

/** Full-bleed dim scrim (`rgba(10,10,14,0.9)` — design `LBPErrorScreen` bg). */
const SCRIM = 'rgba(10,10,14,0.9)';
/** Danger glyph / icon color (`#EB6E5F` — design `DANGER` = danger.400). */
const DANGER = '#EB6E5F';
/** Primary on-scrim text (white). */
const ON_SCRIM_TEXT = '#FFFFFF';
/** Secondary on-scrim text (`rgba(255,255,255,0.62)`). */
const ON_SCRIM_DIM = 'rgba(255,255,255,0.62)';
/** Outlined secondary button stroke (`rgba(255,255,255,0.28)`). */
const ON_SCRIM_STROKE = 'rgba(255,255,255,0.28)';
/** Solo-secondary filled affordance (`rgba(255,255,255,0.12)`). */
const ON_SCRIM_FILL = 'rgba(255,255,255,0.12)';

// MARK: - Fixed localized copy (static presentation strings — 人話, NO raw code)
//
// Mirrors the Flutter / Android family-4 copy: `stream`「播放發生問題」(重試 + 返回) /
// `notFound`「找不到影片」(僅返回) / `outdated`「請更新版本」(前往更新 + 返回). NO raw code.

const STREAM_TITLE = '連線發生問題';
const STREAM_BODY = '目前無法載入這場直播，請確認網路後再試一次。';
const NOT_FOUND_TITLE = '找不到這部影片';
const NOT_FOUND_BODY = '這部影片可能已下架或不存在。';
const OUTDATED_TITLE = '請更新 App 以繼續觀看';
const OUTDATED_BODY = '你的版本較舊，更新後即可觀看這場直播。';
const RETRY_LABEL = '重試';
const UPDATE_LABEL = '前往更新';
const DISMISS_LABEL = '返回';

/**
 * The resolved human copy + presentation for one error kind (pure value type).
 * `primaryLabel == null` → no primary CTA (返回 is the solo filled action).
 */
interface ErrorCopy {
  readonly title: string;
  readonly body: string;
  /** Deterministic Text glyph for the kind's icon disc. */
  readonly glyph: string;
  /** The primary CTA label (重試 / 前往更新), or `null` when retry won't help. */
  readonly primaryLabel: string | null;
  /** Optional leading glyph on the primary CTA (重試 → refresh; 前往更新 → none). */
  readonly primaryGlyph: string | null;
  /**
   * `outdated` tints the icon disc with the brand accent (update affordance);
   * `stream` / `notFound` tint with the design's danger color.
   */
  readonly accentTinted: boolean;
  /**
   * When true, the primary CTA forwards `onDismiss` instead of `onRetry`
   * (`outdated` 前往更新 — design wires the outdated primary to onDismiss; the host
   * treats it as the upgrade entry). `stream` 重試 → false (forwards onRetry).
   */
  readonly primaryForwardsDismiss: boolean;
  /**
   * Whether the secondary 返回 (outlined, onDismiss) is shown beneath the primary
   * CTA. `stream` → true; `outdated` → false (design secondary is null — a single
   * 前往更新 CTA). `notFound` has no primary, so 返回 is the solo filled action.
   */
  readonly showBack: boolean;
}

// MARK: - Human copy per kind (pure — maps PRE-CLASSIFIED kind to copy/glyph)
//
// NOTE: this is NOT re-classification of the error — `kind` is already the
// template's classification (`errorKindFromType`). We map the three KNOWN `kind`
// cases to human copy + a glyph + the primary CTA. NO raw code shown.

/** Map a PRE-CLASSIFIED `PlayerErrorKind` to its human copy + presentation. */
export function errorCopyFor(kind: PlayerErrorKind): ErrorCopy {
  switch (kind) {
    case PlayerErrorKind.NotFound:
      return {
        title: NOT_FOUND_TITLE,
        body: NOT_FOUND_BODY,
        glyph: '🔍', // magnifier — search-off (the video is gone)
        primaryLabel: null, // retry won't help → 返回 only
        primaryGlyph: null,
        accentTinted: false,
        primaryForwardsDismiss: false,
        showBack: true,
      };
    case PlayerErrorKind.Outdated:
      // 前往更新 ONLY (design secondary:null) — the dedicated accent upgrade CTA,
      // wired to onDismiss (design `isOutdated ? onDismiss`; the host treats it as
      // the upgrade entry). No 返回. Retry won't help a rejected build.
      return {
        title: OUTDATED_TITLE,
        body: OUTDATED_BODY,
        glyph: '⬆', // up-arrow — update affordance
        primaryLabel: UPDATE_LABEL,
        primaryGlyph: null,
        accentTinted: true,
        primaryForwardsDismiss: true,
        showBack: false,
      };
    // `stream` is also the GENERIC bucket for any unmapped error type.
    case PlayerErrorKind.Stream:
    default:
      return {
        title: STREAM_TITLE,
        body: STREAM_BODY,
        glyph: '⚠', // struck-through wifi intent — connection / stream problem
        primaryLabel: RETRY_LABEL,
        primaryGlyph: '↻', // refresh — retry
        accentTinted: false,
        primaryForwardsDismiss: false,
        showBack: true,
      };
  }
}

/** Props for the {@link ErrorScreen} surface. */
export interface ErrorScreenProps {
  /** The resolved reference-ui theme (FIRST argument, always). */
  readonly theme: ReferenceUITheme;
  /**
   * The terminal error snapshot this moment renders (`{ kind, phase }`). The
   * container gates on `error != null`, so this is NON-null. Read-only — `kind` is
   * ALREADY classified by the template (this layer never re-classifies); `phase` is
   * always `Failed`.
   */
  readonly error: PlayerErrorState;
  /**
   * Host-wired「重試」/「前往更新」→ host → core re-load. Retry is the CORE player's
   * job (SDK auto-retries 3×/3s); this layer ONLY forwards the CTA tap, never
   * retries / loads itself. Shown only for `stream` (重試) / `outdated` (前往更新);
   * hidden for `notFound`. Defaults to a no-op (demo / snapshot instances).
   */
  readonly onRetry?: () => void;
  /**
   * Host-wired「返回」/「關閉」→ host → dismiss the error moment / player. Defaults to
   * a no-op (demo / snapshot instances render correctly action-free).
   */
  readonly onDismiss?: () => void;
}

/**
 * The family-4 full-screen terminal error moment for one {@link PlayerErrorState}.
 * Renders a centered error card — an icon disc + kind-specific 人話 title / body —
 * over a full-bleed dim scrim, with a primary CTA (重試 for `stream`, 前往更新 for
 * `outdated`; hidden for `notFound`, where retry can't help) and a 返回 secondary.
 * Retry is the core player's job; the CTA only FORWARDS `onRetry`. Reads ONLY the
 * passed-in error (no re-classification).
 *
 * Renders correctly with `onRetry` / `onDismiss` omitted (snapshot / preview safe).
 */
export function ErrorScreen(props: ErrorScreenProps): ReactElement {
  const { theme, error, onRetry, onDismiss } = props;
  const copy = errorCopyFor(error.kind);
  const tint = copy.accentTinted ? theme.accent : DANGER;

  // Full-bleed dim scrim (design `rgba(10,10,14,0.9)`) with the centered error card
  // composited over it. Plain View columns — no Lazy / Scroll.
  return (
    <View
      testID={LBTestIDs.momentError}
      style={{
        flex: 1,
        backgroundColor: SCRIM,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          maxWidth: 320,
          paddingHorizontal: 36,
          alignItems: 'center',
        }}
      >
        <IconBadge theme={theme} glyph={copy.glyph} tint={tint} />
        <View style={{ height: 16 }} />
        <MessageBlock theme={theme} title={copy.title} body={copy.body} />
        <View style={{ height: 22 }} />
        <Actions
          theme={theme}
          copy={copy}
          onRetry={onRetry}
          onDismiss={onDismiss}
        />
      </View>
    </View>
  );
}

// MARK: - Icon badge (tinted disc + kind glyph — LBPErrorScreen icon disc)
//
// `outdated` tints with the brand accent (a「前往更新」-style affordance, not a
// danger); `stream` / `notFound` tint with the design's danger color.

function IconBadge(props: {
  theme: ReferenceUITheme;
  glyph: string;
  tint: string;
}): ReactElement {
  const { theme, glyph, tint } = props;
  return (
    <View
      style={{
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: tintWithAlpha(tint, 0.14),
        borderWidth: 1,
        borderColor: tintWithAlpha(tint, 0.4),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 28 * theme.fontScale, color: tint }}>{glyph}</Text>
    </View>
  );
}

// MARK: - Message block (人話 title + body — NO raw code)

function MessageBlock(props: {
  theme: ReferenceUITheme;
  title: string;
  body: string;
}): ReactElement {
  const { theme, title, body } = props;
  return (
    <View style={{ maxWidth: 280, alignItems: 'center' }}>
      <Text
        style={{
          color: ON_SCRIM_TEXT,
          fontSize: 18 * theme.fontScale,
          fontWeight: '800',
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <View style={{ height: 7 }} />
      <Text
        style={{
          color: ON_SCRIM_DIM,
          fontSize: 13 * theme.fontScale,
          lineHeight: 13 * theme.fontScale * 1.5,
          textAlign: 'center',
        }}
      >
        {body}
      </Text>
    </View>
  );
}

// MARK: - Actions (per-kind — aligned to LBPErrorScreen)
//
// `stream`   → 重試 (accent filled primary, forwards onRetry) + 返回 (outlined,
//              onDismiss).
// `outdated` → 前往更新 ONLY (accent filled primary, forwards onDismiss; design
//              secondary:null) — retry won't help, NO 返回.
// `notFound` → 返回 ONLY, the FILLED affordance (onDismiss; the single action) —
//              retry would not help, so the primary CTA is hidden entirely.

function Actions(props: {
  theme: ReferenceUITheme;
  copy: ErrorCopy;
  onRetry?: () => void;
  onDismiss?: () => void;
}): ReactElement {
  const { theme, copy, onRetry, onDismiss } = props;
  return (
    <View style={{ maxWidth: 260, alignSelf: 'stretch', alignItems: 'stretch' }}>
      {copy.primaryLabel != null ? (
        <>
          {/* Primary 重試 (onRetry) / 前往更新 (onDismiss — the upgrade entry). This
              layer never retries / loads itself; it only forwards the CTA tap. */}
          <FilledButton
            theme={theme}
            label={copy.primaryLabel}
            leadingGlyph={copy.primaryGlyph}
            testID={LBTestIDs.momentErrorRetry}
            onTap={() =>
              copy.primaryForwardsDismiss ? onDismiss?.() : onRetry?.()
            }
          />
          {/* Secondary 返回 — outlined, only when the kind keeps a 返回 (`stream`;
              `outdated` is a single 前往更新 CTA). */}
          {copy.showBack ? (
            <>
              <View style={{ height: 10 }} />
              <OutlinedButton
                theme={theme}
                label={DISMISS_LABEL}
                testID={LBTestIDs.momentErrorBack}
                onTap={() => onDismiss?.()}
              />
            </>
          ) : null}
        </>
      ) : (
        /* 返回 ONLY — the single action, rendered as the filled affordance (the
           primary CTA is hidden for `notFound`). */
        <FilledButton
          theme={theme}
          label={DISMISS_LABEL}
          fill={ON_SCRIM_FILL}
          testID={LBTestIDs.momentErrorBack}
          onTap={() => onDismiss?.()}
        />
      )}
    </View>
  );
}

/**
 * Filled button (accent primary CTA / solo 返回). Forwards `onTap` (a no-op when
 * the host callback is omitted — demo / snapshot). Optional leading glyph (重試 has
 * a refresh glyph). `fill` overrides the accent for the solo-返回 affordance.
 */
function FilledButton(props: {
  theme: ReferenceUITheme;
  label: string;
  leadingGlyph?: string | null;
  fill?: string;
  testID?: string;
  onTap: () => void;
}): ReactElement {
  const { theme, label, leadingGlyph, fill, testID, onTap } = props;
  return (
    <Pressable
      onPress={onTap}
      testID={testID}
      style={{
        paddingVertical: 13,
        borderRadius: 12,
        backgroundColor: fill ?? theme.accent,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
      }}
    >
      {leadingGlyph != null ? (
        <>
          <Text style={{ fontSize: 16 * theme.fontScale, color: ON_SCRIM_TEXT }}>
            {leadingGlyph}
          </Text>
          <View style={{ width: 7 }} />
        </>
      ) : null}
      <Text
        style={{
          color: ON_SCRIM_TEXT,
          fontSize: 15 * theme.fontScale,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Outlined secondary button (返回 alongside a primary CTA). Forwards `onTap`. */
function OutlinedButton(props: {
  theme: ReferenceUITheme;
  label: string;
  testID?: string;
  onTap: () => void;
}): ReactElement {
  const { theme, label, testID, onTap } = props;
  return (
    <Pressable
      onPress={onTap}
      testID={testID}
      style={{
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: ON_SCRIM_STROKE,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: ON_SCRIM_TEXT,
          fontSize: 14.5 * theme.fontScale,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// MARK: - Tint alpha helper (deterministic — no animation / randomness)
//
// The icon disc fills / strokes the kind tint at a low alpha (design `0.14` fill /
// `0.40` stroke). `theme.accent` is an opaque `#RRGGBB`; `DANGER` is `#EB6E5F`.
// Convert to an `rgba(...)` with the given alpha so the disc reads as a soft tint
// over the dark scrim (parity with the iOS `.opacity(...)` / Flutter `withValues`).

/** Convert an opaque `#RRGGBB` hex to an `rgba(r,g,b,alpha)` string. */
export function tintWithAlpha(hex: string, alpha: number): string {
  const body = hex.startsWith('#') ? hex.slice(1) : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(body)) {
    // Fallback to a neutral translucent fill if a non-hex token slips through
    // (deterministic — never throws in a snapshot).
    return `rgba(255,255,255,${alpha})`;
  }
  const r = parseInt(body.slice(0, 2), 16);
  const g = parseInt(body.slice(2, 4), 16);
  const b = parseInt(body.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
