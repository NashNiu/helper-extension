import { beforeEach, describe, expect, it, vi } from "vitest";
import { storageGet, storageSet, storageRemove } from "./storage";

function mockChrome() {
  const data: Record<string, unknown> = {};
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: data[key] })),
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
