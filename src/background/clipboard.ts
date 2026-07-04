import { translate } from "../i18n/core";
import { currentLocale } from "../shared/locale";
import { addItem } from "../shared/clipboardStore";
import {
  CAPTURE_TEXT,
  hostnameOf,
  makeImageItem,
  makeTextItem,
  type CaptureTextMsg,
} from "../shared/clipboardMessage";

const MENU_ID = "helper-clip-image";
const ICON = "icon-128.png";

// Blob → dataURL(SW 无 FileReader,用 arrayBuffer + btoa)。
async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `data:${blob.type || "image/png"};base64,${btoa(bin)}`;
}

async function saveText(text: string, source: string): Promise<void> {
  await addItem(makeTextItem({ text, source, id: crypto.randomUUID(), createdAt: Date.now() }));
}

async function saveImage(srcUrl: string, source: string): Promise<void> {
  const loc = await currentLocale();
  try {
    const res = await fetch(srcUrl);
    const blob = await res.blob();
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

export async function initClipboard(): Promise<void> {
  const loc = await currentLocale();
  // 重建菜单以刷新本地化标题(语言切换后重载即生效)。
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: translate(loc, "clip.menuSaveImage"),
      contexts: ["image"],
    });
  });

  chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === MENU_ID && info.srcUrl) {
      void saveImage(info.srcUrl, hostnameOf(info.pageUrl ?? ""));
    }
  });

  chrome.runtime.onMessage.addListener((msg: CaptureTextMsg) => {
    if (msg && msg.kind === CAPTURE_TEXT) void saveText(msg.text, msg.source);
  });
}
