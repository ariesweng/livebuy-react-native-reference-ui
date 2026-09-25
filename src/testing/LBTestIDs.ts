// Centralized registry of E2E test IDs for the React Native reference-ui.
//
// Every `testID` string used by a production reference-ui component MUST come from
// here (CI greps `react-native-reference-ui/src` for `testID=["'` + "`"] literals —
// only this file and `__tests__` may contain them). IDs are INERT: `testID` is a
// pure test-only prop — it does not affect layout / measure / render, so the visual
// pixels and all onPress / gesture behavior stay unchanged.
//
// The string VALUES are a stable cross-platform contract: they are 1:1 identical to
// the Android `LBTestTags` (`android/.../testing/LBTestTags.kt`) and iOS
// `LBAccessibilityID` (`ios/.../Testing/LBAccessibilityID.swift`) values, so the same
// E2E scenario id names carry across iOS / Android / RN / Flutter. The TS constant
// name is camelCase; the string value is the shared snake_case `lb_*` token.
// Renaming a value is a breaking change — update the harness scenarios in the same
// change.

export const LBTestIDs = {
  // ── Family 1 — player shell + chrome ──────────────────────────────────────
  playerShell: 'lb_player_shell',
  playerVideoSurface: 'lb_player_video_surface',
  playerHeader: 'lb_player_header',
  playerHeaderHostPill: 'lb_player_header_host_pill',
  /** The header title slot (`MarqueeTitle`) — rb-rn-marquee-title-scroll. Value is verbatim
   *  the Android `LBTestTags.PLAYER_HEADER_TITLE`, keeping the cross-platform id contract. */
  playerHeaderTitle: 'lb_player_header_title',
  subscribeBadge: 'lb_subscribe_badge',
  playerMinimize: 'lb_player_minimize',
  playerBag: 'lb_player_bag',

  operationRail: 'lb_operation_rail',
  railLike: 'lb_rail_like',
  railComment: 'lb_rail_comment',
  railShare: 'lb_rail_share',
  railSubtitle: 'lb_rail_subtitle',
  // rb-rn-cc-icon-availability-redesign (design R42) — the VOD side rail CC pill's "未提供字幕"
  // tooltip (shown when tapped while captions are unavailable; auto-dismisses ~1.8s).
  railSubtitleTooltip: 'lb_rail_subtitle_tooltip',
  railService: 'lb_rail_service',
  railGoods: 'lb_rail_goods',
  // rb-rn-live-replay-more-menu-and-video-info-live-copy (design R32) — the VOD side rail's
  // `LBSideRailKind.More` pill (`OperationRailProps.isFinishedLiveReplay`); opens
  // `LiveMoreMenuView`. ⚠️ Component-level only since `rb-rn-replay-live-chrome-parity`: the
  // side rail is now PURE-VOD-ONLY and its current call site no longer feeds
  // `isFinishedLiveReplay`, so this id is exercised only by direct unit tests
  // (`OperationRail.test.tsx`) today, not by any real render path — see `liveMore` below for the
  // real trigger.
  railMore: 'lb_rail_more',

  liveBagButton: 'lb_live_bag_button',
  liveCommentPill: 'lb_live_comment_pill',
  livePersonEdit: 'lb_live_person_edit',
  liveShare: 'lb_live_share',
  liveHeart: 'lb_live_heart',
  // rb-rn-live-replay-more-menu-and-video-info-live-copy (design R32) — `chatClosed` replay
  // variant's "更多" / CC buttons on `LiveBottomBarView`. `rb-rn-replay-live-chrome-parity`
  // wired the real call site: `PlayerShellView.tsx`'s `<LiveBottomBarView>` now feeds
  // `chatClosed={model.isFinishedLiveReplay}`, so these two ids ARE reachable from a real
  // finished-live-replay render — `liveMore` is the actual "更多" trigger (see `railMore` above
  // for the now component-level-only side-rail predecessor).
  liveMore: 'lb_live_more',
  liveCC: 'lb_live_cc',
  // rb-rn-cc-icon-availability-redesign (design R42) — the LIVE-replay (`chatClosed`) bottom
  // bar's CC toggle's "未提供字幕" tooltip (same interaction as `railSubtitleTooltip` above, at
  // the OTHER of the two CC entry points R42 scopes this to).
  liveCcTooltip: 'lb_live_cc_tooltip',
  // The standalone `LiveMoreMenuView` sheet's two action items — REACHABLE in real playback via
  // `LiveBottomBarView`'s `liveMore` button above (`chatClosed` variant, since
  // `rb-rn-replay-live-chrome-parity`), NOT via the (now component-level-only) `railMore`.
  liveMoreMenu: 'lb_live_more_menu',
  liveMoreMenuShare: 'lb_live_more_menu_share',
  liveMoreMenuContact: 'lb_live_more_menu_contact',
  announceBanner: 'lb_announce_banner',
  pinnedCard: 'lb_pinned_card',
  pinnedCardClose: 'lb_pinned_card_close',
  pinnedCarousel: 'lb_pinned_carousel',
  nowIntroCarousel: 'lb_now_intro_carousel',
  nowIntroducingCard: 'lb_now_introducing_card',

  infoPanel: 'lb_info_panel',
  infoTabDetail: 'lb_info_tab_detail',
  infoTabNotice: 'lb_info_tab_notice',
  // `infoPanelHome` ('前往商城首頁' PRIMARY footer button) REMOVED
  // (rb-rn-live-replay-more-menu-and-video-info-live-copy, design R32 — user-decided removal).
  infoFooterContact: 'lb_info_footer_contact',
  contactModal: 'lb_contact_modal',
  contactCancel: 'lb_contact_cancel',
  contactConfirm: 'lb_contact_confirm',
  contactScrim: 'lb_contact_scrim',
  momentCountdownRoot: 'lb_moment_countdown_root',
  // rb-rn-vod-playback-progress-bar — VOD/回放播放進度條. Values are 1:1 identical to the iOS
  // `LBAccessibilityID.playbackProgress*` constants (cross-platform E2E id contract).
  playbackProgressBar: 'lb_playback_progress_bar',
  playbackProgressTrack: 'lb_playback_progress_track',
  playbackProgressPlayPause: 'lb_playback_progress_play_pause',
  playbackProgressReadout: 'lb_playback_progress_readout',
  // rb-rn-clean-mode-upcoming-intro-coverage — 開場影片 cleanMode 期間的唯讀展開進度列（不可拖曳
  // seek，只顯示 position/duration 進度）。
  introProgressBar: 'lb_intro_progress_bar',
  // rb-react-native-subtitle-vtt-caption-display — VOD CC 字幕 overlay.
  captionOverlay: 'lb_caption_overlay',
  // rb-rn-live-now-pill — 「現正直播」right-edge half-pill. Value is 1:1 identical to iOS
  // `LBAccessibilityID.liveNowPill` / Android `LBTestTags.LIVE_NOW_PILL` (cross-platform E2E id
  // contract).
  liveNowPill: 'lb_live_now_pill',
  // player-gesture-feedback-overlays-rn — 中央暫停覆蓋層（PlaybackPausedOverlayView）的兩個互動按鈕.
  // Values are 1:1 identical to iOS `LBAccessibilityID.pausedOverlayMuteButton` /
  // `.pausedOverlayResumeButton` and Android `LBTestTags.PAUSED_OVERLAY_MUTE_BUTTON` /
  // `.PAUSED_OVERLAY_RESUME_BUTTON` (cross-platform E2E id contract).
  pausedOverlayMuteButton: 'lb_paused_overlay_mute_button',
  pausedOverlayResumeButton: 'lb_paused_overlay_resume_button',
  // player-gesture-feedback-overlays-rn — 0.7s 中央靜音提示 toast（GestureMuteToastView）. RN-only
  // id — iOS/Android's sibling component currently carries no accessibility/test id of its own.
  // Retained (component kept, retired-but-not-deleted) though no longer composed by
  // `PlayerShellView` as of rb-rn-gesture-clean-mode-v2.
  gestureMuteToast: 'lb_gesture_mute_toast',
  // rb-rn-double-tap-seek-feedback — 雙擊 seek ±10s 的半螢幕手勢回饋 toast（GestureSeekToastView）.
  // 命中雙擊 seek 那一刻由 `PlayerShellView` 顯示 ~0.7s 後自動消失；`zone` prop（'forward'/'rewind'）
  // 區分快進/倒退方向，測試以此 prop 辨別，不另開兩個 testID（parity `gestureMuteToast` 用
  // rendered label 辨別 muted/unmuted 的既有慣例）。
  gestureSeekToast: 'lb_gesture_seek_toast',
  // rb-rn-gesture-clean-mode-v2 — 頂列乾淨模式限定靜音鈕 + 退出乾淨模式鈕. Values are 1:1 identical
  // to iOS `LBAccessibilityID.playerHeaderMuteButton` / `.cleanModeExitButton` (cross-platform
  // E2E id contract).
  playerHeaderMuteButton: 'lb_player_header_mute_button',
  cleanModeExitButton: 'lb_clean_mode_exit_button',

  // ── Family 2 — feed + win ─────────────────────────────────────────────────
  chatFeed: 'lb_chat_feed',
  activityToast: 'lb_activity_toast',
  eventJoinCta: 'lb_event_join_cta',
  eventJoinJoined: 'lb_event_join_joined',
  pinnedBanner: 'lb_pinned_banner',
  chatScrollToBottom: 'lb_chat_scroll_to_bottom',
  winEntry: 'lb_win_entry',
  winClaimSheet: 'lb_win_claim_sheet',
  winClaimPrimary: 'lb_win_claim_primary',
  winClaimSecondary: 'lb_win_claim_secondary',
  winClaimClose: 'lb_win_claim_close',
  winClaimResultBanner: 'lb_win_claim_result_banner',
  winClaimScrim: 'lb_win_claim_scrim',
  // rb-rn-win-claim-email-flow — 四階段領獎 modal 的新元件（EMAIL-LESS 退役）。既有六個 id
  // 語意不變（`winClaimSheet` 仍是底卡、`winClaimResultBanner` 仍是結果內容列）。
  winClaimEmailField: 'lb_win_claim_email_field',
  winClaimAlert: 'lb_win_claim_alert',
  winClaimAlertScrim: 'lb_win_claim_alert_scrim',
  winClaimAlertCancel: 'lb_win_claim_alert_cancel',
  winClaimAlertConfirm: 'lb_win_claim_alert_confirm',
  winClaimSubmitting: 'lb_win_claim_submitting',
  winClaimCopyCode: 'lb_win_claim_copy_code',
  winClaimFailNotice: 'lb_win_claim_fail_notice',
  winClaimFooter: 'lb_win_claim_footer',
  // rb-rn-win-claim-footer-links — footer 兩段文字各自可點擊後的獨立 id（parity iOS
  // `LBAccessibilityID.winClaimFooterTerms` / `.winClaimFooterPrivacy`、Android
  // `LBTestTags.winClaimFooterTerms` / `.winClaimFooterPrivacy`，字串值逐字對齊）。既有
  // `winClaimFooter`（外層 `View` 共用 id）保留不動。
  winClaimFooterTerms: 'lb_win_claim_footer_terms',
  winClaimFooterPrivacy: 'lb_win_claim_footer_privacy',
  // rb-rn-live-activity-sheet — 活動入口 + 抽獎活動彈窗（`ActivityEntryView.tsx` /
  // `ActivitySheetView.tsx`）. Values are a cross-platform contract shared with the
  // `rb-{ios,android,flutter}-live-activity-sheet` siblings — 逐字對齊 iOS `LBAccessibilityID` /
  // Android `LBTestTags`. No close-✕ id: the design mock dismisses via scrim tap only.
  activityEntry: 'lb_activity_entry',
  activitySheet: 'lb_activity_sheet',
  activitySheetPrimary: 'lb_activity_sheet_primary',
  activitySheetScrim: 'lb_activity_sheet_scrim',

  // ── Family 3 — product + sheets ───────────────────────────────────────────
  productList: 'lb_product_list',
  sheetSearchField: 'lb_sheet_search_field',
  sheetSearchClear: 'lb_sheet_search_clear',
  sheetSearchCancel: 'lb_sheet_search_cancel',
  productSearchButton: 'lb_product_search_button',
  cartCtaFooter: 'lb_cart_cta_footer',
  productDetail: 'lb_product_detail',
  // rb-rn-product-detail-image-gallery (design R34): the `.detail` presentation's swipeable
  // main-photo container — ONLY present when the gallery is interactive (`photos.length > 1`;
  // see `ProductDetailSheetView.tsx`'s `swipeable`). A single/zero-photo product carries NO
  // testID here (byte-identical to the pre-gallery structural tree), so this id is only ever
  // looked up in multi-photo test scenarios.
  productDetailPhoto: 'lb_product_detail_photo',
  qtyPlus: 'lb_qty_plus',
  qtyMinus: 'lb_qty_minus',
  favButton: 'lb_fav_button',
  shareButton: 'lb_share_button',
  variantPrompt: 'lb_variant_prompt',
  variantPromptScrim: 'lb_variant_prompt_scrim',
  variantPromptAck: 'lb_variant_prompt_ack',
  addToCartSheet: 'lb_add_to_cart_sheet',
  addToCartCta: 'lb_add_to_cart_cta',
  addToCartRetry: 'lb_add_to_cart_retry',
  zoomBadge: 'lb_zoom_badge',
  zoomOverlay: 'lb_zoom_overlay',
  imageZoomImage: 'lb_image_zoom_image',
  zoomClose: 'lb_zoom_close',
  notifyRestockSheet: 'lb_notify_restock_sheet',
  restockNoticeCta: 'lb_restock_notice_cta',
  minicartPeek: 'lb_minicart_peek',
  minicartPeekClose: 'lb_minicart_peek_close',
  cartToast: 'lb_cart_toast',
  sheetHeaderClose: 'lb_sheet_header_close',
  // rb-rn-product-detail-recommendations (design R21) — header 返回 affordance (breadcrumb
  // non-empty), 商品介紹文字區, 更多商品推薦格容器. Parity Android `SHEET_HEADER_BACK` /
  // `PRODUCT_INTRO_SECTION` / `PRODUCT_RECOMMENDATIONS_SECTION`.
  sheetHeaderBack: 'lb_sheet_header_back',
  productIntroSection: 'lb_product_intro_section',
  productRecommendationsSection: 'lb_product_recommendations_section',

  // ── Family 4 — moments ────────────────────────────────────────────────────
  momentRoot: 'lb_moment_root',
  momentError: 'lb_moment_error',
  momentErrorRetry: 'lb_moment_error_retry',
  momentErrorBack: 'lb_moment_error_back',
  momentEnd: 'lb_moment_end',
  momentEndWatch: 'lb_moment_end_watch',
  momentEndCancel: 'lb_moment_end_cancel',
  // `momentEndReshuffle` / `momentEndHotRow` (熱門變體專屬) RETAINED though unreferenced by any
  // production render path since rb-rn-endscreen-live-empty-state (design R41 retired the 熱門
  // variant) — `openspec/specs/rn-e2e-test-ids/spec.md` still documents them and removing an
  // enumerated id is out of THIS change's scope (component-contracts only).
  momentEndReshuffle: 'lb_moment_end_reshuffle',
  momentEndHotRow: 'lb_moment_end_hot_row',
  // 空狀態「查看購物車」CTA (rb-rn-endscreen-live-empty-state, design R41).
  momentEndViewCart: 'lb_moment_end_view_cart',
  momentStart: 'lb_moment_start',
  momentStartSkip: 'lb_moment_start_skip',
  momentLoading: 'lb_moment_loading',
  momentLoadingMark: 'lb_moment_loading_mark',

  // ── Family 5 — widget ─────────────────────────────────────────────────────
  widgetCarousel: 'lb_widget_carousel',
  widgetGrid: 'lb_widget_grid',
  // rb-rn-widget-loading-placeholder — first-load placeholder roots (design D9).
  widgetCarouselLoading: 'lb_widget_carousel_loading',
  widgetGridLoading: 'lb_widget_grid_loading',
  widgetSeeMore: 'lb_widget_see_more',
  gridLoadMoreFooter: 'lb_grid_load_more_footer',
  gridEndLabel: 'lb_grid_end_label',
  cardKindBadge: 'lb_card_kind_badge',
  cardLiveBadge: 'lb_card_live_badge',
  // `cardDurationPill` REMOVED (rb-rn-carousel-card-pin-viewers-duration-removal, design R33 —
  // the VOD「▶ mm:ss」duration pill is retired; VOD cards no longer render any kind-badge
  // content).
  cardUpcomingOverlay: 'lb_card_upcoming_overlay',
  // rb-rn-carousel-card-pin-viewers-duration-removal (design R33) — top-right pin badge
  // (`video.pin > 0`, all three kinds) and the LIVE-only viewer-count badge
  // (`video.showPvNum > 0 && video.watchNum > 0`, next to the LIVE tag). NOT the family-2
  // chat「置頂留言」feature — see `pinnedCard` / `pinnedBanner` below for that unrelated concept.
  cardPinBadge: 'lb_card_pin_badge',
  cardViewerBadge: 'lb_card_viewer_badge',
  // `product_card === 'below'`: the white-card product row outside the thumbnail (design R33;
  // was surface-token styled before), and the equal-height transparent placeholder drawn in
  // its place when the card has no goods.
  cardBelowProductRow: 'lb_card_below_product_row',
  cardBelowProductSpacer: 'lb_card_below_product_spacer',
  floatingWidget: 'lb_floating_widget',
  floatingClose: 'lb_floating_close',
  minimizedWidget: 'lb_minimized_widget',
  minimizedClose: 'lb_minimized_close',
  minimizedExpand: 'lb_minimized_expand',
  loopingPreview: 'lb_looping_preview',

  // ── Family 6 — gap-surfaces ───────────────────────────────────────────────
  authGateModal: 'lb_auth_gate_modal',
  authGateLogin: 'lb_auth_gate_login',
  authGateLater: 'lb_auth_gate_later',
  authGateScrim: 'lb_auth_gate_scrim',
  guestNameModal: 'lb_guest_name_modal',
  guestNameField: 'lb_guest_name_field',
  guestNameSubmit: 'lb_guest_name_submit',
  guestNameScrim: 'lb_guest_name_scrim',
  guestNameError: 'lb_guest_name_error',

  // ── Family 7 — container + sheetkit (shared chrome) ───────────────────────
  bottomSheetScrim: 'lb_bottom_sheet_scrim',
  // rb-rn-sheetkit-resize-dismiss-unify (supersedes rb-rn-product-sheet-resize-fav-inline) —
  // the invisible drag-to-resize/dismiss hit-zone BottomSheetPresenter ALWAYS renders over the
  // leaf's own grab handle (design `LBPBottomSheet` drag handle; no more `resizable` opt-in —
  // every bottom sheet this presenter carries, plus `ProductListView`'s own local wiring, gets
  // this hit-zone unconditionally).
  bottomSheetDragHandle: 'lb_bottom_sheet_drag_handle',
  chatComposer: 'lb_chat_composer',
  chatSend: 'lb_chat_send',
  chatComposerDismiss: 'lb_chat_composer_dismiss',
} as const;

export type LBTestID = (typeof LBTestIDs)[keyof typeof LBTestIDs];

// ── Per-item (index-addressable) helpers ────────────────────────────────────
// Each helper's return value is 1:1 identical to the matching Android `LBTestTags`
// / iOS `LBAccessibilityID` helper.

/** Per-item chat line id, e.g. `chatLine(0) === 'lb_chat_line_0'`. */
export function chatLine(index: number): string {
  return `lb_chat_line_${index}`;
}

/** Per-item activity line id. */
export function activityLine(index: number): string {
  return `lb_activity_line_${index}`;
}

/** Per-item carousel card id, e.g. `carouselCard(0) === 'lb_carousel_card_0'`. */
export function carouselCard(index: number): string {
  return `lb_carousel_card_${index}`;
}

/** Per-item grid card id, e.g. `gridCard(0) === 'lb_grid_card_0'`. */
export function gridCard(index: number): string {
  return `lb_grid_card_${index}`;
}

/** Per-item product-row id, e.g. `productRow(0) === 'lb_product_row_0'`. */
export function productRow(index: number): string {
  return `lb_product_row_${index}`;
}

/** Per-item product-row thumbnail (seek-to-intro) id. */
export function productRowThumb(index: number): string {
  return `lb_product_row_thumb_${index}`;
}

/** Per-item product-row name/detail-open id. */
export function productRowDetail(index: number): string {
  return `lb_product_row_detail_${index}`;
}

/** Per-item product-row share id. */
export function productRowShare(index: number): string {
  return `lb_product_row_share_${index}`;
}

/** Per-item product-row add-to-cart / restock id. */
export function productRowCart(index: number): string {
  return `lb_product_row_cart_${index}`;
}

/** Per-item「更多商品」推薦格 grid-card id (whole-card tap → drill-in detail). */
export function productRecommendationCard(index: number): string {
  return `lb_product_recommendation_card_${index}`;
}

/** Per-item recommendation grid-card play-button id (换片, only when `videoId != null`). */
export function productRecommendationPlay(index: number): string {
  return `lb_product_recommendation_play_${index}`;
}

/** Per-item recommendation grid-card cart-button id (加購, hidden when sold out). */
export function productRecommendationCart(index: number): string {
  return `lb_product_recommendation_cart_${index}`;
}

/** Per-(group, option) variant chip id, e.g. `variantChip(1, 2) === 'lb_variant_chip_1_2'`. */
export function variantChip(group: number, option: number): string {
  return `lb_variant_chip_${group}_${option}`;
}

/** Per-item product-detail gallery thumbnail id (rb-rn-product-detail-image-gallery, design
 *  R34). Only rendered when the `.detail` presentation has more than one photo. */
export function productDetailPhotoThumb(index: number): string {
  return `lb_product_detail_photo_thumb_${index}`;
}

/** Per-item end-screen hot card id. */
export function momentHotCard(index: number): string {
  return `lb_moment_hot_card_${index}`;
}

/** Per-item live pinned-product carousel page dot id. */
export function livePinnedDot(index: number): string {
  return `lb_live_pinned_dot_${index}`;
}

/** Per-item now-introducing carousel page dot id. */
export function nowIntroducingDot(index: number): string {
  return `lb_now_introducing_dot_${index}`;
}
