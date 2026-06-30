import { apiFetch } from "../http";

export interface Todo {
  id: number;
  content: string;
  is_done: boolean;
  created_at: string;
  done_at: string | null;
}

export const todoApi = {
  list: () => apiFetch<Todo[]>("/api/todos"),
  create: (content: string) => {
    const fd = new FormData();
    fd.append("content", content);
    return apiFetch<Todo>("/api/todos", { method: "POST", body: fd });
  },
  update: (id: number, data: { content?: string; is_done?: boolean }) =>
    apiFetch<Todo>(`/api/todos/${id}`, { method: "PATCH", json: data }),
  remove: (id: number) => apiFetch<void>(`/api/todos/${id}`, { method: "DELETE" }),
};
