import { beforeEach, describe, expect, it, vi } from "vitest";
import { storageGet, storageGetMany, storageSet, storageRemove } from "./storage";

function mockChrome() {
  const data: Record<string, unknown> = {};
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: vi.fn(async (keyOrKeys: string | string[]) => {
          const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
          const out: Record<string, unknown> = {};
          for (const k of keys) out[k] = data[k];
          return out;
        }),
        set: vi.fn(async (obj: Record<string, unknown>) => {
          Object.assign(data, obj);
        }),
        remove: vi.fn(async (key: string) => {
          delete data[key];
        }),
      },
    },
  };
  return data;
}

describe("storage", () => {
  beforeEach(() => mockChrome());

  it("returns null for missing key", async () => {
    expect(await storageGet("nope")).toBeNull();
  });

  it("round-trips a value", async () => {
    await storageSet("k", { a: 1 });
    expect(await storageGet<{ a: number }>("k")).toEqual({ a: 1 });
  });

  it("removes a value", async () => {
    await storageSet("k", "v");
    await storageRemove("k");
    expect(await storageGet("k")).toBeNull();
  });
});

describe("storageGetMany", () => {
  beforeEach(() => mockChrome());

  it("reads multiple keys with a single underlying call", async () => {
    await storageSet("a", 1);
    await storageSet("b", 2);
    const result = await storageGetMany<number>(["a", "b"]);
    expect(result).toEqual({ a: 1, b: 2 });
    expect(chrome.storage.local.get).toHaveBeenCalledTimes(1);
  });

  it("normalises an absent key to null, like storageGet does", async () => {
    await storageSet("a", 1);
    const result = await storageGetMany<number>(["a", "missing"]);
    expect(result).toEqual({ a: 1, missing: null });
  });

  it("returns {} for an empty key list without calling chrome.storage", async () => {
    const result = await storageGetMany(["a"].slice(1));
    expect(result).toEqual({});
    expect(chrome.storage.local.get).not.toHaveBeenCalled();
  });
});
