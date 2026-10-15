// MARK: - ReferenceUIStrings — reference-ui 自帶字串表的查表入口
//
// Spec: `reference-ui-rendering/spec.md`
//   §「（RN）reference-ui 文案走字串表並支援執行中切換語言」
// Change: `rb-rn-i18n-string-table`（design.md 有 key 清單、RN 獨有 key、zh-TW 差異清單與命名規則）；
// key / 譯文 / 占位符與 iOS lead `rb-ios-i18n-string-table` 一致。
//
// reference-ui 的使用者可見文案一律經 `text(key, args)` 依「目前語言」查表：
//   • 目前語言 = `referenceUILanguage.getSnapshot()`（來源是 core 的 `LivebuySDK.currentLanguage`，
//     經 `addLanguageListener` 即時更新，見 `ReferenceUILanguage.ts`）。元件要在語言改變時重繪，必須在
//     render 開頭呼叫 `useReferenceUILanguage()`。
//   • 找不到 key 時依序 fallback：目前語言表 → en 表 → key 本身（dev 模式 log）。`rb-rn-i18n-fallback-en`
//     起由 zh-TW 改為 en，與 core 語言優先序最後的 fallback 一致；zh-TW 表仍是 key 清單的權威來源。
//   • 占位符四端統一為具名 `{name}`（不用 `%s` / `%d`），由 `format` 代入。
//
// 字串表本體在同目錄的 `strings.<locale>.ts`，每個 locale 一個檔、一行一筆（四端對照 script 與 jest
// 對照測試以 regex 逐行解析，所以每筆 MUST 獨佔一行、不跨行、不串接、不用模板字串）。

import { en } from './strings.en';
import { idID } from './strings.idID';
import { msMY } from './strings.msMY';
import { zhCN } from './strings.zhCN';
import { zhTW } from './strings.zhTW';
import {
  FALLBACK_LANGUAGE,
  REFERENCE_UI_LANGUAGES,
  referenceUILanguage,
  type ReferenceUILanguageCode,
} from './ReferenceUILanguage';

export type StringTable = Readonly<Record<string, string>>;

/** locale code → table. */
export const STRING_TABLES: Readonly<Record<ReferenceUILanguageCode, StringTable>> = {
  'zh-TW': zhTW,
  'zh-CN': zhCN,
  en,
  'ms-MY': msMY,
  'id-ID': idID,
};

export { REFERENCE_UI_LANGUAGES, FALLBACK_LANGUAGE };

/** Placeholder arguments: `{name}` → value (numbers are stringified with `String()`). */
export type TextArgs = Readonly<Record<string, string | number>>;

declare const __DEV__: boolean | undefined;

/** Missing-key log (dev only). */
export function logMissingKey(key: string): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  // eslint-disable-next-line no-console
  console.warn(`[LivebuyReferenceUI] missing string key '${key}' — falling back to the key itself`);
}

/**
 * Replace every `{name}` in `template` with `args[name]`. Placeholders without an arg are left
 * as-is (visible in QA rather than silently blanked).
 */
export function format(template: string, args?: TextArgs): string {
  if (args == null) return template;
  let out = template;
  for (const name of Object.keys(args)) {
    out = out.split(`{${name}}`).join(String(args[name]));
  }
  return out;
}

/** The set of `{name}` placeholder names in `value` (used by the completeness tests). */
export function placeholders(value: string): Set<string> {
  const out = new Set<string>();
  const re = /\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) != null) out.add(m[1]);
  return out;
}

/** Pure lookup: `language` table → `FALLBACK_LANGUAGE` (en) table → `key` itself (with a dev log). */
export function resolve(
  key: string,
  args: TextArgs | undefined,
  language: string,
  tables: Readonly<Record<string, StringTable>> = STRING_TABLES,
  missingKeyLog: (key: string) => void = logMissingKey,
): string {
  const value = tables[language]?.[key] ?? tables[FALLBACK_LANGUAGE]?.[key];
  if (value !== undefined) return format(value, args);
  missingKeyLog(key);
  return key;
}

/**
 * Look up `key` in the CURRENT reference-ui language and substitute `{name}` placeholders. A
 * component calling this during render MUST also call `useReferenceUILanguage()` so a language
 * change re-renders it.
 */
export function text(key: string, args?: TextArgs): string {
  return resolve(key, args, referenceUILanguage.getSnapshot());
}

// MARK: - Locale-aware month/day (rb-rn-i18n-string-table D8)
//
// Same output as iOS (`DateFormatter` CLDR `MMMd`) / Android (ICU `getInstanceForSkeleton("MMMd")`):
// zh-TW / zh-CN `6月11日`, en `Jun 11`, ms-MY / id-ID `11 Jun`. Implemented with fixed CLDR
// abbreviated month names instead of `Intl.DateTimeFormat` because Hermes' `Intl` support varies by
// RN version / build flags (and may lack ms / id data) — a fixed table is deterministic everywhere.
// A jest test cross-checks every month against Node's full-ICU `Intl` output.

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MS_MONTHS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
const ID_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** Days in `month` of a leap year (2/29 stays valid — the year is not displayed). */
function daysInMonth(month: number): number {
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** Month + day in `language`'s CLDR `MMMd` form; `''` for an invalid month/day. */
export function monthDay(month: number, day: number, language: string): string {
  if (!Number.isInteger(month) || !Number.isInteger(day)) return '';
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(month)) return '';
  switch (language) {
    case 'en':
      return `${EN_MONTHS[month - 1]} ${day}`;
    case 'ms-MY':
      return `${day} ${MS_MONTHS[month - 1]}`;
    case 'id-ID':
      return `${day} ${ID_MONTHS[month - 1]}`;
    default:
      // zh-TW / zh-CN (and any unknown code, which the store never produces).
      return `${month}月${day}日`;
  }
}
