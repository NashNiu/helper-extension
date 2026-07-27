import { beforeEach, describe, expect, it, vi } from "vitest";
import { localTimers, LOCAL_TIMER_PRESETS } from "./timers";
import { localCustomTimers } from "./customTimers";

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
}

describe("localTimers.list", () => {
  beforeEach(() => mockChrome());

  it("returns only built-in presets when there are no custom timers", async () => {
    expect(await localTimers.list()).toEqual(LOCAL_TIMER_PRESETS);
  });

  it("appends custom timers (mapped to Timer) after the presets", async () => {
    await localCustomTimers.create({ name: "泡面", kind: "countdown", workSeconds: 180, breakSeconds: 0, defaultCycles: 1 });
    const list = await localTimers.list();
    expect(list.length).toBe(LOCAL_TIMER_PRESETS.length + 1);
    const custom = list[list.length - 1];
    expect(custom).toMatchObject({ name: "泡面", duration_seconds: 180, type: "countdown", is_preset: false });
  });
});
