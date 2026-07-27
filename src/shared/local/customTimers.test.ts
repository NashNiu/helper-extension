import { beforeEach, describe, expect, it, vi } from "vitest";
import { localCustomTimers, nextCustomId, customTimerToTimer, type CustomTimer } from "./customTimers";

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

const base = (over: Partial<CustomTimer> = {}): CustomTimer => ({
  id: -100, name: "t", kind: "countdown", workSeconds: 600, breakSeconds: 0, defaultCycles: 1, created_at: "x", ...over,
});

describe("nextCustomId", () => {
  it("starts at -100 and decreases without reuse", () => {
    expect(nextCustomId([])).toBe(-100);
    expect(nextCustomId([base({ id: -100 })])).toBe(-101);
    expect(nextCustomId([base({ id: -100 }), base({ id: -101 })])).toBe(-102);
  });
});

describe("customTimerToTimer", () => {
  it("maps a countdown (no focus fields)", () => {
    const c = base({ id: -100, name: "泡面", kind: "countdown", workSeconds: 180 });
    expect(customTimerToTimer(c)).toEqual({
      id: -100, name: "泡面", duration_seconds: 180, type: "countdown", is_preset: false, created_at: "x",
    });
  });
  it("maps a focus (carries breakSeconds + cycles)", () => {
    const c = base({ id: -101, name: "深工", kind: "focus", workSeconds: 3000, breakSeconds: 600, defaultCycles: 3 });
    expect(customTimerToTimer(c)).toEqual({
      id: -101, name: "深工", duration_seconds: 3000, type: "focus", is_preset: false, created_at: "x",
      breakSeconds: 600, cycles: 3,
    });
  });
});

describe("localCustomTimers", () => {
  beforeEach(() => mockChrome());

  it("creates with a decreasing id and lists newest-first (id desc)", async () => {
    const a = await localCustomTimers.create({ name: "a", kind: "countdown", workSeconds: 60, breakSeconds: 0, defaultCycles: 1 });
    const b = await localCustomTimers.create({ name: "b", kind: "focus", workSeconds: 120, breakSeconds: 60, defaultCycles: 2 });
    expect(a.id).toBe(-100);
    expect(b.id).toBe(-101);
    const list = await localCustomTimers.list();
    expect(list.map((c) => c.name)).toEqual(["a", "b"]); // id desc: -100 before -101
  });

  it("removes by id", async () => {
    const a = await localCustomTimers.create({ name: "a", kind: "countdown", workSeconds: 60, breakSeconds: 0, defaultCycles: 1 });
    await localCustomTimers.remove(a.id);
    expect(await localCustomTimers.list()).toEqual([]);
  });
});
