import { apiFetch } from "../http";
import { hasToken } from "../auth";
import { localReminders } from "../local/reminders";

export interface Reminder {
  id: number;
  message: string;
  trigger_at: string;
  is_triggered: boolean;
  created_at: string;
}

/**
 * 登录时走后端(含 AI 自然语言解析),未登录时走本地。
 * `create` 是登录态专用的 AI 解析入口;未登录用 `createManual`(手动填时间)。
 */
export const reminderApi = {
  list: () => apiFetch<Reminder[]>("/api/reminders"),
  listPending: async (offset = 0, limit = 10) =>
    (await hasToken())
      ? apiFetch<Reminder[]>(`/api/reminders?triggered=false&limit=${limit}&offset=${offset}`)
      : localReminders.listPending(offset, limit),
  /** 登录态:自然语言 → 后端 AI 解析创建。 */
  create: (input: string) =>
    apiFetch<Reminder>("/api/reminders", { method: "POST", json: { input } }),
  /** 未登录态:手动指定内容与时间,写入本地并排程通知。 */
  createManual: (data: { message: string; trigger_at: string }) =>
    localReminders.create(data),
  markTriggered: async (id: number) =>
    (await hasToken())
      ? apiFetch<Reminder>(`/api/reminders/${id}/triggered`, { method: "PATCH" })
      : localReminders.markTriggered(id),
  update: (id: number, data: { message?: string; trigger_at?: string }) =>
    apiFetch<Reminder>(`/api/reminders/${id}`, { method: "PATCH", json: data }),
  remove: async (id: number) =>
    (await hasToken())
      ? apiFetch<void>(`/api/reminders/${id}`, { method: "DELETE" })
      : localReminders.remove(id),
};
