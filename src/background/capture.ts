import { translate } from "../i18n/core";
import { currentLocale } from "../shared/locale";
import { isEntryEnabled, SHOT_ENTRIES_KEY, type ShotSource } from "../shared/captureSettings";
import { buildShowOverlay, START_CAPTURE, type StartCaptureMsg } from "../shared/capture/messages";
import { SHOT_MENU_ID, syncMenus } from "./menus";

const ICON = "icon-128.png";
const COMMAND = "take-screenshot";

async function notifyUnsupported(): Promise<void> {
  const loc = await currentLocale();
  const text = translate(loc, "shot.unsupportedPage");
  await chrome.notifications.create(`shot-err:${Date.now()}`, {
    type: "basic",
    iconUrl: chrome.runtime.getURL(ICON),
    title: text,
    message: text,
    priority: 1,
  });
}

/**
 * 三个入口的唯一汇合点。
 *
 * 这里再核一次开关是权威门控:UI 隐藏按钮、菜单被移除都只是可见层,残留的旧菜单项
 * 或竞态仍可能进到这里(与 clipboard.ts#handleCaptureText 对 autoCapture 的处理同理)。
 *
 * 必须先截图再让页面显示覆盖层——反过来的话半透明遮罩会被拍进图里。
 *
 * 整个函数不抛:调用方都是事件监听器,抛出去只会变成没人处理的 unhandled rejection。
 */
export async function startCapture(tabId: number, windowId: number, source: ShotSource): Promise<void> {
  if (!(await isEntryEnabled(source))) return; // 用户主动关的,静默返回,提示才是噪音
  let dataUrl: string;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
  } catch (e) {
    console.error("captureVisibleTab failed", e);
    await notifyUnsupported();
    return;
  }
  try {
    await chrome.tabs.sendMessage(tabId, buildShowOverlay(dataUrl));
  } catch (e) {
    // 页面里没有内容脚本:chrome:// 等受限页面,或扩展安装/更新前就已打开的标签页。
    console.error("show overlay failed", e);
    await notifyUnsupported();
  }
}

async function captureActiveTab(source: ShotSource): Promise<void> {
  // tabs.query 不需要 tabs 权限——缺权限时只是结果里没有 url/title,而我们只要 id。
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id === undefined || tab.windowId === undefined) return;
  await startCapture(tab.id, tab.windowId, source);
}

export function initCapture(): void {
  chrome.commands.onCommand.addListener((command) => {
    // 快捷键无法注销(chrome.commands 没有这个 API),只能在这里按开关忽略。
    if (command === COMMAND) void captureActiveTab("shortcut");
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== SHOT_MENU_ID) return;
    if (tab?.id === undefined || tab.windowId === undefined) return;
    void startCapture(tab.id, tab.windowId, "contextMenu");
  });

  chrome.runtime.onMessage.addListener((msg: StartCaptureMsg) => {
    if (msg && msg.kind === START_CAPTURE) void captureActiveTab("sidePanel");
  });

  // 右键菜单项的增删只能靠整体重建,所以设置一变就重跑一次同步。
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && SHOT_ENTRIES_KEY in changes) void syncMenus();
  });
}
