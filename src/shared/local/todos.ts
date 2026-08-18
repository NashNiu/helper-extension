import type { Todo, TodoImage } from "../api/todo";
import { readList, writeList, nextId } from "./store";
import { storageGet, storageGetMany, storageSet, storageRemove } from "../storage";
import { MAX_TODO_IMAGES } from "../images";
import { TODO_REMIND_ALARM_PREFIX } from "../../background/logic";

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

/**
 * 分类筛选的三态:undefined = 不筛,'none' = 只要未分类,数字 = 只要该分类。
 * 与后端 TodoService.findAll 的 categoryId 参数同语义。
 */
export type CategoryFilter = number | "none";

/**
 * 本次改动之前存下的待办没有 category_id 字段,读出来是 undefined。
 * 统一归一成 null,否则老数据既进不了「未分类」的筛选结果,类型上也在说谎。
 */
function categoryOf(t: Todo): number | null {
  return t.category_id ?? null;
}

function matchesCategory(t: Todo, filter?: CategoryFilter): boolean {
  if (filter === undefined) return true;
  const id = categoryOf(t);
  return filter === "none" ? id === null : id === filter;
}

/**
 * 给一页待办补上各自的图片。缺键的待办得到空数组,兼容没有图片的旧数据。
 *
 * 一次 storageGetMany 批量读全部图片键,而不是每条待办各发一次 chrome.storage.local.get——
 * 未登录用户翻一页待办列表本来就要走这里,逐条读会让每页固定付 10 次 IPC,哪怕这页
 * 一张图片都没有(比如个人中心的已完成历史,从不展示图片)。
 */
async function hydrate(list: Todo[]): Promise<Todo[]> {
  if (list.length === 0) return list;
  const keys = list.map((t) => imgKey(t.id));
  const images = await storageGetMany<TodoImage[]>(keys);
  return list.map((t) => ({
    ...t,
    images: images[imgKey(t.id)] ?? [],
    category_id: categoryOf(t),
  }));
}

// 与后端一致:按创建时间倒序(新在前),同刻按 id 倒序。
function byCreatedDesc(a: Todo, b: Todo): number {
  return b.created_at.localeCompare(a.created_at) || b.id - a.id;
}

// 已完成按完成时间倒序;done_at 缺失时回退到创建时间。
function byDoneDesc(a: Todo, b: Todo): number {
  return (b.done_at ?? b.created_at).localeCompare(a.done_at ?? a.created_at) || b.id - a.id;
}

// 在扩展页面/SW 中都可用;测试等无 chrome.alarms 环境下静默跳过。
function scheduleAlarm(t: Todo): void {
  try {
    if (!t.remind_at || t.remind_triggered || t.is_done) return;
    const when = Date.parse(t.remind_at);
    if (Number.isNaN(when)) return;
    if (typeof chrome !== "undefined" && chrome.alarms) {
      chrome.alarms.create(`${TODO_REMIND_ALARM_PREFIX}${t.id}`, { when });
    }
  } catch {
    /* 忽略排程失败,心跳会兜底重排 */
  }
}

function clearAlarm(id: number): void {
  try {
    if (typeof chrome !== "undefined" && chrome.alarms) {
      chrome.alarms.clear(`${TODO_REMIND_ALARM_PREFIX}${id}`);
    }
  } catch {
    /* 忽略 */
  }
}

// 待触发排序:与后端 findRemindPending 一致,按提醒时间正序(近的在前)。
function byRemindAsc(a: Todo, b: Todo): number {
  return (a.remind_at ?? "").localeCompare(b.remind_at ?? "") || a.id - b.id;
}

export const localTodos = {
  async listActive(offset = 0, limit = 10, category?: CategoryFilter): Promise<Todo[]> {
    // 先筛后分页,与后端把 category_id 放进 where、再 take/skip 的顺序一致。
    // 反过来的话每页都会少几条,越翻越对不上。
    const all = (await readList<Todo>(KEY))
      .filter((t) => !t.is_done && matchesCategory(t, category))
      .sort(byCreatedDesc);
    return hydrate(all.slice(offset, offset + limit));
  },

  async listDone(offset = 0, limit = 10): Promise<Todo[]> {
    const all = (await readList<Todo>(KEY))
      .filter((t) => t.is_done)
      .sort(byDoneDesc);
    return hydrate(all.slice(offset, offset + limit));
  },

  async create(content: string, remindAt?: string, categoryId?: number | null): Promise<Todo> {
    const list = await readList<Todo>(KEY);
    const todo: Todo = {
      id: nextId(list),
      content,
      is_done: false,
      created_at: new Date().toISOString(),
      done_at: null,
      remind_at: remindAt ?? null,
      remind_triggered: false,
      category_id: categoryId ?? null,
      // 主列表里的 images 只是占位值(新建待办确实没有图片)。它不是图片数据的来源——
      // 真实数据始终在 helper.local.todoImg.<id> 键里;hydrate()/update() 读取时都会
      // 用 readImages() 重新取一遍,不会信任这里存的值。
      images: [],
    };
    await writeList(KEY, [...list, todo]);
    scheduleAlarm(todo);
    return todo;
  },

  async update(
    id: number,
    data: {
      content?: string;
      is_done?: boolean;
      remind_at?: string | null;
      category_id?: number | null;
    },
  ): Promise<Todo> {
    const list = await readList<Todo>(KEY);
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error(`local todo ${id} not found`);
    const cur = list[idx];
    const next: Todo = {
      ...cur,
      images: cur.images ?? [],
      remind_at: cur.remind_at ?? null,
      remind_triggered: cur.remind_triggered ?? false,
      category_id: categoryOf(cur),
      ...(data.content !== undefined ? { content: data.content } : {}),
      // 与 remind_at 一样的三态:缺省 = 不变,null = 清空,数字 = 改分类。
      ...(data.category_id !== undefined ? { category_id: data.category_id } : {}),
    };

    // 未登录时这里就是后端。以下四条规则必须与 backend/src/todo/todo.service.ts
    // 的 update 完全一致——两个存储后端，同一套语义。改一边必须改另一边。
    //
    // 顺序要紧:remind_at 先处理(它会把 remind_triggered 置回 false),
    // is_done=true 随后覆盖它——同一次操作里既设时间又勾完成，用户的意思是办完了。
    if (data.remind_at !== undefined) {
      next.remind_at = data.remind_at;
      next.remind_triggered = false;
    }
    if (data.is_done !== undefined) {
      next.is_done = data.is_done;
      next.done_at = data.is_done ? new Date().toISOString() : null;
      if (data.is_done) {
        next.remind_triggered = true;
      } else if (next.remind_at && Date.parse(next.remind_at) > Date.now()) {
        next.remind_triggered = false;
      }
    }

    list[idx] = next;
    await writeList(KEY, list);

    // 闹钟跟着状态走:该响的补上,不该响的撤掉。
    clearAlarm(id);
    scheduleAlarm(next);

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
    clearAlarm(id);
  },

  async markRemindTriggered(id: number): Promise<Todo> {
    const list = await readList<Todo>(KEY);
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error(`local todo ${id} not found`);
    list[idx] = { ...list[idx], remind_triggered: true };
    await writeList(KEY, list);
    clearAlarm(id);
    return list[idx];
  },

  /**
   * 调度用的列表:未完成、设了提醒、还没弹过的,按提醒时间正序。
   *
   * 刻意不走 hydrate():这个查询被心跳每分钟调一次,而未登录的图片是 base64,
   * hydrate 会把它们全读进内存——调度根本不需要图片。
   */
  async listRemindPending(): Promise<Todo[]> {
    return (await readList<Todo>(KEY))
      .filter((t) => !t.is_done && !t.remind_triggered && !!t.remind_at)
      .sort(byRemindAsc)
      .map((t) => ({ ...t, images: [], category_id: categoryOf(t) }));
  },

  /**
   * 把所有引用某分类的待办置为未分类。删分类时由 localTodoCategories.remove 调用,
   * 对应后端的 onDelete: 'SET NULL'。刻意做成一次全表重写而不是逐条 update:
   * update 会顺带重排闹钟并重读图片键,而改分类跟提醒、图片都不相干。
   */
  async clearCategory(categoryId: number): Promise<void> {
    const list = await readList<Todo>(KEY);
    if (!list.some((t) => categoryOf(t) === categoryId)) return;
    await writeList(
      KEY,
      list.map((t) => (categoryOf(t) === categoryId ? { ...t, category_id: null } : t)),
    );
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
    // 删完之后一张不剩就把整个键删掉,而不是留一个 `[]`——留着不影响读取(缺键本来就
    // 归一成 []),但会在 DevTools 里显示成一个空的 todoImg 键,看着像级联删除漏了一步。
    if (next.length === 0) {
      await storageRemove(imgKey(id));
    } else {
      await storageSet(imgKey(id), next);
    }
    return next;
  },
};
