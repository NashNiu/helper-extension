import type { Todo, TodoImage } from "../api/todo";
import { readList, writeList, nextId } from "./store";
import { storageGet, storageSet, storageRemove } from "../storage";
import { MAX_TODO_IMAGES } from "../images";

const KEY = "helper.local.todos";

// 图片按待办分键存放,不进待办列表本身。
//
// 为什么必须分开:writeList 每次重写整个列表,若把 base64 塞进待办记录,一次勾选完成
// 就要把所有图片重新序列化并写盘。分键后附图只写它自己那一个键。
// 为什么按待办分键而不是一个大 map:大 map 意味着渲染任意一条都要把全部图片读进内存;
// 分键后列表分页是 10 条,只读这 10 个键,天然懒加载。
const IMG_PREFIX = "helper.local.todoImg.";

function imgKey(todoId: number): string {
  return `${IMG_PREFIX}${todoId}`;
}

async function readImages(todoId: number): Promise<TodoImage[]> {
  return (await storageGet<TodoImage[]>(imgKey(todoId))) ?? [];
}

/** 给一页待办补上各自的图片。缺键的待办得到空数组,兼容没有图片的旧数据。 */
async function hydrate(list: Todo[]): Promise<Todo[]> {
  return Promise.all(list.map(async (t) => ({ ...t, images: await readImages(t.id) })));
}

// 与后端一致:按创建时间倒序(新在前),同刻按 id 倒序。
function byCreatedDesc(a: Todo, b: Todo): number {
  return b.created_at.localeCompare(a.created_at) || b.id - a.id;
}

// 已完成按完成时间倒序;done_at 缺失时回退到创建时间。
function byDoneDesc(a: Todo, b: Todo): number {
  return (b.done_at ?? b.created_at).localeCompare(a.done_at ?? a.created_at) || b.id - a.id;
}

export const localTodos = {
  async listActive(offset = 0, limit = 10): Promise<Todo[]> {
    const all = (await readList<Todo>(KEY))
      .filter((t) => !t.is_done)
      .sort(byCreatedDesc);
    return hydrate(all.slice(offset, offset + limit));
  },

  async listDone(offset = 0, limit = 10): Promise<Todo[]> {
    const all = (await readList<Todo>(KEY))
      .filter((t) => t.is_done)
      .sort(byDoneDesc);
    return hydrate(all.slice(offset, offset + limit));
  },

  async create(content: string): Promise<Todo> {
    const list = await readList<Todo>(KEY);
    const todo: Todo = {
      id: nextId(list),
      content,
      is_done: false,
      created_at: new Date().toISOString(),
      done_at: null,
      // 主列表里的 images 只是占位值(新建待办确实没有图片)。它不是图片数据的来源——
      // 真实数据始终在 helper.local.todoImg.<id> 键里;hydrate()/update() 读取时都会
      // 用 readImages() 重新取一遍,不会信任这里存的值。
      images: [],
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
      images: cur.images ?? [],
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.is_done !== undefined
        ? { is_done: data.is_done, done_at: data.is_done ? new Date().toISOString() : null }
        : {}),
    };
    list[idx] = next;
    await writeList(KEY, list);
    // next.images 是主列表里的占位值,从未被 addImages/removeImage 更新过——
    // 返回值必须重新读图片键才是真实数据,否则调用方会看到「明明有图片却返回 0 张」的假象。
    return { ...next, images: await readImages(id) };
  },

  async remove(id: number): Promise<void> {
    const list = await readList<Todo>(KEY);
    await writeList(KEY, list.filter((t) => t.id !== id));
    // 必须级联删除,而且这是正确性问题不是清理问题:nextId 是「当前列表最大 id + 1」,
    // 所以删掉 id 最大的那条后,下一条新建的待办会拿到同一个 id,漏删就会凭空捡到旧图片。
    await storageRemove(imgKey(id));
  },

  async addImages(id: number, dataUrls: string[]): Promise<TodoImage[]> {
    const cur = await readImages(id);
    // 未登录没有后端兜底,这里必须是真正的累计上限检查(已存 + 本次新增),
    // 而不是像 api/todo.ts 那样只能做单批次检查——那边结构上拿不到 cur.length,
    // 这边因为已经在读 readImages(id) 了,天然就有。拒绝而不是截断:截断会
    // 悄悄丢图片且用户不知道;拒绝与后端超限时的行为(抛错)保持一致。
    if (cur.length + dataUrls.length > MAX_TODO_IMAGES) {
      throw new Error(`最多 ${MAX_TODO_IMAGES} 张图片`);
    }
    let nextImgId = cur.reduce((m, x) => Math.max(m, x.id), 0) + 1;
    let nextOrder = cur.reduce((m, x) => Math.max(m, x.sort_order), -1) + 1;
    const added = dataUrls.map((url) => ({ id: nextImgId++, url, sort_order: nextOrder++ }));
    const next = [...cur, ...added];
    await storageSet(imgKey(id), next);
    return next;
  },

  async removeImage(id: number, imageId: number): Promise<TodoImage[]> {
    const next = (await readImages(id)).filter((i) => i.id !== imageId);
    await storageSet(imgKey(id), next);
    return next;
  },
};
