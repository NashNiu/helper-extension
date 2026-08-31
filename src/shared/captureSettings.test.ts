import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getEntries,
  setEntry,
  isEntryEnabled,
  SHOT_ENTRIES_KEY,
  DEFAULT_ENTRIES,
} from "./captureSettings";

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

describe("captureSettings", () => {
  let data: Record<string, unknown>;
  beforeEach(() => {
    data = mockChrome();
  });

  it("未设置过时三个入口都开", async () => {
    expect(await getEntries()).toEqual({ sidePanel: true, contextMenu: true, shortcut: true });
  });

  it("DEFAULT_ENTRIES 就是全开", () => {
    expect(DEFAULT_ENTRIES).toEqual({ sidePanel: true, contextMenu: true, shortcut: true });
  });

  it("关掉一个不影响另外两个", async () => {
    await setEntry("contextMenu", false);
    expect(await getEntries()).toEqual({ sidePanel: true, contextMenu: false, shortcut: true });
  });

  it("存过的 false 不会被默认值吃掉", async () => {
    await setEntry("shortcut", false);
    expect(await isEntryEnabled("shortcut")).toBe(false);
  });

  it("关掉再打开读回 true", async () => {
    await setEntry("sidePanel", false);
    await setEntry("sidePanel", true);
    expect(await isEntryEnabled("sidePanel")).toBe(true);
  });

  it("写在约定的 storage key 上", async () => {
    await setEntry("shortcut", false);
    expect(data[SHOT_ENTRIES_KEY]).toEqual({ sidePanel: true, contextMenu: true, shortcut: false });
  });

  it("存量数据缺字段时按默认值补齐，不返回 undefined", async () => {
    data[SHOT_ENTRIES_KEY] = { contextMenu: false };
    expect(await getEntries()).toEqual({ sidePanel: true, contextMenu: false, shortcut: true });
  });
});
