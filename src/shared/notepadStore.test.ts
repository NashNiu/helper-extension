import { beforeEach, describe, expect, it, vi } from "vitest";
import { clampNote, getNote, saveNote, NOTE_MAX_CHARS } from "./notepadStore";

function mockChrome() {
  const data: Record<string, unknown> = {};
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: data[key] })),
        set: vi.fn(async (obj: Record<string, unknown>) => { Object.assign(data, obj); }),
        remove: vi.fn(async (key: string) => { delete data[key]; }),
      },
    },
  };
  return data;
}

describe("clampNote", () => {
  it("returns short text unchanged", () => {
    expect(clampNote("hello")).toBe("hello");
  });
  it("returns text exactly at the limit unchanged", () => {
    const s = "a".repeat(NOTE_MAX_CHARS);
    expect(clampNote(s)).toBe(s);
  });
  it("truncates text over the limit to NOTE_MAX_CHARS", () => {
    const s = "a".repeat(NOTE_MAX_CHARS + 100);
    expect(clampNote(s).length).toBe(NOTE_MAX_CHARS);
  });
});

describe("getNote / saveNote", () => {
  beforeEach(() => { mockChrome(); });

  it("returns empty note when nothing is stored", async () => {
    expect(await getNote()).toEqual({ content: "", updatedAt: 0 });
  });

  it("saves and reads back content with updatedAt = now", async () => {
    const saved = await saveNote("draft", 1234);
    expect(saved).toEqual({ content: "draft", updatedAt: 1234 });
    expect(await getNote()).toEqual({ content: "draft", updatedAt: 1234 });
  });

  it("clamps overly long content before saving", async () => {
    const long = "a".repeat(NOTE_MAX_CHARS + 50);
    const saved = await saveNote(long, 5);
    expect(saved.content.length).toBe(NOTE_MAX_CHARS);
    expect((await getNote()).content.length).toBe(NOTE_MAX_CHARS);
  });
});
