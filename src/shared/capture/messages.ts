export const SHOW_OVERLAY = "screenshot/show-overlay";

export interface ShowOverlayMsg {
  kind: typeof SHOW_OVERLAY;
  /** 已截好的可见区域 PNG。必须先截图再显示覆盖层,否则遮罩会被拍进图里。 */
  dataUrl: string;
}

export function buildShowOverlay(dataUrl: string): ShowOverlayMsg {
  return { kind: SHOW_OVERLAY, dataUrl };
}

/** 侧边栏 → SW 的触发消息。面板拿不到 activeTab,只能让 SW 代劳截图。 */
export const START_CAPTURE = "screenshot/start";

export interface StartCaptureMsg {
  kind: typeof START_CAPTURE;
}

export function buildStartCapture(): StartCaptureMsg {
  return { kind: START_CAPTURE };
}
