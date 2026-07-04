import { buildTextCapture } from "../shared/clipboardMessage";

// 页面上 Ctrl+C 会触发 copy 事件;取选中文字发给后台入库。图片走右键菜单(见 background/clipboard.ts)。
document.addEventListener("copy", () => {
  const raw = window.getSelection?.()?.toString() ?? "";
  const msg = buildTextCapture(raw, location.hostname);
  if (msg) chrome.runtime.sendMessage(msg).catch(() => {});
});
