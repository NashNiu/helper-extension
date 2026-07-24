import type { Timer } from "../api/timer";

// 未登录时的内置计时预设。负 id 与后端(正 id)不冲突;计时运行本就纯本地。
export const LOCAL_TIMER_PRESETS: Timer[] = [
  { id: -1, name: "番茄钟", duration_seconds: 25 * 60, type: "focus", is_preset: true, created_at: "" },
  { id: -4, name: "52/17 法则", duration_seconds: 52 * 60, type: "focus", is_preset: true, created_at: "" },
  { id: -2, name: "短休息", duration_seconds: 5 * 60, type: "break", is_preset: true, created_at: "" },
  { id: -3, name: "长休息", duration_seconds: 15 * 60, type: "break", is_preset: true, created_at: "" },
];

export const localTimers = {
  list(): Promise<Timer[]> {
    return Promise.resolve(LOCAL_TIMER_PRESETS);
  },
};
