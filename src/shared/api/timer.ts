import { apiFetch } from "../http";

export interface Timer {
  id: number;
  name: string;
  duration_seconds: number;
  type: string;
  is_preset: boolean;
  created_at: string;
}

export const timerApi = {
  list: () => apiFetch<Timer[]>("/api/timers"),
  createFromText: (input: string) =>
    apiFetch<Timer>("/api/timers/parse", { method: "POST", json: { input } }),
  create: (name: string, duration_seconds: number) =>
    apiFetch<Timer>("/api/timers", { method: "POST", json: { name, duration_seconds } }),
  remove: (id: number) => apiFetch<void>(`/api/timers/${id}`, { method: "DELETE" }),
};
