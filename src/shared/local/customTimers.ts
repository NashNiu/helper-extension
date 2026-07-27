import type { Timer } from "../api/timer";
import { readList, writeList } from "./store";

export interface CustomTimer {
  id: number;
  name: string;
  kind: "countdown" | "focus";
  workSeconds: number;   // countdown = 倒计时时长;focus = 工作时长
  breakSeconds: number;  // focus 用;countdown = 0
  defaultCycles: number; // focus 用;countdown = 1
  created_at: string;
}

const KEY = "helper.local.customTimers";

// 本地 id 从 -100 递减,避开内置预设 -1..-5,删除后不复用。
export function nextCustomId(list: CustomTimer[]): number {
  return list.reduce((min, x) => Math.min(min, x.id), -99) - 1;
}

// 自定义计时器 → 网格用的 Timer;focus 额外带 breakSeconds/cycles。
export function customTimerToTimer(c: CustomTimer): Timer {
  return {
    id: c.id,
    name: c.name,
    duration_seconds: c.workSeconds,
    type: c.kind,
    is_preset: false,
    created_at: c.created_at,
    ...(c.kind === "focus" ? { breakSeconds: c.breakSeconds, cycles: c.defaultCycles } : {}),
  };
}

export const localCustomTimers = {
  // id 降序 = 先建(id 更大,如 -100)在前。
  async list(): Promise<CustomTimer[]> {
    return (await readList<CustomTimer>(KEY)).sort((a, b) => b.id - a.id);
  },

  async create(data: {
    name: string;
    kind: "countdown" | "focus";
    workSeconds: number;
    breakSeconds: number;
    defaultCycles: number;
  }): Promise<CustomTimer> {
    const list = await readList<CustomTimer>(KEY);
    const timer: CustomTimer = { id: nextCustomId(list), ...data, created_at: new Date().toISOString() };
    await writeList(KEY, [...list, timer]);
    return timer;
  },

  async remove(id: number): Promise<void> {
    const list = await readList<CustomTimer>(KEY);
    await writeList(KEY, list.filter((c) => c.id !== id));
  },
};
