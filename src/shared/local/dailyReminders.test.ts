import { beforeEach, describe, expect, it, vi } from "vitest";
import { localDailyReminders } from "./dailyReminders";

// 只 mock storage;未提供 chrome.alarms → 排程被守卫静默跳过。
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

describe("localDailyReminders", () => {
  beforeEach(() => mockChrome());

  it("creates and lists a daily reminder", async () => {
    const r = await localDailyReminders.create({ message: "喝水", hour: 8, minute: 0 });
    expect(r.id).toBe(1);
    const list = await localDailyReminders.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ message: "喝水", hour: 8, minute: 0 });
    expect(typeof list[0].created_at).toBe("string");
  });

  it("sorts by time of day", async () => {
    await localDailyReminders.create({ message: "晚", hour: 20, minute: 0 });
    await localDailyReminders.create({ message: "早", hour: 7, minute: 30 });
    const list = await localDailyReminders.list();
    expect(list.map((r) => r.message)).toEqual(["早", "晚"]);
  });

  it("removes a daily reminder", async () => {
    const r = await localDailyReminders.create({ message: "吃药", hour: 22, minute: 0 });
    await localDailyReminders.remove(r.id);
    expect(await localDailyReminders.list()).toEqual([]);
  });
});
