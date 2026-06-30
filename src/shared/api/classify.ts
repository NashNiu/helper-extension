import { apiFetch } from "../http";

export type AssistantType = "reminder" | "timer" | "todo" | "finance";

export const classifyApi = {
  classify: (input: string) =>
    apiFetch<{ types: AssistantType[] }>("/api/classify", { method: "POST", json: { input } }),
};
