import { beforeEach, describe, expect, it, vi } from "vitest";
import { isSoundEnabled, setSoundEnabled, SOUND_KEY } from "./soundSettings";

function mockChrome() {
  const data: Record<string, unknown> = {};
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: data[key] })),
        set: vi.fn(async (obj: Record<string, unknown>) => {
          Object.assign(data, obj);
        }),
      },
    },
  };
  return data;
}

describe("soundSettings", () => {
  let data: Record<string, unknown>;
  beforeEach(() => {
    data = mockChrome();
  });

  it("未设置过时默认开", async () => {
    expect(await isSoundEnabled()).toBe(true);
  });

  it("关掉后读回 false", async () => {
    await setSoundEnabled(false);
    expect(await isSoundEnabled()).toBe(false);
  });

  it("关掉再打开后读回 true", async () => {
    await setSoundEnabled(false);
    await setSoundEnabled(true);
    expect(await isSoundEnabled()).toBe(true);
  });

  it("写在约定的 storage key 上", async () => {
    await setSoundEnabled(false);
    expect(data[SOUND_KEY]).toBe(false);
  });
});
