import { describe, expect, it, vi, beforeEach } from "vitest";

const store: Record<string, unknown> = {};
vi.mock("../storage", () => ({
  storageGet: vi.fn(async (k: string) => (k in store ? store[k] : null)),
  storageSet: vi.fn(async (k: string, v: unknown) => { store[k] = v; }),
  storageRemove: vi.fn(async (k: string) => { delete store[k]; }),
}));

import { getKey, setKey, clearKey, DEEPSEEK_KEY_STORAGE_KEY } from "./apiKey";

describe("apiKey store", () => {
  beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; });

  it("returns empty string when unset", async () => {
    expect(await getKey()).toBe("");
  });
  it("round-trips a key", async () => {
    await setKey("sk-abc");
    expect(store[DEEPSEEK_KEY_STORAGE_KEY]).toBe("sk-abc");
    expect(await getKey()).toBe("sk-abc");
  });
  it("clears a key", async () => {
    await setKey("sk-abc");
    await clearKey();
    expect(await getKey()).toBe("");
  });
});
