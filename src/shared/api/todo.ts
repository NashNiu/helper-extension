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
  /** 仅未完成的待办，分页拉取（后端过滤，减少传输）。 */
  listActive: (offset = 0, limit = 10) =>
    apiFetch<Todo[]>(`/api/todos?done=false&limit=${limit}&offset=${offset}`),
  create: (content: string) => {
    const fd = new FormData();
    fd.append("content", content);
    return apiFetch<Todo>("/api/todos", { method: "POST", body: fd });
  },
  update: (id: number, data: { content?: string; is_done?: boolean }) =>
    apiFetch<Todo>(`/api/todos/${id}`, { method: "PATCH", json: data }),
  remove: (id: number) => apiFetch<void>(`/api/todos/${id}`, { method: "DELETE" }),
};
