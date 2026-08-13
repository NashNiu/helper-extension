import { apiFetch, ApiError } from "../http";
import { hasToken } from "../auth";
import { localTodoCategories, CategoryNameTakenError } from "../local/todoCategories";

// 见 local/todoCategories.ts 里的说明:这两个符号定义在那边、从这里重新导出,
// 是为了避开一个真实的运行时循环依赖。
export { MAX_CATEGORY_NAME, CategoryNameTakenError } from "../local/todoCategories";

export interface TodoCategory {
  id: number;
  name: string;
}

/**
 * 是不是「分类名已被占用」。登录态是后端的 409,未登录是本地抛的
 * CategoryNameTakenError——UI 只关心撞没撞名,不该关心自己在哪条路径上。
 */
export function isNameTakenError(e: unknown): boolean {
  return (
    e instanceof CategoryNameTakenError || (e instanceof ApiError && e.status === 409)
  );
}

/**
 * 登录时走后端 /api/todo-categories,未登录时走本地(chrome.storage.local)。
 * 与 api/todo.ts 同构:调用处签名不变,自动按登录态分流。
 */
export const todoCategoryApi = {
  list: async (): Promise<TodoCategory[]> =>
    (await hasToken())
      ? apiFetch<TodoCategory[]>("/api/todo-categories")
      : localTodoCategories.list(),

  create: async (name: string): Promise<TodoCategory> =>
    (await hasToken())
      ? apiFetch<TodoCategory>("/api/todo-categories", {
          method: "POST",
          json: { name },
        })
      : localTodoCategories.create(name),

  rename: async (id: number, name: string): Promise<TodoCategory> =>
    (await hasToken())
      ? apiFetch<TodoCategory>(`/api/todo-categories/${id}`, {
          method: "PATCH",
          json: { name },
        })
      : localTodoCategories.rename(id, name),

  /**
   * 删除分类。两条路径都只删分类本身,引用它的待办被置为未分类——
   * 后端靠 onDelete: 'SET NULL',本地靠 localTodoCategories.remove 里的级联。
   */
  remove: async (id: number): Promise<void> =>
    (await hasToken())
      ? apiFetch<void>(`/api/todo-categories/${id}`, { method: "DELETE" })
      : localTodoCategories.remove(id),
};
