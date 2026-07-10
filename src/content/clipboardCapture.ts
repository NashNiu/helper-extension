import { buildTextCapture } from "../shared/clipboardMessage";
import { CLIP_SETTINGS_KEY } from "../shared/clipboardStore";

// 缓存开关(默认开);仅当开启时才读取选区并发送。
let enabled = true;

function applyEnabled(raw: unknown): void {
  const s = raw as { autoCapture?: boolean } | undefined;
  enabled = s?.autoCapture !== false; // 缺省/未设置视为开启
}

chrome.storage.local.get(CLIP_SETTINGS_KEY).then((r) => applyEnabled(r[CLIP_SETTINGS_KEY])).catch(() => {});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[CLIP_SETTINGS_KEY]) applyEnabled(changes[CLIP_SETTINGS_KEY].newValue);
});

function send(msg: object): void {
  chrome.runtime.sendMessage(msg).catch(() => {
    // SW 可能正在冷启动;短暂延迟后重试一次,仍失败才放弃。
    setTimeout(() => { void chrome.runtime.sendMessage(msg).catch(() => {}); }, 150);
  });
}

document.addEventListener("copy", () => {
  if (!enabled) return;
  const raw = window.getSelection?.()?.toString() ?? "";
  const msg = buildTextCapture(raw, location.hostname);
  if (msg) send(msg);
});
