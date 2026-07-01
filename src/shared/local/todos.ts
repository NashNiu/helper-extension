import type { Todo } from "../api/todo";
import { readList, writeList, nextId } from "./store";

const KEY = "helper.local.todos";

// 与后端一致:按创建时间倒序(新在前),同刻按 id 倒序。
function byCreatedDesc(a: Todo, b: Todo): number {
  return b.created_at.localeCompare(a.created_at) || b.id - a.id;
}

export const localTodos = {
  async listActive(offset = 0, limit = 10): Promise<Todo[]> {
    const all = (await readList<Todo>(KEY))
      .filter((t) => !t.is_done)
      .sort(byCreatedDesc);
    return all.slice(offset, offset + limit);
  },

  async create(content: string): Promise<Todo> {
    const list = await readList<Todo>(KEY);
    const todo: Todo = {
      id: nextId(list),
      content,
      is_done: false,
      created_at: new Date().toISOString(),
      done_at: null,
    };
    await writeList(KEY, [...list, todo]);
    return todo;
  },

  async update(
    id: number,
    data: { content?: string; is_done?: boolean },
  ): Promise<Todo> {
    const list = await readList<Todo>(KEY);
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error(`local todo ${id} not found`);
    const cur = list[idx];
    const next: Todo = {
      ...cur,
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.is_done !== undefined
        ? { is_done: data.is_done, done_at: data.is_done ? new Date().toISOString() : null }
        : {}),
    };
    list[idx] = next;
    await writeList(KEY, list);
    return next;
  },

  async remove(id: number): Promise<void> {
    const list = await readList<Todo>(KEY);
    await writeList(KEY, list.filter((t) => t.id !== id));
  },
};
