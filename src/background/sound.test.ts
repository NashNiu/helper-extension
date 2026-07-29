import { afterEach, describe, expect, it, vi } from "vitest";
import { chimeNotes } from "../shared/chime";

// mockChrome 是有状态的:hasDocument() 在 createDocument() 真正跑过之前必须返回
// false,跑过之后返回 true。否则「并发只建一次」这条测试无论 sound.ts 里的串行化
// 逻辑对不对都会通过——测试就失去了意义。
function mockChrome(opts: { soundEnabled: boolean; createDocumentImpl?: () => Promise<void> }) {
  const { soundEnabled, createDocumentImpl } = opts;
  const data: Record<string, unknown> = { "helper.sound.enabled": soundEnabled };
  let documentExists = false;

  const createDocument = vi.fn(async () => {
    if (createDocumentImpl) {
      await createDocumentImpl();
    }
    documentExists = true;
  });
  const hasDocument = vi.fn(async () => documentExists);
  const sendMessage = vi.fn(async (_msg: { type: string; notes: unknown }) => undefined);

  (globalThis as any).chrome = {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: data[key] })),
      },
    },
    offscreen: {
      hasDocument,
      createDocument,
      Reason: { AUDIO_PLAYBACK: "AUDIO_PLAYBACK" },
    },
    runtime: {
      sendMessage,
    },
  };

  return { createDocument, hasDocument, sendMessage };
}

describe("playChime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does no work at all when sound is disabled", async () => {
    const { createDocument, sendMessage } = mockChrome({ soundEnabled: false });
    vi.resetModules();
    const { playChime } = await import("./sound");

    await playChime("reminder");

    expect(createDocument).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("creates the offscreen document exactly once for concurrent calls, but sends both messages", async () => {
    const { createDocument, sendMessage } = mockChrome({ soundEnabled: true });
    vi.resetModules();
    const { playChime } = await import("./sound");

    await Promise.all([playChime("reminder"), playChime("timer")]);

    expect(createDocument).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it("dispatches the correct notes for each tone, and the two payloads differ", async () => {
    const { sendMessage } = mockChrome({ soundEnabled: true });
    vi.resetModules();
    const { playChime } = await import("./sound");

    await playChime("reminder");
    await playChime("timer");

    expect(sendMessage).toHaveBeenNthCalledWith(1, {
      type: "helper.chime",
      notes: chimeNotes("reminder"),
    });
    expect(sendMessage).toHaveBeenNthCalledWith(2, {
      type: "helper.chime",
      notes: chimeNotes("timer"),
    });
    // 比较实际派发的两条消息本身(而非各自重新计算的 chimeNotes),这样如果
    // playChime 出 bug、无论传入什么 tone 都固定派发同一组音符,这里也能测出来。
    const firstNotes = sendMessage.mock.calls[0][0].notes;
    const secondNotes = sendMessage.mock.calls[1][0].notes;
    expect(firstNotes).not.toEqual(secondNotes);
  });

  it("never rejects even when createDocument fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockChrome({
      soundEnabled: true,
      createDocumentImpl: async () => {
        throw new Error("boom");
      },
    });
    vi.resetModules();
    const { playChime } = await import("./sound");

    await expect(playChime("reminder")).resolves.toBeUndefined();
  });
});
