import { translate } from "../i18n/core";
import { currentLocale } from "../shared/locale";
import { addItem, getSettings, MAX_IMAGE_BYTES } from "../shared/clipboardStore";
import { CAPTURE_TEXT, hostnameOf, makeImageItem, makeTextItem, type CaptureTextMsg } from "../shared/clipboardMessage";

const MENU_ID = "helper-clip-image";
const ICON = "icon-128.png";

// Blob → dataURL(SW 无 FileReader,用 arrayBuffer + btoa)。
export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${blob.type || "image/png"};base64,${btoa(bin)}`;
}

async function saveImage(srcUrl: string, source: string): Promise<void> {
  const loc = await currentLocale();
  try {
    const res = await fetch(srcUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    if (blob.size > MAX_IMAGE_BYTES) {
      await chrome.notifications.create(`clip-err:${Date.now()}`, {
        type: "basic",
        iconUrl: chrome.runtime.getURL(ICON),
        title: translate(loc, "clip.imageTooLarge"),
        message: translate(loc, "clip.imageTooLarge"),
        priority: 1,
      });
      return;
    }
    const bmp = await createImageBitmap(blob);
    const w = bmp.width;
    const h = bmp.height;
    bmp.close();
    const dataUrl = await blobToDataUrl(blob);
    await addItem(
      makeImageItem({ dataUrl, bytes: blob.size, w, h, source: source || "image", id: crypto.randomUUID(), createdAt: Date.now() }),
    );
  } catch (e) {
    console.error("saveImage failed", e);
    await chrome.notifications.create(`clip-err:${Date.now()}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL(ICON),
      title: translate(loc, "clip.saveImageFailed"),
      message: translate(loc, "clip.saveImageFailed"),
      priority: 1,
    });
  }
}

// module top-level — registered once per SW lifetime, synchronously
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === MENU_ID && info.srcUrl) {
    void saveImage(info.srcUrl, hostnameOf(info.pageUrl ?? ""));
  }
});

async function handleCaptureText(msg: CaptureTextMsg): Promise<void> {
  const settings = await getSettings();
  if (!settings.autoCapture) return; // 权威门控:关闭时忽略(即使残留旧内容脚本发来)
  await addItem(makeTextItem({ text: msg.text, source: msg.source, id: crypto.randomUUID(), createdAt: Date.now() }));
}

chrome.runtime.onMessage.addListener((msg: CaptureTextMsg) => {
  if (msg && msg.kind === CAPTURE_TEXT) void handleCaptureText(msg);
});

export async function initClipboard(): Promise<void> {
  const loc = await currentLocale();
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: translate(loc, "clip.menuSaveImage"),
      contexts: ["image"],
    });
  });
}
