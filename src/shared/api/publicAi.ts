import { apiFetch } from "../http";
import type { AssistantType } from "./classify";

/**
 * 匿名 AI 解析接口(后端公开、受限流),供未登录时使用。
 * 只解析、不落库;拿到结果后由调用方写入本地。
 */
export const publicAiApi = {
  classify: (input: string) =>
    apiFetch<{ types: AssistantType[] }>("/api/public/classify", {
      method: "POST",
      json: { input },
    }),
  parseReminder: (input: string) =>
    apiFetch<{ message: string; trigger_at: string }>("/api/public/parse-reminder", {
      method: "POST",
      json: { input },
    }),
  parseTimer: (input: string) =>
    apiFetch<{ name: string; duration_seconds: number }>("/api/public/parse-timer", {
      method: "POST",
      json: { input },
    }),
};
