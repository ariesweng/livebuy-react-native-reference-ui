// MARK: - ReferenceUILanguage — reference-ui 目前語言的單一來源 + React 訂閱 hook
//
// Spec: `reference-ui-rendering/spec.md`
//   §「（RN）reference-ui 文案走字串表並支援執行中切換語言」
// Change: `rb-rn-i18n-string-table`（design.md D5 / D6）。
//
// 語言來源是 core（`livebuy-react-native`）的 `LivebuySDK.currentLanguage`（同步快取）與
// `LivebuySDK.addLanguageListener`（值實際改變才通知）。本模組：
//   • `getSnapshot()` 一律「現讀」core 的同步快取（再套 test override），所以沒有 React 訂閱者時
//     （例如純函式在 render 以外被呼叫）也不會讀到舊值；
//   • 只在「第一個」React 訂閱者出現時向 core 訂閱一次、最後一個離開時取消（ref count），所以不論畫面上
//     有多少元件呼叫 `useReferenceUILanguage()`，core 端永遠只有 0 或 1 個 listener，不洩漏；
//   • 第一個訂閱者出現時另外發一次 `getLanguage()` 重讀原生值（fire-and-forget）——補上「原生 listener
//     未安裝時，原生發起的語言變更不會進到 JS 快取」這個 core 已知限制在掛載當下的落差（design.md D6）。
//
// core 的根 barrel 在載入時會解構 `NativeModules.LivebuyRNBridge`；本 package 的 jest `react-native`
// mock 沒有 `NativeModules`，所以這裡不能 `import { LivebuySDK } from 'livebuy-react-native'`（會讓所有
// 測試在 import 階段崩潰）。改在模組初始化時以 try/catch 包住的頂層 `require` 取得——比照
// `safearea/optionalSafeAreaContext.ts` 的說明：`require` 必須在模組初始化時執行（不可移進函式，否則
// Metro 在 render 期的失敗會變成 fatal）。取不到（jest）或形狀不對（測試 mock）時退回 en
// （`rb-rn-i18n-fallback-en` 起；與 core 語言優先序最後的 fallback `en` 一致，之前是 zh-TW）。

import { useSyncExternalStore } from 'react';

/** The 5 locales reference-ui ships string tables for — same set as core's `currentLanguage`. */
export const REFERENCE_UI_LANGUAGES = ['zh-TW', 'zh-CN', 'en', 'ms-MY', 'id-ID'] as const;

export type ReferenceUILanguageCode = (typeof REFERENCE_UI_LANGUAGES)[number];

/**
 * Fallback locale (`rb-rn-i18n-fallback-en`: `en`, matching core's last-resort fallback; was zh-TW):
 * missing-key lookup falls back to this table, unknown codes normalize to it, and it is the value
 * when core is unavailable / lacks the language API. The zh-TW table remains the authoritative key
 * list (enforced by the table tests), independent of this constant.
 */
export const FALLBACK_LANGUAGE: ReferenceUILanguageCode = 'en';

/** Map any value to one of the 5 supported codes (anything else → `FALLBACK_LANGUAGE`, i.e. en). */
export function normalizeLanguage(value: unknown): ReferenceUILanguageCode {
  return typeof value === 'string' && (REFERENCE_UI_LANGUAGES as readonly string[]).includes(value)
    ? (value as ReferenceUILanguageCode)
    : FALLBACK_LANGUAGE;
}

/** Where the current language comes from (injectable — `internal-testability`). */
export interface ReferenceUILanguageSource {
  /** Synchronous current value (core `LivebuySDK.currentLanguage`). */
  current(): unknown;
  /** Subscribe to changes; returns an unsubscribe function (core `addLanguageListener`). */
  subscribe(listener: () => void): () => void;
  /** Optional fire-and-forget native re-read (core `getLanguage()`). */
  refresh?(): void;
}

/** The store `useReferenceUILanguage` / `ReferenceUIStrings.text` read. */
export interface ReferenceUILanguageStore {
  /** React `useSyncExternalStore` subscribe: ref-counted single subscription to the source. */
  subscribe(listener: () => void): () => void;
  /** Effective language = test override ?? normalized source value (read live). */
  getSnapshot(): ReferenceUILanguageCode;
  /** Test-only: force a language (`null` = follow the source). Notifies subscribers. */
  setOverrideForTesting(code: ReferenceUILanguageCode | null): void;
  /** Test-only: current override. */
  overrideForTesting(): ReferenceUILanguageCode | null;
  /** Test-only: number of live subscriptions held on the source (0 or 1). */
  sourceSubscriptionCountForTesting(): number;
}

/** Build a store over `source` (`null` → always `FALLBACK_LANGUAGE`, i.e. en). Pure factory — unit-testable with a fake source. */
export function createReferenceUILanguageStore(
  source: ReferenceUILanguageSource | null,
  initialOverride: ReferenceUILanguageCode | null = null,
): ReferenceUILanguageStore {
  const listeners = new Set<() => void>();
  let override: ReferenceUILanguageCode | null = initialOverride;
  let unsubscribeSource: (() => void) | null = null;

  function notify(): void {
    Array.from(listeners).forEach((l) => l());
  }

  function readSource(): ReferenceUILanguageCode {
    if (source == null) return FALLBACK_LANGUAGE;
    try {
      return normalizeLanguage(source.current());
    } catch {
      return FALLBACK_LANGUAGE;
    }
  }

  function attachSource(): void {
    if (source == null || unsubscribeSource != null) return;
    try {
      const unsubscribe = source.subscribe(notify);
      unsubscribeSource = typeof unsubscribe === 'function' ? unsubscribe : null;
    } catch {
      unsubscribeSource = null;
    }
    try {
      source.refresh?.();
    } catch {
      // A failing native re-read must never break rendering.
    }
  }

  function detachSource(): void {
    const unsubscribe = unsubscribeSource;
    unsubscribeSource = null;
    try {
      unsubscribe?.();
    } catch {
      // ignore
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) attachSource();
      return () => {
        if (!listeners.delete(listener)) return;
        if (listeners.size === 0) detachSource();
      };
    },
    getSnapshot() {
      return override ?? readSource();
    },
    setOverrideForTesting(code) {
      override = code;
      notify();
    },
    overrideForTesting() {
      return override;
    },
    sourceSubscriptionCountForTesting() {
      return unsubscribeSource != null ? 1 : 0;
    },
  };
}

// MARK: - core source (module-initialisation-time lookup — see the header)

// CommonJS `require` — the package ships untranspiled TypeScript compiled by the host's Metro / by
// ts-jest; neither declares it for this tsconfig.
declare const require: (id: string) => unknown;

let loadedCore: unknown = null;
try {
  loadedCore = require('livebuy-react-native');
} catch {
  loadedCore = null;
}

/** PURE: adapt a loaded core module to a source, or `null` when it lacks the language API. */
export function coreLanguageSource(loaded: unknown): ReferenceUILanguageSource | null {
  if (loaded == null || typeof loaded !== 'object') return null;
  const sdk = (loaded as { LivebuySDK?: unknown }).LivebuySDK as
    | {
        currentLanguage?: unknown;
        addLanguageListener?: (cb: (lang: unknown) => void) => unknown;
        getLanguage?: () => unknown;
      }
    | null
    | undefined;
  if (sdk == null || typeof sdk.addLanguageListener !== 'function') return null;
  return {
    current: () => sdk.currentLanguage,
    subscribe: (listener) => {
      const unsubscribe = sdk.addLanguageListener!(() => listener());
      return typeof unsubscribe === 'function' ? (unsubscribe as () => void) : () => undefined;
    },
    refresh: () => {
      if (typeof sdk.getLanguage !== 'function') return;
      // Swallow rejections — the core cache stays as-is on failure.
      Promise.resolve(sdk.getLanguage()).catch(() => undefined);
    },
  };
}

/**
 * Test-only language pin (rb-rn-i18n-string-table D7): the jest setup file
 * `test-support/languagePin.ts` sets this global to `'zh-TW'` before any module loads, so every
 * test runs in zh-TW regardless of what a test's core mock reports. Unset in production.
 */
function initialPin(): ReferenceUILanguageCode | null {
  const pin = (globalThis as { __LIVEBUY_REFERENCE_UI_LANGUAGE_PIN__?: unknown })
    .__LIVEBUY_REFERENCE_UI_LANGUAGE_PIN__;
  return typeof pin === 'string' ? normalizeLanguage(pin) : null;
}

/** The process-wide store every reference-ui surface reads. */
export const referenceUILanguage: ReferenceUILanguageStore = createReferenceUILanguageStore(
  coreLanguageSource(loadedCore),
  initialPin(),
);

/**
 * Subscribe the calling component to the reference-ui language and return the current code.
 * Every component that renders string-table copy calls this once at the top, so a language change
 * re-renders it (and, since reference-ui uses no `React.memo`, its whole subtree).
 */
export function useReferenceUILanguage(): ReferenceUILanguageCode {
  return useSyncExternalStore(
    referenceUILanguage.subscribe,
    referenceUILanguage.getSnapshot,
    referenceUILanguage.getSnapshot,
  );
}
