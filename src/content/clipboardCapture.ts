import { buildTextCapture } from "../shared/clipboardMessage";

function send(msg: object): void {
  chrome.runtime.sendMessage(msg).catch(() => {
    // SW 可能正在冷启动;短暂延迟后重试一次,仍失败才放弃。
    setTimeout(() => { void chrome.runtime.sendMessage(msg).catch(() => {}); }, 150);
  });
}

document.addEventListener("copy", () => {
  const raw = window.getSelection?.()?.toString() ?? "";
  const msg = buildTextCapture(raw, location.hostname);
  if (msg) send(msg);
});
