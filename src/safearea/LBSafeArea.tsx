// LBSafeArea — reference-ui 的 edge-to-edge 系統邊距（rb-rn-edge-to-edge-safe-area）。
//
// RN 對照 Android `safearea/LBSafeArea.kt`（rb-android-edge-to-edge-window-insets）與 iOS SwiftUI
// 「內容待在 safe area 內、背景 `ignoresSafeArea()`」的模型：Tier B 容器在視窗內容延伸到狀態列、
// 導覽／手勢列與 cutout（瀏海／動態島／home indicator）後方時，自己讓 chrome 避開這些區域，影片、
// 背景與 scrim 維持滿版。
//
// 分工：
//   - Tier B 容器根節點呼叫 {@link useLBSafeAreaBoundary} 量出「這個容器實際還需要自己避開多少」，
//     再用 {@link LBSafeAreaScope} 放進 context。boundary 本身不套任何邊距，所以影片與背景滿版。
//   - Tier A 表面的 chrome 圖層以 {@link useLBSafeAreaInsets} / {@link useLBImeBottomInset} 讀值，
//     加到自己的定位量上；滿版背景／scrim／手勢層不讀。
//   - context 預設值是零。沒有 Tier B 容器的地方（host 直接組 Tier A、結構 snapshot 測試）以及
//     沒有任何 inset 來源的 host，讀到的都是零；本檔的 style helper 在零值時回傳空物件——輸出與
//     本機制落地前完全相同。節點結構不隨 inset 值改變（不會因為 inset 由零變非零而重新掛載子樹）。
//
// inset 來源（依序取第一個存在的）：
//   1. 容器 config 的 `safeAreaInsets`：host 直接指定「這個容器的 chrome 要內縮多少」，以容器自己
//      的四邊為基準，原樣採用、不做位置修正。傳零值即「host 已自行處理，SDK 不要再加」。
//   2. {@link LivebuySafeAreaInsetsProvider}：host 在任意上層注入「視窗的系統 inset」。
//   3. host 已安裝的 `react-native-safe-area-context`（optional peer dependency，見
//      `optionalSafeAreaContext.ts`）：自動讀它最近一層 provider 的 inset 與 frame。
//   4. 以上皆無 → 零。
//
// 不重複套用：RN 沒有 Compose 的 inset consumption，等效機制是**位置估計**——來源 2／3 給的是
// 「以視窗（provider frame）邊緣為基準」的 inset，容器實際要補的量是「容器外框與 inset 區域的
// 重疊量」（{@link overlapWithFrameInsets}）。host 已把容器往內推（`SafeAreaView`、padding、
// 導覽列、tab bar…）時重疊量遞減到零，不論 host 用哪種寫法。來源 1 則是明確的 opt-out。

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

import { loadOptionalSafeAreaContext, optionalSafeAreaContexts } from './optionalSafeAreaContext';

// ─────────────────────────────────────────────────────────────────────────────
// Pure data + functions
// ─────────────────────────────────────────────────────────────────────────────

/** 四個實體邊的邊距量（pt／dp）。RN 的 `left` / `right` 是實體邊，不隨 RTL 翻轉。 */
export interface LBSafeAreaInsets {
  readonly top: number;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
}

/** 一個矩形（原點＋尺寸），用來描述 inset 的基準框（視窗或 safe-area provider 的 frame）。 */
export interface LBSafeAreaFrame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** 容器外框在基準框所在座標系中的四邊位置。 */
export interface LBContainerPlacement {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** 鍵盤目前的高度與上緣位置（螢幕座標）。 */
export interface LBKeyboardMetrics {
  readonly height: number;
  readonly screenY: number;
}

/** 零邊距。context 的預設值，也是所有「沒有來源」路徑的結果。 */
export const LB_SAFE_AREA_ZERO: LBSafeAreaInsets = { top: 0, left: 0, right: 0, bottom: 0 };

function finiteNonNegative(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** PURE：四邊是否皆為零。 */
export function isZeroInsets(insets: LBSafeAreaInsets): boolean {
  return insets.top === 0 && insets.left === 0 && insets.right === 0 && insets.bottom === 0;
}

/**
 * PURE：把 host 給的（可能缺邊、可能含負值／NaN）邊距整理成四邊皆為有限非負數。
 * `null` / `undefined` → 零。
 */
export function normalizeInsets(insets: Partial<LBSafeAreaInsets> | null | undefined): LBSafeAreaInsets {
  if (insets == null) return LB_SAFE_AREA_ZERO;
  return {
    top: finiteNonNegative(insets.top),
    left: finiteNonNegative(insets.left),
    right: finiteNonNegative(insets.right),
    bottom: finiteNonNegative(insets.bottom),
  };
}

/**
 * PURE：`insets`（以 `frame` 邊緣為基準）與容器外框 `placement` 的**實際重疊量**。
 *
 * 容器貼齊 frame 邊緣 → 重疊量等於原始 inset；容器已被往內推（host 自己加了邊距、或容器根本不在
 * 邊緣）→ 重疊量遞減到零；永遠不會超過原始 inset，也不會是負值。`placement` 為 `null`（尚未完成
 * 第一次量測）或 frame 尺寸無效時無法判斷位置，原樣回傳 `insets`。
 */
export function overlapWithFrameInsets(
  insets: LBSafeAreaInsets,
  placement: LBContainerPlacement | null,
  frame: LBSafeAreaFrame | null,
): LBSafeAreaInsets {
  if (placement == null || frame == null || !(frame.width > 0) || !(frame.height > 0)) return insets;
  return {
    top: clamp(frame.y + insets.top - placement.top, 0, insets.top),
    left: clamp(frame.x + insets.left - placement.left, 0, insets.left),
    right: clamp(placement.right - (frame.x + frame.width - insets.right), 0, insets.right),
    bottom: clamp(placement.bottom - (frame.y + frame.height - insets.bottom), 0, insets.bottom),
  };
}

/** 已選定的 inset 來源。 */
export type LBSafeAreaSource =
  /** 容器 config 明確指定：以容器四邊為基準，原樣採用。 */
  | { readonly kind: 'explicit'; readonly insets: LBSafeAreaInsets }
  /** 視窗基準的 inset（host 注入或 safe-area-context）：需以容器位置修正。 */
  | { readonly kind: 'window'; readonly insets: LBSafeAreaInsets; readonly frame: LBSafeAreaFrame }
  /** 沒有任何來源。 */
  | { readonly kind: 'none' };

/** host 以 {@link LivebuySafeAreaInsetsProvider} 注入的值。 */
export interface LBInjectedSafeArea {
  readonly insets: LBSafeAreaInsets;
  readonly frame: LBSafeAreaFrame | null;
  /** host 遞增／改變它來要求其下容器重新量測位置。 */
  readonly remeasureKey?: string | number;
}

/**
 * PURE：依「容器 config → host 注入 → safe-area-context → 無」的順序選出 inset 來源。
 * `windowFrame` 是沒有其他 frame 可用時的後備（`Dimensions.get('window')`）。
 */
export function pickSafeAreaSource(args: {
  explicit: Partial<LBSafeAreaInsets> | null | undefined;
  injected: LBInjectedSafeArea | null;
  autoInsets: LBSafeAreaInsets | null;
  autoFrame: LBSafeAreaFrame | null;
  windowFrame: LBSafeAreaFrame;
}): LBSafeAreaSource {
  const { explicit, injected, autoInsets, autoFrame, windowFrame } = args;
  if (explicit != null) return { kind: 'explicit', insets: normalizeInsets(explicit) };
  if (injected != null) {
    return { kind: 'window', insets: injected.insets, frame: injected.frame ?? windowFrame };
  }
  if (autoInsets != null) {
    return { kind: 'window', insets: normalizeInsets(autoInsets), frame: autoFrame ?? windowFrame };
  }
  return { kind: 'none' };
}

/** PURE：來源 + 容器位置 → 這個容器實際要自己避開的量。 */
export function resolveSafeAreaInsets(
  source: LBSafeAreaSource,
  placement: LBContainerPlacement | null,
): LBSafeAreaInsets {
  if (source.kind === 'none') return LB_SAFE_AREA_ZERO;
  if (source.kind === 'explicit') return source.insets;
  return overlapWithFrameInsets(source.insets, placement, source.frame);
}

/**
 * PURE：鍵盤與容器底緣的重疊量。鍵盤未升起 → 零；容器位置未知 → 以鍵盤高度計；容器底緣已在鍵盤
 * 上方（視窗已為鍵盤縮小、或 host 已用 `KeyboardAvoidingView` 把容器頂上去）→ 零。永遠不超過鍵盤
 * 高度。
 */
export function imeBottomOverlap(
  keyboard: LBKeyboardMetrics | null,
  placement: LBContainerPlacement | null,
): number {
  if (keyboard == null || !(keyboard.height > 0)) return 0;
  if (placement == null) return keyboard.height;
  return clamp(placement.bottom - keyboard.screenY, 0, keyboard.height);
}

/**
 * PURE：chrome 圖層實際要套的邊距。鍵盤升起時底部取 `max(系統列, 鍵盤)`——兩者量的都是「距容器
 * 底緣」的同一段距離（鍵盤高度本來就涵蓋 home indicator／導覽列那一段），所以取大、不相加。
 * `top` 為 `false` 時不套頂部（給貼底的錨定元素用）。
 */
export function safeAreaPaddingFor(
  safeArea: LBSafeAreaInsets,
  imeBottom: number,
  top: boolean = true,
): LBSafeAreaInsets {
  return {
    top: top ? safeArea.top : 0,
    left: safeArea.left,
    right: safeArea.right,
    bottom: Math.max(safeArea.bottom, imeBottom),
  };
}

/**
 * PURE：把邊距寫成 `padding*` style。**只寫非零的邊**，四邊皆零時回傳空物件——展開進既有 style
 * 物件後與本機制落地前逐鍵相同。
 */
export function lbSafeAreaPaddingStyle(insets: LBSafeAreaInsets): {
  paddingTop?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingBottom?: number;
} {
  return {
    ...(insets.top > 0 ? { paddingTop: insets.top } : null),
    ...(insets.left > 0 ? { paddingLeft: insets.left } : null),
    ...(insets.right > 0 ? { paddingRight: insets.right } : null),
    ...(insets.bottom > 0 ? { paddingBottom: insets.bottom } : null),
  };
}

/**
 * PURE：把邊距寫成 `margin*` style（只寫非零的邊）。用在「置中卡片的父層另有絕對定位的滿版 scrim」
 * 的情形：把邊距掛在卡片自己身上，卡片就在 safe rect 內置中，scrim 不受影響。
 */
export function lbSafeAreaMarginStyle(insets: LBSafeAreaInsets): {
  marginTop?: number;
  marginLeft?: number;
  marginRight?: number;
  marginBottom?: number;
} {
  return {
    ...(insets.top > 0 ? { marginTop: insets.top } : null),
    ...(insets.left > 0 ? { marginLeft: insets.left } : null),
    ...(insets.right > 0 ? { marginRight: insets.right } : null),
    ...(insets.bottom > 0 ? { marginBottom: insets.bottom } : null),
  };
}

/**
 * PURE：浮窗卡片／浮動入口的拖曳容器——完整容器扣掉 safe-area 邊距，不為負。零邊距時原樣回傳
 * `fullSize`，既有的 `clampFloatingOffset` 看到的值與 safe-area 機制落地前相同。
 */
export function lbFloatingDragContainerSize(
  fullSize: { readonly width: number; readonly height: number },
  safeArea: LBSafeAreaInsets,
): { readonly width: number; readonly height: number } {
  if (isZeroInsets(safeArea)) return fullSize;
  return {
    width: Math.max(0, fullSize.width - safeArea.left - safeArea.right),
    height: Math.max(0, fullSize.height - safeArea.top - safeArea.bottom),
  };
}

/**
 * PURE：把浮窗卡片／浮動入口的靜止位置（`{ right | left, bottom }`，來自
 * `lbLiveEntryRestingInset`）往 safe rect 內推：靠哪一邊就加那一邊的邊距，底部加底部邊距。
 * 零邊距時原樣回傳同一個物件。
 */
export function lbFloatingRestingInsetInSafeArea<T extends { left?: number; right?: number; bottom: number }>(
  resting: T,
  safeArea: LBSafeAreaInsets,
): T {
  if (isZeroInsets(safeArea)) return resting;
  return {
    ...resting,
    ...(resting.left != null ? { left: resting.left + safeArea.left } : null),
    ...(resting.right != null ? { right: resting.right + safeArea.right } : null),
    bottom: resting.bottom + safeArea.bottom,
  };
}

/**
 * PURE：以百分比定位的 chrome（`top: '<fraction × 100>%'`）要改成「相對 safe rect 的同一比例」時，
 * 需要額外加上的位移量。容器高 H、上下 inset 為 T／B 時，safe rect 內的位置是
 * `T + fraction × (H − T − B)`，而 `top: 'p%'` 給的是 `fraction × H`，兩者相差
 * `(1 − fraction) × T − fraction × B`。以 `marginTop` 套用，節點結構不必改變。零 inset 回傳零。
 */
export function lbPercentTopOffsetInSafeArea(fraction: number, safeArea: LBSafeAreaInsets): number {
  return (1 - fraction) * safeArea.top - fraction * safeArea.bottom;
}

// ─────────────────────────────────────────────────────────────────────────────
// Contexts + read hooks (Tier A surfaces)
// ─────────────────────────────────────────────────────────────────────────────

const LBSafeAreaInsetsContext = createContext<LBSafeAreaInsets>(LB_SAFE_AREA_ZERO);
const LBImeBottomInsetContext = createContext<number>(0);
const LBInjectedSafeAreaContext = createContext<LBInjectedSafeArea | null>(null);

/**
 * chrome 圖層要避開的系統邊距（狀態列、導覽／手勢列、cutout）。沒有 Tier B 容器或沒有來源時為零。
 */
export function useLBSafeAreaInsets(): LBSafeAreaInsets {
  return useContext(LBSafeAreaInsetsContext);
}

/**
 * 鍵盤與容器底緣的重疊量。與 {@link useLBSafeAreaInsets} 分開，鍵盤升降時只重繪真的需要跟著鍵盤
 * 移動的表面（留言輸入列、設定暱稱 modal），不牽動整個 chrome。
 */
export function useLBImeBottomInset(): number {
  return useContext(LBImeBottomInsetContext);
}

/** 把已解析的邊距放進 context。只是兩層 context provider，不產生任何 host 節點。 */
export function LBSafeAreaScope(props: {
  readonly safeArea: LBSafeAreaInsets;
  readonly imeBottom: number;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <LBSafeAreaInsetsContext.Provider value={props.safeArea}>
      <LBImeBottomInsetContext.Provider value={props.imeBottom}>
        {props.children}
      </LBImeBottomInsetContext.Provider>
    </LBSafeAreaInsetsContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Host injection (public)
// ─────────────────────────────────────────────────────────────────────────────

/** Props for {@link LivebuySafeAreaInsetsProvider}. */
export interface LivebuySafeAreaInsetsProviderProps {
  /**
   * 視窗的系統 inset（狀態列、導覽／手勢列、cutout），以視窗邊緣為基準。缺的邊視為零。
   * 例：`useSafeAreaInsets()` 的回傳值，或 host 自己從原生取得的值。
   */
  readonly insets: Partial<LBSafeAreaInsets>;
  /**
   * `insets` 所依據的矩形。省略時以 `Dimensions.get('window')`（原點 0,0）為準；host 的根視圖
   * 不等於整個視窗時才需要傳。
   */
  readonly frame?: LBSafeAreaFrame;
  /**
   * 改變這個值會讓其下所有容器**重新量測自己的位置**。容器會在掛上、版面改變、視窗尺寸改變、鍵盤
   * 升降時自行量測，並在掛上後的一小段時間內補量幾次（涵蓋一般的進場轉場）；host 以更長的動畫或
   * 不改變容器版面的方式移動容器時，在移動結束後改變這個值即可。省略不影響其他行為。
   */
  readonly remeasureKey?: string | number;
  readonly children: ReactNode;
}

/**
 * 讓 host 把系統 inset 注入給其下所有 Livebuy Tier B 容器（`LivebuyPlayer` /
 * `CollapsibleLivebuyPlayer` / `LivebuyLiveEntry`，以及 `LivebuyWidget` 預設開啟的播放器）。
 * 不需要安裝任何額外套件。只是一層 context provider，不產生 host 節點、不改變版面。
 *
 * 各容器會依自己在 `frame` 中的實際位置只補「還沒被 host 處理」的那一段，所以 host 另外用
 * `SafeAreaView`／padding 包住容器時不會出現雙重邊距。優先序低於容器 config 的 `safeAreaInsets`，
 * 高於自動偵測到的 `react-native-safe-area-context`。
 */
export function LivebuySafeAreaInsetsProvider(props: LivebuySafeAreaInsetsProviderProps): ReactElement {
  const { insets, frame, remeasureKey, children } = props;
  const normalized = normalizeInsets(insets);
  const value = useMemo<LBInjectedSafeArea>(
    () => ({
      insets: { top: normalized.top, left: normalized.left, right: normalized.right, bottom: normalized.bottom },
      frame: frame ?? null,
      remeasureKey,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [normalized.top, normalized.left, normalized.right, normalized.bottom, frame?.x, frame?.y, frame?.width, frame?.height, remeasureKey],
  );
  return <LBInjectedSafeAreaContext.Provider value={value}>{children}</LBInjectedSafeAreaContext.Provider>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Boundary (Tier B containers)
// ─────────────────────────────────────────────────────────────────────────────

/** 量測用的 view 介面（`View` ref 的子集）。 */
interface MeasurableView {
  measure?: (
    callback: (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void,
  ) => void;
}

/** {@link useLBSafeAreaBoundary} 要掛到量測節點上的 props。不需要量測時是空物件。 */
export interface LBSafeAreaMeasureProps {
  ref?: (view: unknown) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  collapsable?: boolean;
}

/** {@link useLBSafeAreaBoundary} 的結果。 */
export interface LBSafeAreaBoundary {
  /** 這個容器的 chrome 要自己避開的系統邊距。 */
  readonly safeArea: LBSafeAreaInsets;
  /** 鍵盤與容器底緣的重疊量（`trackKeyboard` 為 `false` 時恆為零）。 */
  readonly imeBottom: number;
  /** 掛到「外框等於容器外框」的那個 view 上；不需要量測時為空物件（不增加任何 prop）。 */
  readonly measureProps: LBSafeAreaMeasureProps;
}

/**
 * 每次觸發量測後補量的時間點（毫秒）。涵蓋一般的進場轉場（原生與 JS stack 的 push／modal 轉場約
 * 250–500ms）並留餘裕；次數固定，量到的位置沒變就不會造成重繪。
 */
export const LB_SAFE_AREA_SETTLE_DELAYS_MS: readonly number[] = [120, 350, 700, 1500];

function windowFrame(): LBSafeAreaFrame {
  const { width, height } = Dimensions.get('window');
  return { x: 0, y: 0, width, height };
}

function samePlacement(a: LBContainerPlacement | null, b: LBContainerPlacement): boolean {
  return a != null && a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom;
}

/** 訂閱鍵盤升降，回傳目前的鍵盤量（未升起為 `null`）。`enabled` 為 `false` 時不訂閱。 */
function useKeyboardMetrics(enabled: boolean): LBKeyboardMetrics | null {
  const [keyboard, setKeyboard] = useState<LBKeyboardMetrics | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const show = (event: { endCoordinates?: { height?: number; screenY?: number } }): void => {
      const height = finiteNonNegative(event?.endCoordinates?.height);
      const screenY = event?.endCoordinates?.screenY;
      setKeyboard(
        height > 0 && typeof screenY === 'number' && Number.isFinite(screenY) ? { height, screenY } : null,
      );
    };
    const hide = (): void => setKeyboard(null);
    // iOS 發 will*（與鍵盤動畫同時開始），Android 只發 did*；兩組都訂閱，各平台各取所需。
    const subscriptions = [
      Keyboard.addListener('keyboardWillShow', show),
      Keyboard.addListener('keyboardDidShow', show),
      Keyboard.addListener('keyboardWillHide', hide),
      Keyboard.addListener('keyboardDidHide', hide),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [enabled]);
  return keyboard;
}

/**
 * Tier B 容器的 safe-area 量測點。選出 inset 來源、量出容器在基準框中的位置、算出這個容器的
 * chrome 實際要避開的量。**本身不套任何邊距**——呼叫端把 `measureProps` 掛到容器外框那個 view，
 * 再用 {@link LBSafeAreaScope} 把結果傳給子樹。
 *
 * 巢狀使用是安全的（`CollapsibleLivebuyPlayer` 內含 `LivebuyPlayer`）：內層重新量測並覆寫
 * context，值不會疊加。
 *
 * 量測只在需要時進行（來源是視窗基準且非零、或鍵盤已升起）。其餘情況 `measureProps` 是空物件，
 * 容器節點的 props 與本機制落地前完全相同。
 *
 * @param explicit      容器 config 的 `safeAreaInsets`。
 * @param trackKeyboard 是否追蹤鍵盤（只有含文字輸入表面的容器需要）。
 */
export function useLBSafeAreaBoundary(
  explicit: Partial<LBSafeAreaInsets> | null | undefined,
  trackKeyboard: boolean,
): LBSafeAreaBoundary {
  const contexts = optionalSafeAreaContexts();
  const injected = useContext(LBInjectedSafeAreaContext);
  const autoInsets = useContext(contexts.insets);
  const autoFrame = useContext(contexts.frame);
  const keyboard = useKeyboardMetrics(trackKeyboard);

  const source = pickSafeAreaSource({ explicit, injected, autoInsets, autoFrame, windowFrame: windowFrame() });
  const positionAdjusted = source.kind === 'window' && !isZeroInsets(source.insets);
  const needsPlacement = positionAdjusted || keyboard != null;

  const viewRef = useRef<MeasurableView | null>(null);
  const [placement, setPlacement] = useState<LBContainerPlacement | null>(null);

  // Stable identities (refs + a state setter only), so the ref callback below is attached once per
  // mount instead of being torn down and re-run on every render of the container.
  const measure = useCallback((): void => {
    viewRef.current?.measure?.((_x, _y, width, height, pageX, pageY) => {
      if (![width, height, pageX, pageY].every((value) => typeof value === 'number' && Number.isFinite(value))) {
        return;
      }
      const next = { left: pageX, top: pageY, right: pageX + width, bottom: pageY + height };
      setPlacement((previous) => (samePlacement(previous, next) ? previous : next));
    });
  }, []);
  // 「量一次，之後再補量有限的幾次」。每次呼叫先取消上一批還沒跑完的補量再排新的一批，所以不論
  // 連續觸發幾次，排定中的計時器數量都不會超過一批；節點不存在時什麼都不排。補量本身只呼叫
  // `measure`（不會再呼叫這個函式），所以不會自我觸發。
  const settleTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cancelSettle = useCallback((): void => {
    settleTimersRef.current.forEach((timer) => clearTimeout(timer));
    settleTimersRef.current = [];
  }, []);
  const measureAndSettle = useCallback((): void => {
    cancelSettle();
    if (viewRef.current == null) return;
    measure();
    settleTimersRef.current = LB_SAFE_AREA_SETTLE_DELAYS_MS.map((delay) => setTimeout(measure, delay));
  }, [cancelSettle, measure]);
  const attach = useCallback(
    (view: unknown): void => {
      viewRef.current = view as MeasurableView | null;
      // 節點實際出現時才開始量：量測節點可能比 hook 晚掛上（`CollapsibleLivebuyPlayer` 在沒有
      // 影片時不渲染根節點、`LivebuyLiveEntry` 的 probe 等需要量測時才出現）。節點卸下時取消補量。
      if (view != null) measureAndSettle();
      else cancelSettle();
    },
    [cancelSettle, measureAndSettle],
  );
  // 卸載時清掉所有排定的補量。
  useEffect(() => cancelSettle, [cancelSettle]);

  // 視窗尺寸改變（旋轉、分割畫面）：重新讀取後備的視窗 frame 並重新量測。只在來源以視窗為基準
  // 或鍵盤升起時訂閱，沒有來源的容器不會因此多出任何訂閱或重繪。
  const [windowTick, setWindowTick] = useState(0);
  const watchesWindow = source.kind === 'window' || keyboard != null;
  useEffect(() => {
    if (!watchesWindow) return;
    const subscription = Dimensions.addEventListener?.('change', () => setWindowTick((tick) => tick + 1));
    return () => subscription?.remove?.();
  }, [watchesWindow]);

  // 重新量測的時機：量測節點掛上、節點 `onLayout`、來源的 inset／frame 改變、視窗尺寸改變、鍵盤
  // 升降（視窗可能因此縮小）、host 改變 `remeasureKey`。**每一種**觸發都是「立刻量一次＋之後補量
  // 有限的幾次」（{@link LB_SAFE_AREA_SETTLE_DELAYS_MS}）：`measure` 回報的位置可能含 transform，
  // host 以 transform 做進場轉場時，量到的是轉場途中的位置，而轉場結束不會觸發 `onLayout`。補量的
  // 次數固定、位置沒變就不會重繪，不是輪詢；重繪不是觸發條件，所以不會形成迴圈。
  const frameKey = source.kind === 'window' ? `${source.frame.x},${source.frame.y},${source.frame.width},${source.frame.height}` : '';
  const insetsKey = source.kind === 'none' ? '' : `${source.insets.top},${source.insets.left},${source.insets.right},${source.insets.bottom}`;
  const remeasureKey = injected?.remeasureKey;
  useEffect(() => {
    if (needsPlacement) measureAndSettle();
    else cancelSettle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsPlacement, frameKey, insetsKey, keyboard?.height, keyboard?.screenY, windowTick, remeasureKey]);

  const resolved = resolveSafeAreaInsets(source, needsPlacement ? placement : null);
  const safeArea = useMemo<LBSafeAreaInsets>(
    () => ({ top: resolved.top, left: resolved.left, right: resolved.right, bottom: resolved.bottom }),
    [resolved.top, resolved.left, resolved.right, resolved.bottom],
  );
  const imeBottom = imeBottomOverlap(keyboard, placement);

  const measureProps: LBSafeAreaMeasureProps = needsPlacement
    ? {
        ref: attach,
        onLayout: measureAndSettle,
        // Android 會把純版面用的 view 攤平掉，攤平後量不到；需要量測時才關閉。
        collapsable: false,
      }
    : {};

  return {
    safeArea: isZeroInsets(safeArea) ? LB_SAFE_AREA_ZERO : safeArea,
    imeBottom,
    measureProps,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SDK-owned full-screen Modal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SDK 自有 Modal 能否量到 **Modal 視窗自己的** inset：host 有安裝 `react-native-safe-area-context`
 * 且它匯出 `SafeAreaProvider`（{@link LBPlayerModalSafeAreaRoot} 會在 Modal 內包一層）。
 */
export function lbPlayerModalCanMeasureOwnInsets(): boolean {
  return loadOptionalSafeAreaContext()?.SafeAreaProvider != null;
}

/**
 * PURE：SDK 自有的全螢幕播放器 Modal 是否延伸到系統列後方。原則：**只有在確定拿得到 Modal 視窗
 * 自己的 inset 時才延伸**——延伸了卻沒有對應的內縮量，chrome 會被系統列蓋住，比不延伸更糟。
 *
 *   - host 明確給了 `playerSafeAreaInsets`：有任何一邊非零 → 延伸（這個值就是 host 對「延伸後的
 *     Modal 視窗」給的內縮量）；全零 → 明確關閉，不延伸。
 *   - 沒給：能在 Modal 內重新量測（`canMeasureInModal`）才延伸。
 *
 * `LivebuySafeAreaInsetsProvider` 注入的值**不算**——那是 host 主視窗的 inset，不是 Modal 視窗的。
 */
export function lbPlayerModalExtendsBehindSystemBars(
  explicit: Partial<LBSafeAreaInsets> | null | undefined,
  canMeasureInModal: boolean,
): boolean {
  if (explicit != null) return !isZeroInsets(normalizeInsets(explicit));
  return canMeasureInModal;
}

/**
 * PURE：SDK 自有的全螢幕播放器 `<Modal>` 要額外帶的 props。延伸時讓 Modal 的視窗延伸到狀態列與
 * 導覽列後方（Android；iOS 的 `fullScreen` Modal 本來就是滿版，這兩個 prop 在 iOS 無作用）。不延伸
 * 時回傳空物件——Modal 的 props 與落地前相同。
 */
export function lbPlayerModalEdgeToEdgeProps(extendsBehindSystemBars: boolean): {
  statusBarTranslucent?: boolean;
  navigationBarTranslucent?: boolean;
} {
  return extendsBehindSystemBars ? { statusBarTranslucent: true, navigationBarTranslucent: true } : {};
}

/**
 * PURE：Modal 內是否要擋掉 host 以 `LivebuySafeAreaInsetsProvider` 注入的值。注入的是**主視窗**
 * 的 inset，只有在「Modal 與主視窗確定是同一塊區域、同一個方向」時才能沿用：
 *   - Android：Modal 是另一個視窗，是否延伸到系統列後方與主視窗無關 → 一律擋掉。
 *   - iOS：`fullScreen` Modal 與主視窗佔同一塊螢幕，直向時沿用。但 SDK 的 Modal 沒有設定
 *     `supportedOrientations`（iOS 預設只有直向），host 處於**橫向**時 Modal 的方向與主視窗不同，
 *     注入的四邊值對不上 → 擋掉；host 傳了**自訂 `frame`** 時 inset 的基準不是整個視窗，Modal 內
 *     對不上 → 擋掉。
 * 擋掉之後 Modal 內的播放器只會用到 `playerSafeAreaInsets` 或 Modal 內重新量測的值。
 */
export function lbPlayerModalShieldsInjectedInsets(
  os: string,
  injected: LBInjectedSafeArea | null,
  window: { readonly width: number; readonly height: number },
): boolean {
  if (os !== 'ios') return true;
  if (injected == null) return false;
  return injected.frame != null || window.width > window.height;
}

/**
 * SDK 自有 Modal 的內容根。Modal 是獨立視窗：
 *   - host 有安裝 `react-native-safe-area-context` 時在 Modal 內再包一層它的 `SafeAreaProvider`，
 *     讓 inset 以 Modal 自己的視窗重新量測；
 *   - 主視窗注入的值在不能確定適用時擋掉（Android 一律；iOS 橫向或自訂 `frame` 時——見
 *     {@link lbPlayerModalShieldsInjectedInsets}），Modal 內的播放器只會用到
 *     `playerSafeAreaInsets` 或 Modal 內重新量測的值。
 * 只有 `SafeAreaProvider` 會產生節點；沒有安裝該套件時不多任何節點。
 */
export function LBPlayerModalSafeAreaRoot(props: { readonly children: ReactNode }): ReactElement {
  const Provider = loadOptionalSafeAreaContext()?.SafeAreaProvider ?? null;
  const content = Provider == null ? <>{props.children}</> : <Provider style={{ flex: 1 }}>{props.children}</Provider>;
  const injected = useContext(LBInjectedSafeAreaContext);
  // 恆常渲染這層 Provider（只切換 value）：節點形狀不隨「擋／不擋」改變，iOS 轉向時 Modal 內的播放器
  // 不會因根節點型別切換而重新掛載。
  const shields = lbPlayerModalShieldsInjectedInsets(Platform.OS, injected, Dimensions.get('window'));
  return (
    <LBInjectedSafeAreaContext.Provider value={shields ? null : injected}>{content}</LBInjectedSafeAreaContext.Provider>
  );
}
