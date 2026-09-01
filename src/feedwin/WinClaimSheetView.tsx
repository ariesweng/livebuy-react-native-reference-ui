// WinClaimSheetView — family-2 feed-win surface 3 (四階段領獎 modal，含 email 輸入，RN).
//
// Spec: `reference-ui-rendering/spec.md`
//   § "渲染 RN 四階段領獎 modal（含 email 輸入），綁 classifyAward+awardClaimResultState+submitInFlight"
// Design: `design/templates/minimal/moments.jsx` `LBWinSheet`（2026-08-29 R27 分頁 + 關閉機制簡化版）
//         + `design/contract/claude-design-sync.md` **R13**（刻意分歧仍有效，見下）/ **R27**。
// Parity: iOS `ios/Sources/LivebuyReferenceUI/FeedWin/WinClaimModalView.swift`
//         （`rb-ios-win-claim-pagination` parity，尚在進行中 —— 本檔是四端 R27 落地的第一份）。
//
// ─────────────────────────────────────────────────────────────────────────────
// EMAIL-LESS 已退役（rb-rn-win-claim-email-flow）
// ─────────────────────────────────────────────────────────────────────────────
// 這張 sheet 先前是 EMAIL-LESS 的「通知型」單頁底部 sheet：CTA 直接 `onClaim(winner)`
// → `DefaultPlayerTemplate.submitAwardClaim(winner)` → core `requestAwardClaim(winner, null)`。
// 但 core 預設領獎路徑 `email` **必填** —— host 未攔截 `awardClaimIntent` 又沒有 email 時，
// core fail-fast 發 `AWARD_CLAIM_RESULT(status='failed')`、**連 `POST /sdk/video/claim` 都沒
// 送出**。訪客（僅 `guest_id`）全程可參加抽獎並中獎，卻沒有任何地方能填 email，於是 turnkey
// host 必然回報「中獎領取失敗」。本檔即是把 email 欄位真正畫出來的那一層。
//
// 四階段流程（對齊設計稿 `LBWinSheet` 的 `stage` 機，R27 起 `confirmClose` 已退役）：
//
//   claim         恭喜中獎 + award.name + ✉ email 欄 +「確認領獎」+（pageCount>1 時額外畫分頁
//                 圓點）+ footer
//     └「確認領獎」→ confirmSubmit alert →（確定）→ submitting → done / fail
//   done          discount → 折扣碼 + 複製 + 寄送信箱；product → 待結帳商品卡
//   fail          領獎失敗 + 通用錯誤提示列 +「重新領獎」（回 confirmSubmit）
//
// 關閉（R27）：唯一路徑是點擊外層 scrim，**任何 stage 皆可**直接 dismiss（無 ✕、無「關閉視窗」
// 文字鈕、無二次確認 alert）——舊有的 `confirmClose` 強勸阻文案已整段退役，見
// {@link handleDismissConfirmed} 的說明。
//
// 分頁（R27 新增）：`pageCount?`、`pageIndex?`、`onPage?` 三個 prop 對齊設計稿同名 prop。
// `claim` 卡（唯一畫分頁 UI 的卡）支援兩種切頁方式：底部分頁圓點（點擊直接 `onPage(index)`）
// 與水平滑動手勢（40px 閾值，見 {@link swipePageDelta}）。`done`、`fail` 卡不畫分頁。
//
// ─────────────────────────────────────────────────────────────────────────────
// 單一真相（stage 怎麼來的）
// ─────────────────────────────────────────────────────────────────────────────
// 設計稿用「一個 `stage` state」跑完全程。原生若照抄，`submitting` / `done` / `fail` 會變成
// 本層自己維護的**第二份真相**，與 view-model 的 `submitInFlight` / `awardClaimResultState`
// 必然分歧。因此這裡拆成：
//
//   • 本層 `useState` 只存**使用者互動意圖**（{@link WinClaimPhase}）與 email 輸入字串
//     （外加「已複製」的短暫視覺回饋）。
//   • 實際 stage 由**純函式** {@link winClaimStage} 推導，`submitting` 綁傳入的
//     `submitInFlight`、`done` / `fail` 綁 `resultState`。
//
// ⚠️ Known hang（view-model 已載明）：native host 攔截 `awardClaimIntent` 時 core 不發
// `AWARD_CLAIM_RESULT`，`submitInFlight` 會一直為真、畫面停在 submitting。收尾責任在 host
// （呼叫 `dismissClaim()`）。本層 **MUST NOT** 自加提交逾時或自行猜測結果 —— 那就是第二份真相。
//
// ─────────────────────────────────────────────────────────────────────────────
// SUB-VIEW INPUT PATTERN（與 family-2 其餘 surface 相同）
// ─────────────────────────────────────────────────────────────────────────────
//   1. `theme` (ReferenceUITheme)              — FIRST, always.
//   2. bound SNAPSHOT VALUES (read-only, BY VALUE):
//        `winner` / `classification` / `resultState` / `submitInFlight` —— 由 `FeedWinModel`
//        by value 傳入（never the model, never the template）。
//   3. action callbacks (LAST, each defaulting to a no-op):
//        `onSubmit?: (email: string) => void`（帶使用者輸入的 email，funnel 到
//        `DefaultPlayerTemplate.submitAwardClaim(winner, email)`）、`onDismiss?: () => void`
//        （關閉，funnel 到 `dismissClaim()` + 清容器綁定）、`onCopyCode?: (code) => void`
//        （折扣碼複製，委派 host 寫剪貼簿）、以及 DEPRECATED 的 `onClaim?: (winner) => void`。
//
// 本 sub-view 只讀傳入值，從不回抓 `FeedWinModel` / `DefaultPlayerTemplate`（單向資料流），
// 且所有 callback 為 undefined 時仍能正確渲染（demo / 結構快照可 action-free 建構）。
//
// RENDER DISCIPLINE（沿用本層既有紀律）：plain `View` / `Text` / `Pressable`，本 change 新增
// `TextInput`（email 欄位的必要新增）與 `KeyboardAvoidingView`（原生鍵盤避讓，**非**捲動容器）。
// 仍然 NO `ScrollView` / `FlatList` / `SectionList` / `VirtualizedList`、NO 網路 uri `Image`、
// NO 動畫 / 亂數（confetti 取決定性首幀靜態），故結構樹 byte-stable。`theme` FIRST；jsx
// automatic runtime（no React import）。

import { useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { View, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { Text } from '../TightText';

import type { ReferenceUITheme } from '../theme';
import {
  AwardClaimClassification,
  AwardClaimOutcome,
  isValidClaimEmail,
} from 'livebuy-react-native-ui';
import type { AwardClaimResultState } from 'livebuy-react-native-ui';
import type { LBWinner } from 'livebuy-react-native';
import { LBTestIDs } from '../testing/LBTestIDs';
import { WarningGlyph } from '../productsheets/WarningGlyph';

// MARK: - Stage 機（型別 + 純函式推導）

/** 對外可辨識的呈現階段（對齊設計稿 `LBWinSheet` 的 `stage`）。 */
export type WinClaimStage =
  /** 恭喜中獎 + email 輸入（可提交）。 */
  | 'claim'
  /** 「確認領獎」alert（確認 email 正確）。 */
  | 'confirmSubmit'
  /** 送出中（scrim + spinner），由 view-model `submitInFlight` 驅動。 */
  | 'submitting'
  /** 領獎完成，由 view-model `resultState` 的成功態驅動。 */
  | 'done'
  /** 領獎失敗，由 view-model `resultState` 的 `Failure` 驅動。 */
  | 'fail';

/**
 * 本層 `useState` 持有的**使用者互動意圖**（不是 stage 本身）。
 *
 * `'editing'` 這一格是為了忠實還原設計稿「fail →「重新領獎」→ 確認 alert →（取消）→ 回到
 * 可改 email 的 claim 卡」路徑：alert 取消時一律設 `'editing'`，讓殘留的 `resultState`
 * （仍是 `Failure`）不要把畫面拉回 fail 卡。真正送出時設回 `'idle'`，讓新一輪結果能重新
 * 驅動 done / fail。
 *
 * `'confirmClose'` 已於 R27 退役 —— 關閉唯一路徑改為外層 scrim 的無條件 dismiss，不再有
 * 獨立的「關閉中」互動意圖。
 */
export type WinClaimPhase = 'idle' | 'editing' | 'confirmSubmit';

/**
 * 由 view-model 結果狀態映射出的終態 stage（純函式）。
 * `null`（或未知 outcome）→ `'claim'`（提交前態）。
 */
export function winClaimResultStage(result: AwardClaimResultState | null): WinClaimStage {
  if (result == null) return 'claim';
  switch (result.outcome) {
    case AwardClaimOutcome.SuccessProduct:
    case AwardClaimOutcome.SuccessDiscount:
      return 'done';
    case AwardClaimOutcome.Failure:
      return 'fail';
    default:
      return 'claim';
  }
}

/**
 * stage 推導（純函式）。優先序：
 * 1. view-model 說在送出中 → `'submitting'`（畫面不得比 view-model 樂觀）。
 * 2. 正在顯示 alert → 該 alert 階段（alert 疊在底卡之上）。
 * 3. 使用者明示回填單 → `'claim'`（覆蓋殘留舊結果）。
 * 4. 其餘一律由 view-model 的 `resultState` 決定。
 */
export function winClaimStage(
  phase: WinClaimPhase,
  submitInFlight: boolean,
  result: AwardClaimResultState | null,
): WinClaimStage {
  if (submitInFlight) return 'submitting';
  if (phase === 'confirmSubmit') return 'confirmSubmit';
  if (phase === 'editing') return 'claim';
  return winClaimResultStage(result);
}

/**
 * `done`（discount）要顯示的折扣碼（純函式）：優先用領獎結果帶回的 `awardCode`（權威），
 * 缺值 / 非 discount 結果時退回 award 自帶的 `code`。
 */
export function winClaimDiscountCode(
  result: AwardClaimResultState | null,
  winner: LBWinner,
): string {
  if (
    result != null &&
    result.outcome === AwardClaimOutcome.SuccessDiscount &&
    (result.awardCode ?? '').length > 0
  ) {
    return result.awardCode as string;
  }
  return winner.award.code;
}

/**
 * `KeyboardAvoidingView` 的 `behavior`（純函式）—— iOS 走 `'padding'`（置中卡被壓縮的可用高度
 * 重新置中）、其他平台走 `'height'`（Android 另需 host Activity `windowSoftInputMode=adjustResize`
 * 才完整生效，屬 host 責任）。抽成純函式是為了可單元測（對齊 iOS lead「鍵盤規則要是可測純函式」
 * 的取捨；RN 由原生元件代算位移，故不移植 iOS 的 `keyboardShift`）。
 */
export function keyboardAvoidBehavior(os: string): 'padding' | 'height' {
  return os === 'ios' ? 'padding' : 'height';
}

/**
 * 分頁滑動的判定純函式（design.md Decision 2；設計稿 `LBWinSheet` 的 `onSwipeEnd` 直接移植）：
 * 量測觸控起訖點的水平位移 `endX - startX`，向左（負值）超過 {@link SWIPE_THRESHOLD} 回傳
 * `pageIndex + 1`、向右（正值）超過閾值回傳 `pageIndex - 1`；未達閾值、`pageCount <= 1`、或算出
 * 的下一頁超出 `[0, pageCount)` 邊界時回傳 `null`（no-op）。純函式、不依賴實際渲染或計時器，
 * 使其可被單元測直接呼叫（見 spec「分頁」段落）。
 */
export function swipePageDelta(
  startX: number,
  endX: number,
  pageCount: number,
  pageIndex: number,
): number | null {
  if (pageCount <= 1) return null;
  const dx = endX - startX;
  if (Math.abs(dx) < SWIPE_THRESHOLD) return null;
  const next = dx < 0 ? pageIndex + 1 : pageIndex - 1;
  if (next < 0 || next >= pageCount) return null;
  return next;
}

// MARK: - Decorative design tokens (literal minimal hex)
//
// accent / text / background 來自解析後的 [ReferenceUITheme]。以下是自設計稿 `theme.surface.*`
// （light mode，`design/brands/livebuy/tokens.jsx`）逐字搬來的固定裝飾色，與 iOS / Android /
// Flutter 的 `WinClaim*` 靜態色 byte-for-byte 對齊，讓四端讀起來像同一家人。

/** `theme.surface.textDim`（次要 / 說明文字）。 */
const TEXT_DIM = '#6B6775';
/** `theme.surface.textFaint`（空欄位 placeholder）。 */
const TEXT_FAINT = '#B6B2BE';
/** `theme.surface.stroke`（hairline 邊框 / spinner 底環）。 */
const STROKE = '#ECEAF0';
/** `theme.surface.bgSunken`（下沉卡 / 輸入欄底色 — light mode）。 */
const BG_SUNKEN = '#F4F4F6';
/** 設計稿 `DANGER`（失敗徽章 / 錯誤提示列）。 */
const DANGER = '#EB6E5F';
/** modal scrim（`LBWinSheet` `rgba(0,0,0,0.6)`）。 */
const SCRIM = 'rgba(0,0,0,0.6)';
/** alert / submitting 疊層自己的 scrim（`rgba(0,0,0,0.28)`）。 */
const ALERT_SCRIM = 'rgba(0,0,0,0.28)';

/**
 * 分頁圓點未選中色 —— 設計稿 `LBWinSheet` 的 `S.border || '#D8DBE0'`：這份設計 token 集
 * 從未定義過 `surface.border`，實際渲染永遠落在這個字面 fallback 值，故直接移植字面值
 * （而非誤用本檔既有的 `STROKE`，那是不同的 `surface.stroke` token）。
 */
const PAGE_DOT_INACTIVE = '#D8DBE0';

/** confetti 顆數（v2：22 → 20）。 */
const CONFETTI_COUNT = 20;

/** 分頁滑動判定閾值（px，對齊設計稿 `LBWinSheet` 的 `Math.abs(dx) < 40`）。 */
const SWIPE_THRESHOLD = 40;

// MARK: - Fixed localized copy (static presentation strings — parity to iOS/Android)
//
// 本層全層寫死中文常數，**不使用**任何 i18n API（與 `TEXT_DIM` 等 design-literal 同慣例）。

const CONGRATS_TITLE = '恭喜中獎';
const AWARD_NAME_FALLBACK = '直播間限定獎品';
const EMAIL_PLACEHOLDER = '電子郵件';
const CTA_SUBMIT = '確認領獎';
const FOOTER_TERMS = '使用條款';
const FOOTER_SEPARATOR = ' | ';
const FOOTER_PRIVACY = '隱私政策';

const SUBMIT_ALERT_TITLE = '確認領獎';
const SUBMIT_ALERT_BODY_PREFIX = '請確認 ';
const SUBMIT_ALERT_BODY_SUFFIX = ' 填寫正確，送出後將不可變更，確定要送出領獎資料嗎？';
const SUBMIT_ALERT_NOTE_DISCOUNT = '※結帳折扣碼將會寄送到您的信箱內。';
const SUBMIT_ALERT_NOTE_PRODUCT = '※獎品將自動加入為待結帳商品。';

const ALERT_CANCEL_LABEL = '取消';
const ALERT_CONFIRM_LABEL = '確定';

const SUBMITTING_LABEL = '送出中…';

const DONE_TITLE = '領獎完成';
const DONE_SUBLINE_DISCOUNT = '結帳折扣碼已寄送到以下電子郵件';
const DONE_SUBLINE_PRODUCT = '獎品已加入待結帳商品，結帳前完成訂購';
const COPY_LABEL = '複製';
const COPIED_LABEL = '已複製';
const PENDING_ITEM_CAPTION = '待結帳商品';

const FAIL_TITLE = '領獎失敗';
const FAIL_SUBLINE = '領獎過程發生錯誤，你的中獎資格仍保留，請稍後再試一次。';
/**
 * 🔴 通用文案 —— **MUST NOT** 換成 `CLAIM_TIMEOUT` 之類捏造的錯誤代碼，理由見 `failNoticeRow`
 * 的註解（R13 刻意分歧 2/2）。
 */
const FAIL_NOTICE = '若持續發生，請聯繫客服';
const RETRY_LABEL = '重新領獎';

// MARK: - Deterministic glyphs (Text glyphs — parity to iOS SF Symbols / Flutter Icons)

/** 禮物徽章 glyph（**恆為 gift**，MUST NOT 依 classification 路由）。 */
const GLYPH_GIFT = '\u{1F381}'; // 🎁 gift
/** email 輸入列的信封 glyph。 */
const GLYPH_MAIL = '✉';

// MARK: - Pure color / confetti helpers

/**
 * 把 `#RRGGBB` 朝白色提亮 `amount`（0…1），對應設計稿 `lbShade(hex, +amount)`
 * （`c' = (255 - c) * p + c`）。disabled CTA 底色用。畸形輸入原樣回傳。純函式。
 * （朝黑色壓暗的對偶在 `WinEntryView.darkened`，本檔不重複實作。）
 */
export function lightened(hex: string, amount: number): string {
  const body = hex.startsWith('#') ? hex.slice(1) : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(body)) return hex;
  const channel = (start: number): string => {
    const c = parseInt(body.slice(start, start + 2), 16);
    const v = Math.round((255 - c) * amount + c);
    return Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`.toUpperCase();
}

/**
 * 一顆 confetti 的決定式落點 —— 設計稿 `LBWinSheet` `CONFETTI` map 的直接移植
 * （20 顆、~160° 扇形、錨在徽章中心、上偏 16）。純函式 / 決定式 / 無亂數。
 * 調色盤 index 3 是解析後的 `accent`，其餘為 design-literal。
 */
export function winClaimConfetti(
  i: number,
  accent: string,
): { tx: number; ty: number; rotation: number; color: string; size: number } {
  const angDeg = -90 + ((i / 19) * 160 - 80);
  const ang = (angDeg * Math.PI) / 180;
  const dist = 34 + (i % 4) * 14;
  const cols = ['#F03246', '#0FC3B4', '#F39C12', accent, '#111111'];
  return {
    tx: Math.cos(ang) * dist,
    ty: Math.sin(ang) * dist - 16,
    rotation: (i * 47) % 360,
    color: cols[i % 5]!,
    size: 5 + (i % 3) * 2,
  };
}

// MARK: - Props

/** Props for the family-2 四階段領獎 modal（surface 3）。 */
export interface WinClaimSheetProps {
  /** The resolved reference-ui theme (FIRST, always). */
  readonly theme: ReferenceUITheme;
  /** The winner this modal claims for (`unclaimedWinners` earliest). Read-only. */
  readonly winner: LBWinner;
  /**
   * award 分流（`classifyAward(winner)`）。唯讀。
   *
   * ⚠️ 它 **不再**決定主 CTA 文案（v2 起 CTA 統一「確認領獎」），也**不**決定是否要收 email
   * （兩種 award type 都要同一個 email 欄位）；只影響 `confirmSubmit` 的提示文案與 `done`
   * 階段的內容分流。
   */
  readonly classification: AwardClaimClassification;
  /**
   * Latest mapped claim-result feedback (`awardClaimResultState`); `null` until a result
   * arrives（提交前態）。驅動 `done` / `fail` 階段。Read-only.
   */
  readonly resultState: AwardClaimResultState | null;
  /**
   * 送出中旗標（`DefaultPlayerTemplate.submitInFlight`）。驅動 `submitting` 階段。
   * **本層 MUST NOT 自造第二份 in-flight 真相** —— 只讀這一個。預設 `false`。
   */
  readonly submitInFlight?: boolean;
  /**
   * 領獎提交（帶使用者輸入的 email）。容器轉發 `model.submitClaim(winner, email)` →
   * `DefaultPlayerTemplate.submitAwardClaim(winner, email)` → core
   * `requestAwardClaim(winner, { email })`。demo / 結構快照為 undefined —— 本 view 在所有
   * callback 為 undefined 時仍正確渲染。
   */
  readonly onSubmit?: (email: string) => void;
  /**
   * 關閉（R27：任一 stage 點擊外層 scrim 皆直接觸發，無 ✕、無「關閉視窗」文字鈕、無二次確認
   * alert）。容器轉發 `dismissClaim()` 後清呈現綁定。
   */
  readonly onDismiss?: () => void;
  /**
   * `done`（discount）折扣碼「複製」—— 本層保留版面 + 本地「已複製」回饋，實際寫入剪貼簿
   * **委派 host**（RN 核心的 `Clipboard` 已 deprecated，外部剪貼簿套件違反本層零外部依賴原則；
   * 與 `onShareProduct` 委派 host 的既有慣例一致）。預設 no-op。
   */
  readonly onCopyCode?: (code: string) => void;
  /**
   * EMAIL-LESS 時代的提交 callback。
   *
   * @deprecated EMAIL-LESS 領獎已退役（缺 email 時 core fail-fast、**連 API 都不送**）。以此
   * prop 建構的 modal 仍會畫出 email 欄位，只是提交時把使用者輸入的 email **丟掉**後呼叫
   * `onClaim(winner)` —— 若 host 走的是 `submitAwardClaim(winner)`，領獎在未被攔截時依然
   * 必然失敗。請改用 `onSubmit: (email: string) => void`。形狀刻意維持不變以保源碼相容，
   * 將於下一個 major 移除（`docs/contract-governance.md` I6 / 情境 F）。
   */
  readonly onClaim?: (winner: LBWinner) => void;
  /**
   * Footer「使用條款」文字被點擊（rb-rn-win-claim-footer-links）。容器轉發到
   * `legalLinkRoute(LBLegalLinks.termsOfUse)` 的裁決結果（in-app browser / 系統 router /
   * 不可開安全 no-op）。本層只轉發「使用者點了哪一段」，MUST NOT 自行判定網域或呼叫任何開啟
   * API（單向資料流）。預設 `undefined` —— 點擊安全 inert（MUST NOT crash）。
   */
  readonly onOpenTermsOfUse?: () => void;
  /** Footer「隱私政策」文字被點擊。語意同 {@link onOpenTermsOfUse}，連結為
   *  `LBLegalLinks.privacyPolicy`。預設 `undefined` —— 點擊安全 inert。 */
  readonly onOpenPrivacyPolicy?: () => void;
  /**
   * 待領獎項總數（R27 分頁新增，對齊設計稿 `LBWinSheet` 同名 prop）。`> 1` 時 `claim` 卡底部
   * 畫分頁圓點、且卡片區域支援水平滑動切頁；`<= 1`（預設）時無分頁 UI、滑動手勢 no-op。
   */
  readonly pageCount?: number;
  /** 目前顯示的頁碼（0-based，對齊 `pageCount`）。預設 `0`。 */
  readonly pageIndex?: number;
  /**
   * 分頁切換 —— 點擊某顆分頁圓點、或水平滑動超過閾值時，以目標頁碼呼叫。容器
   * （`FeedWinView.handlePageClaim`）負責把目標頁碼換算成對應的 `LBWinner` 並重新綁定。
   * `undefined`（demo / 結構快照 / `pageCount <= 1`）時分頁互動安全 inert。
   */
  readonly onPage?: (index: number) => void;
}

/**
 * The family-2 四階段領獎 modal（一次一個 {@link LBWinner}）。畫恭喜中獎 + 獎品名 + email
 * 輸入欄，經確認 alert 後以 `onSubmit(email)` 提交，並依 view-model 的 `submitInFlight` /
 * `resultState` 呈現送出中 / 領獎完成 / 領獎失敗。
 */
export function WinClaimSheet(props: WinClaimSheetProps): ReactElement {
  const {
    theme,
    winner,
    classification,
    resultState,
    submitInFlight = false,
    onSubmit,
    onDismiss,
    onCopyCode,
    onClaim,
    onOpenTermsOfUse,
    onOpenPrivacyPolicy,
    pageCount = 1,
    pageIndex = 0,
    onPage,
  } = props;

  // -- 本層 UI local state（不是 view-model）---------------------------------
  //
  // MUST NOT 出現 local `isSubmitting` 或第二份 result —— 那會在 template guard 擋下
  // （re-entrancy / invalid email）時卡住畫面，也會在 host 攔截時與 view-model 分歧。

  /** 使用者正在輸入的 email。view-model 不保存正在打的字（避免 keystroke 汙染 view-model）。 */
  const [email, setEmail] = useState('');
  /** 使用者互動意圖（見 {@link WinClaimPhase}）。 */
  const [phase, setPhase] = useState<WinClaimPhase>('idle');
  /** 折扣碼「複製」後的短暫回饋（純視覺）。 */
  const [copied, setCopied] = useState(false);
  /** 觸控起點 pageX（分頁滑動手勢，design.md Decision 2）——不是 view-model 狀態，純手勢暫存。 */
  const touchStartXRef = useRef<number | null>(null);

  // -- Derived presentation (pure) --------------------------------------------

  const stage = winClaimStage(phase, submitInFlight, resultState);
  const isDiscount = classification === AwardClaimClassification.Discount;
  /**
   * 主 CTA 是否可按 —— **一律**呼叫 view-model 的純函式 `isValidClaimEmail`，本層不自寫
   * 第二份規則，這樣「畫面說可以送」與「view-model 願意送」永遠同一條判定。
   */
  const emailValid = isValidClaimEmail(email);
  const awardName = winner.award.name.length === 0 ? AWARD_NAME_FALLBACK : winner.award.name;
  const isAlert = stage === 'confirmSubmit';
  /** 底卡是否應被壓暗且不可互動（alert 或送出中）。 */
  const isBusy = isAlert || stage === 'submitting';
  const trimmedEmail = email.trim();

  // 內部只保留 ONE submit channel：DEPRECATED 的 `onClaim` 包成忽略 email 的新 closure
  // （鏡像 iOS 的 deprecated init overload）。
  const submitChannel: ((value: string) => void) | undefined =
    onSubmit ?? (onClaim != null ? (): void => onClaim(winner) : undefined);

  /** alert 的「確定」。 */
  const handleAlertConfirm = (): void => {
    // 回到 `'idle'` 後才提交：這樣新一輪的 `submitInFlight` / `resultState` 能直接驅動
    // submitting → done / fail，不被殘留的互動意圖擋住。
    setPhase('idle');
    submitChannel?.(email);
  };

  /**
   * 🔴 **關閉領獎畫面 ＝ 純 dismiss（不變式，行為未變，只是觸發方式簡化）。**
   *
   * R27 之前，這個路徑要先經過 `confirmClose` 的強勸阻確認 alert（「您將放棄【獎品】的中獎
   * 資格，此動作無法復原」／「※確認送出後，將視同為放棄領獎。」）；R27 把那層文案 / UI 摩擦
   * 整段退役，改為外層 scrim 點擊**無條件**直接呼叫這個函式。**行為本身沒有變**：
   *   • MUST NOT 從 `unclaimedWinners` 移除該 winner
   *   • MUST NOT 呼叫任何 API
   *   • MUST NOT 遞減未領數量徽章（中獎入口紅點保留、可再次開啟領取）
   *
   * 權威仍是 `design/contract/claude-design-sync.md` **R13「刻意分歧（1/2）」**：R13 用強文案
   * 製造 UX 摩擦來降低隨手關閉機率，但從未真的剝奪資格；R27 拿掉的只是那層文案 / 確認 UI，
   * 不變式本身沒有被推翻——關閉從來就只是 dismiss，現在只是不再假裝有風險。
   *
   * 實作上只呼叫 `onDismiss` —— 容器接的是 `FeedWinModel.dismissClaim()` →
   * `DefaultPlayerTemplate.dismissClaim()`（只清 `awardClaimResultState` + `submitInFlight`）
   * + 清掉自己的 `openClaimWinner` 呈現綁定。
   */
  const handleDismissConfirmed = (): void => {
    onDismiss?.();
  };

  const handleCopy = (): void => {
    setCopied(true);
    onCopyCode?.(winClaimDiscountCode(resultState, winner));
  };

  /** 分頁滑動 —— 觸控起點（design.md Decision 2）。 */
  const handleTouchStart = (e: GestureResponderEvent): void => {
    touchStartXRef.current = e.nativeEvent.pageX;
  };

  /** 分頁滑動 —— 觸控終點：算出下一頁（{@link swipePageDelta}）後轉發 `onPage`。 */
  const handleTouchEnd = (e: GestureResponderEvent): void => {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX == null) return;
    const next = swipePageDelta(startX, e.nativeEvent.pageX, pageCount, pageIndex);
    if (next != null) onPage?.(next);
  };

  // -- 版型 --------------------------------------------------------------------
  //
  // 置中 modal 卡（非底部 sheet）：全幅容器內畫暗 scrim + 置中卡（寬 84%、上限 320）。
  // 卡上 MUST NOT 有「中獎通知」標題列 / grab handle / 任何明確的關閉按鈕（R27 起唯一關閉
  // 路徑是外層 scrim）。

  return (
    <View style={{ flex: 1 }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* 外層 scrim —— R27 起無條件 dismiss：任一 stage 點擊都直接關閉（見
          `handleDismissConfirmed` 的說明）。`confirmSubmit` 顯示中時，這層會被 `AlertLayer`
          自己的全幅疊層蓋住，實際接到的是 alert 自己的 scrim（僅收起 alert），不會落到這裡。 */}
      <Pressable
        accessibilityRole="button"
        testID={LBTestIDs.winClaimScrim}
        onPress={handleDismissConfirmed}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: SCRIM,
        }}
      />

      {/* 鍵盤避讓 —— RN 原生手段（**非**捲動容器；本層禁用 ScrollView / FlatList）。
          Android 另需 host Activity `windowSoftInputMode=adjustResize` 才完整生效（host 責任）。 */}
      <KeyboardAvoidingView
        behavior={keyboardAvoidBehavior(Platform.OS)}
        pointerEvents="box-none"
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        {/* 底卡外殼：外層不 clip（讓徽章浮出卡頂外），內層才 clip。 */}
        <View
          pointerEvents={isBusy ? 'none' : 'auto'}
          style={{ width: '84%', maxWidth: 320, opacity: isBusy ? 0.55 : 1 }}
        >
          <View
            testID={LBTestIDs.winClaimSheet}
            style={{
              backgroundColor: theme.background,
              borderRadius: 20,
              overflow: 'hidden',
              paddingTop: stage === 'claim' ? 46 : 48,
              paddingHorizontal: 22,
              paddingBottom: 22,
            }}
          >
            {stage === 'done' ? (
              <DoneCardBody
                theme={theme}
                isDiscount={isDiscount}
                email={trimmedEmail}
                code={winClaimDiscountCode(resultState, winner)}
                awardName={awardName}
                copied={copied}
                onCopy={handleCopy}
                onOpenTermsOfUse={onOpenTermsOfUse}
                onOpenPrivacyPolicy={onOpenPrivacyPolicy}
              />
            ) : stage === 'fail' ? (
              <FailCardBody
                theme={theme}
                onRetry={(): void => setPhase('confirmSubmit')}
                onOpenTermsOfUse={onOpenTermsOfUse}
                onOpenPrivacyPolicy={onOpenPrivacyPolicy}
              />
            ) : (
              <ClaimCardBody
                theme={theme}
                awardName={awardName}
                email={email}
                emailValid={emailValid}
                onChangeEmail={setEmail}
                onSubmitPress={(): void => setPhase('confirmSubmit')}
                pageCount={pageCount}
                pageIndex={pageIndex}
                onPage={onPage}
                onOpenTermsOfUse={onOpenTermsOfUse}
                onOpenPrivacyPolicy={onOpenPrivacyPolicy}
              />
            )}
          </View>

          {/* 徽章 + confetti —— 浮在卡頂外（設計稿 `top:-30`），故放在**不被 clip** 的外層。 */}
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: -30, left: 0, right: 0, alignItems: 'center' }}
          >
            {stage === 'fail' ? (
              <FailBadge theme={theme} />
            ) : (
              <GiftBadge theme={theme} />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* ② confirmSubmit alert 疊層（R27 起 `confirmClose` 已退役，這裡只服務送出確認）。 */}
      {isAlert ? (
        <AlertLayer
          theme={theme}
          isDiscount={isDiscount}
          email={trimmedEmail}
          onCancel={(): void => setPhase('editing')}
          onConfirm={handleAlertConfirm}
        />
      ) : null}

      {/* ③ submitting 疊層（由 view-model `submitInFlight` 驅動） */}
      {stage === 'submitting' ? <SubmittingLayer theme={theme} /> : null}
    </View>
  );
}

// MARK: - ① claim 卡（恭喜中獎 + award.name + email 欄 + CTA + footer）

function ClaimCardBody(props: {
  theme: ReferenceUITheme;
  awardName: string;
  email: string;
  emailValid: boolean;
  onChangeEmail: (value: string) => void;
  onSubmitPress: () => void;
  pageCount: number;
  pageIndex: number;
  onPage?: (index: number) => void;
  onOpenTermsOfUse?: () => void;
  onOpenPrivacyPolicy?: () => void;
}): ReactElement {
  const {
    theme,
    awardName,
    email,
    emailValid,
    onChangeEmail,
    onSubmitPress,
    pageCount,
    pageIndex,
    onPage,
    onOpenTermsOfUse,
    onOpenPrivacyPolicy,
  } = props;
  return (
    <View>
      {/* 恭喜中獎標題 + **副標＝`award.name`**（v2 起不再是固定文案）。 */}
      <View style={{ alignItems: 'center' }}>
        <Text
          style={{
            color: theme.text,
            fontSize: 22 * theme.fontScale,
            fontWeight: '900',
            textAlign: 'center',
          }}
        >
          {CONGRATS_TITLE}
        </Text>
        <Text
          style={{
            marginTop: 6,
            color: TEXT_DIM,
            fontSize: 14.5 * theme.fontScale,
            fontWeight: '500',
            textAlign: 'center',
          }}
        >
          {awardName}
        </Text>
      </View>

      {/* ✉ email 輸入列（mail glyph + TextInput），sunken 底 + hairline 邊框。 */}
      <View
        style={{
          marginTop: 14,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingVertical: 13,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: STROKE,
          backgroundColor: BG_SUNKEN,
        }}
      >
        <Text style={{ color: TEXT_DIM, fontSize: 16 }}>{GLYPH_MAIL}</Text>
        <TextInput
          testID={LBTestIDs.winClaimEmailField}
          value={email}
          onChangeText={onChangeEmail}
          placeholder={EMAIL_PLACEHOLDER}
          placeholderTextColor={TEXT_FAINT}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            flex: 1,
            marginLeft: 9,
            padding: 0,
            color: theme.text,
            fontSize: 14.5 * theme.fontScale,
          }}
        />
      </View>

      {/* 主 CTA「確認領獎」（email 不合格 → disabled 灰底）。R27 起「關閉視窗」文字鈕已退役
          （唯一關閉路徑是外層 scrim，見 `WinClaimSheet` 的 `handleDismissConfirmed`）。 */}
      <View style={{ marginTop: 14 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !emailValid }}
          testID={LBTestIDs.winClaimPrimary}
          disabled={!emailValid}
          onPress={emailValid ? onSubmitPress : undefined}
          style={{
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: 'center',
            backgroundColor: emailValid ? theme.accent : lightened(theme.accent, 0.35),
            opacity: emailValid ? 1 : 0.6,
          }}
        >
          <Text
            style={{ color: '#FFFFFF', fontSize: 15.5 * theme.fontScale, fontWeight: '900' }}
          >
            {CTA_SUBMIT}
          </Text>
        </Pressable>
      </View>

      {/* 分頁圓點（R27 新增，design.md Decision 5 —— 只在 claim 卡畫，done / fail 卡不畫）。
          `pageCount <= 1` 時完全不畫（設計稿 `pageCount > 1 && (...)`）。每顆圓點直接以自己的
          索引呼叫 `onPage`（鏡像設計稿 dot `onClick`），水平滑動手勢見 `WinClaimSheet` 的
          `handleTouchStart` 與 `handleTouchEnd`（{@link swipePageDelta}）。 */}
      {pageCount > 1 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
          {Array.from({ length: pageCount }, (_unused, i) => (
            <Pressable
              key={`win-claim-page-dot-${i}`}
              accessibilityRole="button"
              onPress={(): void => onPage?.(i)}
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                backgroundColor: i === pageIndex ? theme.accent : PAGE_DOT_INACTIVE,
              }}
            />
          ))}
        </View>
      ) : null}

      <FooterRow
        theme={theme}
        onOpenTermsOfUse={onOpenTermsOfUse}
        onOpenPrivacyPolicy={onOpenPrivacyPolicy}
      />
    </View>
  );
}

// MARK: - ② confirmSubmit alert 疊層（R27 起 `confirmClose` 分支已刪除）

function AlertLayer(props: {
  theme: ReferenceUITheme;
  isDiscount: boolean;
  email: string;
  onCancel: () => void;
  onConfirm: () => void;
}): ReactElement {
  const { theme, isDiscount, email, onCancel, onConfirm } = props;
  const title = SUBMIT_ALERT_TITLE;
  const body = `${SUBMIT_ALERT_BODY_PREFIX}${email}${SUBMIT_ALERT_BODY_SUFFIX}`;
  const note = isDiscount ? SUBMIT_ALERT_NOTE_DISCOUNT : SUBMIT_ALERT_NOTE_PRODUCT;
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* alert 自己的 scrim：只收起 alert（回可編輯的 claim 版面），MUST NOT 關整個 modal。 */}
      <Pressable
        accessibilityRole="button"
        testID={LBTestIDs.winClaimAlertScrim}
        onPress={onCancel}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: ALERT_SCRIM,
        }}
      />
      <View
        testID={LBTestIDs.winClaimAlert}
        style={{
          width: '84%',
          maxWidth: 320,
          backgroundColor: theme.background,
          borderRadius: 18,
          paddingTop: 24,
          paddingHorizontal: 22,
          paddingBottom: 20,
        }}
      >
        <Text
          style={{ color: theme.text, fontSize: 20 * theme.fontScale, fontWeight: '900' }}
        >
          {title}
        </Text>
        <Text
          style={{
            marginTop: 14,
            color: TEXT_DIM,
            fontSize: 14 * theme.fontScale,
            lineHeight: 23 * theme.fontScale,
          }}
        >
          {body}
        </Text>
        <Text
          style={{
            marginTop: 12,
            color: theme.accent,
            fontSize: 14 * theme.fontScale,
            fontWeight: '600',
            lineHeight: 22 * theme.fontScale,
          }}
        >
          {note}
        </Text>
        <View style={{ marginTop: 16, flexDirection: 'row' }}>
          <Pressable
            accessibilityRole="button"
            testID={LBTestIDs.winClaimAlertCancel}
            onPress={onCancel}
            style={{
              flex: 1,
              paddingVertical: 13,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: theme.accent,
              alignItems: 'center',
            }}
          >
            <Text
              style={{ color: theme.accent, fontSize: 15 * theme.fontScale, fontWeight: '900' }}
            >
              {ALERT_CANCEL_LABEL}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            testID={LBTestIDs.winClaimAlertConfirm}
            onPress={onConfirm}
            style={{
              flex: 1,
              marginLeft: 12,
              paddingVertical: 13,
              borderRadius: 12,
              backgroundColor: theme.accent,
              alignItems: 'center',
            }}
          >
            <Text
              style={{ color: '#FFFFFF', fontSize: 15 * theme.fontScale, fontWeight: '900' }}
            >
              {ALERT_CONFIRM_LABEL}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// MARK: - ③ submitting 疊層（scrim + 44 spinner 環 +「送出中…」）
//
// 靜態 3/4 弧（`borderTopColor` = accent，其餘 = STROKE 底環）—— 本層無動畫（結構快照
// determinism），與 iOS 的旋轉 spinner 視覺同構。

function SubmittingLayer(props: { theme: ReferenceUITheme }): ReactElement {
  const { theme } = props;
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: ALERT_SCRIM,
        }}
      />
      <View
        testID={LBTestIDs.winClaimSubmitting}
        style={{
          alignItems: 'center',
          paddingHorizontal: 30,
          paddingVertical: 26,
          borderRadius: 18,
          backgroundColor: theme.background,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            borderWidth: 3,
            borderColor: STROKE,
            borderTopColor: theme.accent,
          }}
        />
        <Text
          style={{
            marginTop: 14,
            color: theme.text,
            fontSize: 15 * theme.fontScale,
            fontWeight: 'bold',
          }}
        >
          {SUBMITTING_LABEL}
        </Text>
      </View>
    </View>
  );
}

// MARK: - ④ done 卡（領獎完成）

function DoneCardBody(props: {
  theme: ReferenceUITheme;
  isDiscount: boolean;
  email: string;
  code: string;
  awardName: string;
  copied: boolean;
  onCopy: () => void;
  onOpenTermsOfUse?: () => void;
  onOpenPrivacyPolicy?: () => void;
}): ReactElement {
  const {
    theme,
    isDiscount,
    email,
    code,
    awardName,
    copied,
    onCopy,
    onOpenTermsOfUse,
    onOpenPrivacyPolicy,
  } = props;
  return (
    <View>
      <View style={{ alignItems: 'center' }}>
        <Text
          style={{
            color: theme.text,
            fontSize: 22 * theme.fontScale,
            fontWeight: '900',
            textAlign: 'center',
          }}
        >
          {DONE_TITLE}
        </Text>
        <Text
          style={{
            marginTop: 8,
            color: TEXT_DIM,
            fontSize: 14 * theme.fontScale,
            fontWeight: '500',
            lineHeight: 21 * theme.fontScale,
            textAlign: 'center',
          }}
        >
          {isDiscount ? DONE_SUBLINE_DISCOUNT : DONE_SUBLINE_PRODUCT}
        </Text>
        {isDiscount ? (
          <Text
            style={{
              marginTop: 8,
              color: theme.accent,
              fontSize: 16 * theme.fontScale,
              fontWeight: 'bold',
            }}
            numberOfLines={1}
          >
            {email}
          </Text>
        ) : null}
      </View>

      {isDiscount ? (
        /* 折扣碼 + 複製鈕。 */
        <View
          testID={LBTestIDs.winClaimResultBanner}
          style={{
            marginTop: 16,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: STROKE,
            backgroundColor: BG_SUNKEN,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              color: theme.text,
              fontSize: 16 * theme.fontScale,
              fontWeight: 'bold',
              fontFamily: 'monospace',
              letterSpacing: 1,
            }}
          >
            {code}
          </Text>
          <Pressable
            accessibilityRole="button"
            testID={LBTestIDs.winClaimCopyCode}
            onPress={onCopy}
          >
            <Text
              style={{
                color: theme.accent,
                fontSize: 14.5 * theme.fontScale,
                fontWeight: '900',
              }}
            >
              {copied ? COPIED_LABEL : COPY_LABEL}
            </Text>
          </Pressable>
        </View>
      ) : (
        /* 待結帳商品卡（product 類獎品）。 */
        <View
          testID={LBTestIDs.winClaimResultBanner}
          style={{
            marginTop: 16,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: STROKE,
            backgroundColor: BG_SUNKEN,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              // 10% accent tint 讓全色 glyph 讀得出來（parity 到 iOS / Android / Flutter）。
              backgroundColor: theme.accent + '1A',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: theme.accent, fontSize: 18 }}>{GLYPH_GIFT}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text
              style={{ color: TEXT_DIM, fontSize: 11 * theme.fontScale, fontWeight: '600' }}
            >
              {PENDING_ITEM_CAPTION}
            </Text>
            <Text
              style={{
                marginTop: 2,
                color: theme.text,
                fontSize: 14 * theme.fontScale,
                fontWeight: 'bold',
              }}
            >
              {awardName}
            </Text>
          </View>
        </View>
      )}

      <FooterRow
        theme={theme}
        onOpenTermsOfUse={onOpenTermsOfUse}
        onOpenPrivacyPolicy={onOpenPrivacyPolicy}
      />
    </View>
  );
}

// MARK: - ⑤ fail 卡（領獎失敗）

function FailCardBody(props: {
  theme: ReferenceUITheme;
  onRetry: () => void;
  onOpenTermsOfUse?: () => void;
  onOpenPrivacyPolicy?: () => void;
}): ReactElement {
  const { theme, onRetry, onOpenTermsOfUse, onOpenPrivacyPolicy } = props;
  return (
    <View>
      <View style={{ alignItems: 'center' }}>
        <Text
          style={{
            color: theme.text,
            fontSize: 22 * theme.fontScale,
            fontWeight: '900',
            textAlign: 'center',
          }}
        >
          {FAIL_TITLE}
        </Text>
        <Text
          style={{
            marginTop: 8,
            color: TEXT_DIM,
            fontSize: 14 * theme.fontScale,
            fontWeight: '500',
            lineHeight: 22 * theme.fontScale,
            textAlign: 'center',
          }}
        >
          {FAIL_SUBLINE}
        </Text>
      </View>

      {/*
        🔴 **錯誤提示列：版面保留、文案通用、MUST NOT 顯示捏造的錯誤代碼。**

        設計稿這一列寫的是「錯誤代碼 CLAIM_TIMEOUT · 若持續發生請聯繫客服」，但那個代碼與稿內
        `jasper@livebuy.tv` / `1L9zOdX` 同性質 ＝ **demo 佔位值**。後端**刻意不區分**領獎失敗
        原因（已領過 / 活動結束 / 票券無效 / email 被拒，全部 `500 api.fail`，anti-enumeration），
        SDK 拿不到任何有意義的錯誤碼，硬填就是騙人。因此版面照留（danger 底色 + 自繪警示 glyph），
        文案固定為通用值。權威：`design/contract/claude-design-sync.md` **R13「刻意分歧（2/2）」**。
        待後端真的細分錯誤碼再回來接，屆時才可顯示真實代碼。
      */}
      <View
        testID={LBTestIDs.winClaimFailNotice}
        style={{
          marginTop: 16,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 12,
          borderWidth: 1,
          // danger 10% tint 底 + 30% 描邊，讓全色 danger glyph 讀得出來。
          backgroundColor: DANGER + '1A',
          borderColor: DANGER + '4D',
        }}
      >
        <WarningGlyph color={DANGER} size={16} />
        <Text
          style={{
            flex: 1,
            marginLeft: 10,
            color: DANGER,
            fontSize: 12.5 * theme.fontScale,
            fontWeight: '600',
          }}
        >
          {FAIL_NOTICE}
        </Text>
      </View>

      {/* 「重新領獎」（回 confirmSubmit，**沿用原本輸入的 email**）。R27 起「關閉視窗」文字鈕
          已退役——這張卡的唯一關閉路徑跟其他卡一致，是外層 scrim（見 `WinClaimSheet`）。 */}
      <View style={{ marginTop: 16 }}>
        <Pressable
          accessibilityRole="button"
          testID={LBTestIDs.winClaimPrimary}
          onPress={onRetry}
          style={{
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: 'center',
            backgroundColor: theme.accent,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 15.5 * theme.fontScale, fontWeight: '900' }}>
            {RETRY_LABEL}
          </Text>
        </Pressable>
      </View>

      <FooterRow
        theme={theme}
        onOpenTermsOfUse={onOpenTermsOfUse}
        onOpenPrivacyPolicy={onOpenPrivacyPolicy}
      />
    </View>
  );
}

// MARK: - 徽章（60，浮出卡頂外，4 卡背景色描邊）

/**
 * 禮物徽章 —— glyph **恆為 gift**，MUST NOT 依 `classification` 路由（對齊設計稿
 * `LBWinSheet` 的 `giftSvg` 與 iOS / Android / Flutter）。confetti 疊在它後面。
 * RN 無 gradient（本層零外部依賴）→ 徽章為 solid `theme.accent` + 白 glyph。
 */
function GiftBadge(props: { theme: ReferenceUITheme }): ReactElement {
  const { theme } = props;
  return (
    <View style={{ width: 60, height: 60, alignItems: 'center', justifyContent: 'center' }}>
      {/* Confetti —— 20 顆決定式扇形方塊，錨在徽章中心（設計稿 CONFETTI 的直接移植）。 */}
      {Array.from({ length: CONFETTI_COUNT }, (_unused, i) => {
        const p = winClaimConfetti(i, theme.accent);
        return (
          <View
            key={`confetti-${i}`}
            style={{
              position: 'absolute',
              left: 30 + p.tx - p.size / 2,
              top: 30 + p.ty - p.size / 2,
              width: p.size,
              height: p.size,
              borderRadius: 1.5,
              backgroundColor: p.color,
              transform: [{ rotate: `${p.rotation}deg` }],
            }}
          />
        );
      })}
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: 30,
          borderWidth: 4,
          borderColor: theme.background,
          backgroundColor: theme.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 26 }}>{GLYPH_GIFT}</Text>
      </View>
    </View>
  );
}

/** 失敗徽章（danger 實心，無 confetti）。 */
function FailBadge(props: { theme: ReferenceUITheme }): ReactElement {
  const { theme } = props;
  return (
    <View
      style={{
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 4,
        borderColor: theme.background,
        backgroundColor: DANGER,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <WarningGlyph color="#FFFFFF" size={30} />
    </View>
  );
}

// MARK: - Footer（使用條款 | 隱私政策 — 各自可點擊，接容器 LBURLOpenPolicy 分流）
//
// rb-rn-win-claim-footer-links：R13 決策 4 的留白已收尾——連結來源已由 core `LBLegalLinks`
// 決定，開啟策略已由 core `LBURLOpenPolicy` 決定。兩段文字各自包一層 `Pressable`（沿用本檔
// 既有「可點內容一律用 `Pressable` 包 `Text`」慣例，如 `winClaimCopyCode`），`onPress` 分別
// 轉發到 `onOpenTermsOfUse` / `onOpenPrivacyPolicy`——本層只轉發「使用者點了哪一段」，MUST NOT
// 自行判定網域或呼叫任何開啟 API（單向資料流，容器 `FeedWinView.openLegalLink` 才是實際動作）。
// 分隔符 `FOOTER_SEPARATOR` 維持純 `Text`，不可點擊。兩個 callback 皆為 `undefined` 時點擊安全
// inert（`Pressable.onPress` 呼叫 `undefined?.()` 不 crash）。

function FooterRow(props: {
  theme: ReferenceUITheme;
  onOpenTermsOfUse?: () => void;
  onOpenPrivacyPolicy?: () => void;
}): ReactElement {
  const { theme, onOpenTermsOfUse, onOpenPrivacyPolicy } = props;
  return (
    <View
      testID={LBTestIDs.winClaimFooter}
      style={{ marginTop: 14, flexDirection: 'row', justifyContent: 'center' }}
    >
      <Pressable
        accessibilityRole="button"
        testID={LBTestIDs.winClaimFooterTerms}
        onPress={(): void => onOpenTermsOfUse?.()}
      >
        <Text
          style={{ color: TEXT_DIM, fontSize: 12.5 * theme.fontScale, fontWeight: '500' }}
        >
          {FOOTER_TERMS}
        </Text>
      </Pressable>
      <Text
        style={{
          color: TEXT_DIM,
          fontSize: 12.5 * theme.fontScale,
          fontWeight: '500',
          opacity: 0.5,
        }}
      >
        {FOOTER_SEPARATOR}
      </Text>
      <Pressable
        accessibilityRole="button"
        testID={LBTestIDs.winClaimFooterPrivacy}
        onPress={(): void => onOpenPrivacyPolicy?.()}
      >
        <Text
          style={{ color: TEXT_DIM, fontSize: 12.5 * theme.fontScale, fontWeight: '500' }}
        >
          {FOOTER_PRIVACY}
        </Text>
      </Pressable>
    </View>
  );
}
