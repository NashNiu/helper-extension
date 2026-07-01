import { apiFetch } from "../http";
import { hasToken } from "../auth";
import { localTodos } from "../local/todos";

export interface Todo {
  id: number;
  content: string;
  is_done: boolean;
  created_at: string;
  done_at: string | null;
}

function remoteCreate(content: string): Promise<Todo> {
  const fd = new FormData();
  fd.append("content", content);
  return apiFetch<Todo>("/api/todos", { method: "POST", body: fd });
}

/**
 * 登录时走后端,未登录时走本地(chrome.storage.local)。
 * 调用处签名不变,自动按登录态分流。
 */
export const todoApi = {
  list: async () =>
    (await hasToken()) ? apiFetch<Todo[]>("/api/todos") : localTodos.listActive(0, 1000),
  /** 仅未完成的待办,分页拉取。 */
  listActive: async (offset = 0, limit = 10) =>
    (await hasToken())
      ? apiFetch<Todo[]>(`/api/todos?done=false&limit=${limit}&offset=${offset}`)
      : localTodos.listActive(offset, limit),
  /** 已完成的待办(个人中心历史),按完成时间倒序,分页拉取。 */
  listDone: async (offset = 0, limit = 10) =>
    (await hasToken())
      ? apiFetch<Todo[]>(`/api/todos?done=true&limit=${limit}&offset=${offset}`)
      : localTodos.listDone(offset, limit),
  create: async (content: string) =>
    (await hasToken()) ? remoteCreate(content) : localTodos.create(content),
  update: async (id: number, data: { content?: string; is_done?: boolean }) =>
    (await hasToken())
      ? apiFetch<Todo>(`/api/todos/${id}`, { method: "PATCH", json: data })
      : localTodos.update(id, data),
  remove: async (id: number) =>
    (await hasToken())
      ? apiFetch<void>(`/api/todos/${id}`, { method: "DELETE" })
      : localTodos.remove(id),
};
