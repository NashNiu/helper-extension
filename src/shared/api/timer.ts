import { apiFetch } from "../http";
import { hasToken } from "../auth";
import { localTimers } from "../local/timers";

export interface Timer {
  id: number;
  name: string;
  duration_seconds: number;
  type: string;
  is_preset: boolean;
  created_at: string;
}

export const timerApi = {
  // 未登录时用内置预设;登录时用后端(注册时种子的)预设。
  list: async () => ((await hasToken()) ? apiFetch<Timer[]>("/api/timers") : localTimers.list()),
  createFromText: (input: string) =>
    apiFetch<Timer>("/api/timers/parse", { method: "POST", json: { input } }),
  create: (name: string, duration_seconds: number) =>
    apiFetch<Timer>("/api/timers", { method: "POST", json: { name, duration_seconds } }),
  remove: (id: number) => apiFetch<void>(`/api/timers/${id}`, { method: "DELETE" }),
};
