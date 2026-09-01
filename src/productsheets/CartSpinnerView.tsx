import type { ReactElement } from 'react';
import { View } from 'react-native';

// MARK: - CartSpinnerView — 加購 CTA「請求中」spinner（靜態 3/4 環，design `LBPSpinner`）
//
// Spec: `reference-ui-rendering/spec.md`「加購 CTA 請求中 loading」(rb-rn-cart-add-loading-state).
// RN parity of iOS `SpinnerRingView` / Android `CartSpinner` / 設計 `sdk-components.jsx`
// `LBPSpinner`（3/4 環 `lbp-spin` 邊框 spinner）。RN 無 Canvas / react-native-svg（同
// `EqualizerGlyph` / `ShareGlyph` 約束），且結構快照需確定 → 比照 `StartScreenView.renderSpinnerRing`
// 用「faint 全環 View + bright top arc View」**靜態**畫（無 Animated）：snapshot 穩定，runtime
// 仍是 loading affordance（spinner 旋轉非快照必要）。CTA 用，預設白色（accent 底上）。
//
// Pure presentation: 只有 `size` / `lineWidth` / `color`（default 白）。

/** Faint 全環軌道色（白 22%）— 對齊 `StartScreenView` `SPINNER_TRACK`。 */
const TRACK = 'rgba(255,255,255,0.28)';

/** 加購 CTA 的「請求中」spinner：faint 全環 + bright top arc（靜態，結構快照穩定）。 */
export function CartSpinnerView(props: {
  size?: number;
  lineWidth?: number;
  color?: string;
}): ReactElement {
  const size = props.size ?? 18;
  const lineWidth = props.lineWidth ?? 2;
  const color = props.color ?? '#FFFFFF';
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {/* Faint 全環（spinner 軌道）。 */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: lineWidth,
          borderColor: TRACK,
        }}
      />
      {/* Bright top arc（spinner 頭）— 頂緣一段短圓條，trimmed 25% arc 的確定性替身
          （比照 iOS `SpinnerRingView` 凍結幀 / `StartScreenView.renderSpinnerRing`）。 */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: size / 2 - size / 5,
          width: (size / 5) * 2,
          height: lineWidth,
          borderRadius: lineWidth / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
