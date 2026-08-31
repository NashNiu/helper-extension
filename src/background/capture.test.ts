import { beforeEach, describe, expect, it, vi } from "vitest";
import { startCapture } from "./capture";
import { SHOT_ENTRIES_KEY } from "../shared/captureSettings";
import { SHOW_OVERLAY } from "../shared/capture/messages";

const DATA_URL = "data:image/png;base64,AAAA";

function mockChrome(opts: { entries?: unknown; captureFails?: boolean; sendFails?: boolean } = {}) {
  const store: Record<string, unknown> = {};
  if (opts.entries !== undefined) store[SHOT_ENTRIES_KEY] = opts.entries;
  const captureVisibleTab = vi.fn(async () => {
    if (opts.captureFails) throw new Error("cannot capture");
    return DATA_URL;
  });
  const sendMessage = vi.fn(async () => {
    if (opts.sendFails) throw new Error("no receiver");
  });
  const create = vi.fn(async () => "nid");
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: store[key] })),
        set: vi.fn(async () => {}),
      },
    },
    tabs: { captureVisibleTab, sendMessage },
    notifications: { create },
    runtime: { getURL: (p: string) => `chrome-extension://x/${p}` },
    i18n: { getUILanguage: () => "zh-CN" },
  };
  return { captureVisibleTab, sendMessage, create };
}

describe("startCapture", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("对应入口关闭时什么都不做——不截图也不提示", async () => {
    const m = mockChrome({ entries: { sidePanel: true, contextMenu: false, shortcut: true } });
    await startCapture(1, 10, "contextMenu");
    expect(m.captureVisibleTab).not.toHaveBeenCalled();
    expect(m.sendMessage).not.toHaveBeenCalled();
    expect(m.create).not.toHaveBeenCalled();
  });

  it("入口开启时按 windowId 截当前窗口的可见区域,PNG 格式", async () => {
    const m = mockChrome();
    await startCapture(1, 10, "shortcut");
    expect(m.captureVisibleTab).toHaveBeenCalledWith(10, { format: "png" });
  });

  it("截图成功后把 dataUrl 发给对应 tab 的内容脚本", async () => {
    const m = mockChrome();
    await startCapture(7, 10, "shortcut");
    expect(m.sendMessage).toHaveBeenCalledWith(7, { kind: SHOW_OVERLAY, dataUrl: DATA_URL });
  });

  it("截图失败时发通知,且不再发消息", async () => {
    const m = mockChrome({ captureFails: true });
    await startCapture(1, 10, "shortcut");
    expect(m.create).toHaveBeenCalled();
    expect(m.sendMessage).not.toHaveBeenCalled();
  });

  it("消息发送失败(页面没有内容脚本)时也发通知", async () => {
    const m = mockChrome({ sendFails: true });
    await startCapture(1, 10, "shortcut");
    expect(m.create).toHaveBeenCalled();
  });

  it("失败不抛出——SW 里未捕获的 promise 拒绝没人处理", async () => {
    mockChrome({ captureFails: true });
    await expect(startCapture(1, 10, "shortcut")).resolves.toBeUndefined();
  });

  it("没存过设置时三个入口都放行", async () => {
    const m = mockChrome();
    await startCapture(1, 10, "sidePanel");
    expect(m.captureVisibleTab).toHaveBeenCalled();
  });
});
