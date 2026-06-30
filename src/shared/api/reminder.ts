import { apiFetch } from "../http";

export interface Reminder {
  id: number;
  message: string;
  trigger_at: string;
  is_triggered: boolean;
  created_at: string;
}

export const reminderApi = {
  list: () => apiFetch<Reminder[]>("/api/reminders"),
  listPending: () => apiFetch<Reminder[]>("/api/reminders?triggered=false"),
  create: (input: string) =>
    apiFetch<Reminder>("/api/reminders", { method: "POST", json: { input } }),
  markTriggered: (id: number) =>
    apiFetch<Reminder>(`/api/reminders/${id}/triggered`, { method: "PATCH" }),
  update: (id: number, data: { message?: string; trigger_at?: string }) =>
    apiFetch<Reminder>(`/api/reminders/${id}`, { method: "PATCH", json: data }),
  remove: (id: number) => apiFetch<void>(`/api/reminders/${id}`, { method: "DELETE" }),
};
