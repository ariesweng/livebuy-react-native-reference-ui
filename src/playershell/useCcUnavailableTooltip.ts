// useCcUnavailableTooltip — local, ephemeral UI state for the R42 "CC unavailable" tooltip.
//
// Spec: `reference-ui-rendering/spec.md` (rb-rn-cc-icon-availability-redesign).
// Design: `design/contract/claude-design-sync.md` R42 — tapping the CC pill while captions are
// unavailable does NOT toggle captions; instead it shows a short "未提供字幕/隱藏式輔助字幕"
// tooltip that auto-dismisses after ~1.8s.
//
// This is DELIBERATELY local, ephemeral presentation state (`useState` + `useEffect` +
// `setTimeout`, same pattern as `HeartBurst.tsx`'s burst-lifetime timer) — it is NOT wired to any
// host callback, core `simulate*`, or view-model field. Shared by `OperationRailView.tsx`'s
// `CcRailPill` (VOD side rail) and `LiveBottomBarView.tsx`'s `chatClosed` CC slot (LIVE-replay
// bottom bar) — the two call sites R42 scopes this interaction to.

import { useEffect, useState } from 'react';

/** Auto-dismiss duration, milliseconds (design R42: "約 1.8 秒後自動消失"). Exported for tests. */
export const CC_UNAVAILABLE_TOOLTIP_MS = 1800;

export interface CcUnavailableTooltip {
  /** Whether the tooltip is currently shown. */
  readonly visible: boolean;
  /** Show the tooltip; it auto-hides itself after {@link CC_UNAVAILABLE_TOOLTIP_MS}. Calling
   *  this again while already visible restarts the auto-dismiss window. */
  readonly show: () => void;
}

/** Local tooltip visibility state with a self-clearing timer. */
export function useCcUnavailableTooltip(): CcUnavailableTooltip {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), CC_UNAVAILABLE_TOOLTIP_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  return { visible, show: () => setVisible(true) };
}
