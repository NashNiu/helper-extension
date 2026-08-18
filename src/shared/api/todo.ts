import { apiFetch } from "../http";
import { hasToken } from "../auth";
import { localTodos, type CategoryFilter } from "../local/todos";
import { blobToDataUrl, MAX_TODO_IMAGES } from "../images";

export type { CategoryFilter };

// 在这里重新导出,是因为「待办图片数上限」属于待办 API 的对外接口,调用方应该能从
// api/todo.ts 直接拿到它;常量本身却定义在 images.ts 里,是为了避开一个运行时循环
// 依赖——api/todo.ts 以值的方式导入 localTodos,如果反过来在 api/todo.ts 里定义这个
// 常量再被 local/todos.ts 当值导入,就会在两者之间闭合出一个真实的循环。
export { MAX_TODO_IMAGES };

export interface TodoImage {
  id: number;
  url: string;       // 已登录 = Supabase 公开 URL;未登录 = dataUrl
  sort_order: number;
}

export interface Todo {
  id: number;
  content: string;
  is_done: boolean;
  created_at: string;
  done_at: string | null;
  images: TodoImage[];
  // 缺省视为 null / false，兼容本次之前存下的本地数据
  remind_at: string | null;
  remind_triggered: boolean;
  // 只存 id，不存分类名。名字由 UI 从分类列表里查——存一份快照的话，
  // 重命名分类后列表里的旧待办会一直显示改名前的名字。
  category_id: number | null;
}

// 后端返回的原始形状:图片字段叫 image_path,值是 Supabase 的完整公开 URL。
interface RemoteTodoImage {
  id: number;
  image_path: string;
  sort_order: number;
}
type RemoteTodo = Omit<Todo, "images" | "category_id"> & {
  images?: RemoteTodoImage[];
  // 后端同时返回列名 category_id 和 relations: ['category'] 展开的关联对象。
  category_id?: number | null;
  category?: { id: number; name: string } | null;
};

/**
 * 把后端形状归一成 UI 用的形状:image_path → url,category 关联对象 → category_id。
 * 这样 TodoView 完全不需要知道自己在登录态还是本地态,两边都是 img.url + category_id。
 */
function fromRemote(t: RemoteTodo): Todo {
  return {
    ...t,
    images: (t.images ?? [])
      .map((i) => ({ id: i.id, url: i.image_path, sort_order: i.sort_order }))
      .sort((a, b) => a.sort_order - b.sort_order),
    // 列名优先,没有列名时从关联对象取——两者都缺(比如旧版后端)就是未分类。
    category_id: t.category_id ?? t.category?.id ?? null,
  };
}

async function remoteCreate(
  content: string,
  remindAt?: string,
  categoryId?: number | null,
): Promise<Todo> {
  const fd = new FormData();
  fd.append("content", content);
  if (remindAt !== undefined) fd.append("remind_at", remindAt);
  // null 表示不分类,不传即可——CreateTodoDto 的 category_id 是可选的,
  // 传一个空串反而会撞上 @IsInt 校验。
  if (categoryId != null) fd.append("category_id", String(categoryId));
  return fromRemote(await apiFetch<RemoteTodo>("/api/todos", { method: "POST", body: fd }));
}

/** 把分类筛选拼成查询串片段;不筛时为空。 */
function categoryQuery(category?: CategoryFilter): string {
  return category === undefined ? "" : `&category_id=${category}`;
}

/**
 * 登录时走后端,未登录时走本地(chrome.storage.local)。
 * 调用处签名不变,自动按登录态分流。
 */
export const todoApi = {
  list: async () =>
    (await hasToken())
      ? (await apiFetch<RemoteTodo[]>("/api/todos")).map(fromRemote)
      : localTodos.listActive(0, 1000),
  /**
   * 仅未完成的待办,分页拉取,可按分类筛选。
   *
   * 注意:category_id 是后端较晚才加的查询参数。连到尚未部署该参数的后端时,
   * 它会被忽略并返回未筛选的整页——不报错但结果不对,所以后端要先上线。
   */
  listActive: async (offset = 0, limit = 10, category?: CategoryFilter) =>
    (await hasToken())
      ? (
          await apiFetch<RemoteTodo[]>(
            `/api/todos?done=false&limit=${limit}&offset=${offset}${categoryQuery(category)}`,
          )
        ).map(fromRemote)
      : localTodos.listActive(offset, limit, category),
  /** 已完成的待办(个人中心历史),按完成时间倒序,分页拉取。 */
  listDone: async (offset = 0, limit = 10) =>
    (await hasToken())
      ? (await apiFetch<RemoteTodo[]>(`/api/todos?done=true&limit=${limit}&offset=${offset}`)).map(fromRemote)
      : localTodos.listDone(offset, limit),
  create: async (content: string, remindAt?: string, categoryId?: number | null) =>
    (await hasToken())
      ? remoteCreate(content, remindAt, categoryId)
      : localTodos.create(content, remindAt, categoryId),
  update: async (
    id: number,
    data: {
      content?: string;
      is_done?: boolean;
      remind_at?: string | null;
      category_id?: number | null;
    },
  ) =>
    (await hasToken())
      ? fromRemote(await apiFetch<RemoteTodo>(`/api/todos/${id}`, { method: "PATCH", json: data }))
      : localTodos.update(id, data),
  remove: async (id: number) =>
    (await hasToken())
      ? apiFetch<void>(`/api/todos/${id}`, { method: "DELETE" })
      : localTodos.remove(id),

  /**
   * 调度用的列表:未完成、设了提醒、还没弹过的待办,按提醒时间正序,不带图片。
   * 心跳每分钟调一次,所以两条路径都刻意避开图片——登录态是 URL(白传),
   * 未登录态是 base64(白读)。
   */
  listRemindPending: async (): Promise<Todo[]> =>
    (await hasToken())
      ? (await apiFetch<RemoteTodo[]>("/api/todos?remind=pending")).map(fromRemote)
      : localTodos.listRemindPending(),

  markRemindTriggered: async (id: number): Promise<Todo> =>
    (await hasToken())
      ? fromRemote(
          await apiFetch<RemoteTodo>(`/api/todos/${id}/remind-triggered`, { method: "PATCH" }),
        )
      : localTodos.markRemindTriggered(id),

  /**
   * 追加图片。传入的 blob 应当已经降采样过(调用方负责,见 shared/images.ts)。
   *
   * 这里只能做「单批次」检查:后端的上限是累计的(已存数量 + 本次新增 > 9 才拒,
   * backend/src/todo/todo.service.ts:145),而这个函数只拿到本次新增的 blobs,
   * 结构上就不知道这条待办已经有多少张图——那个数字只有调用方(UI,持有
   * t.images.length)手里有。所以累计上限必须由调用方在调这个函数之前自己核对;
   * 这里的检查只防「单批次本身就超过 9 张」这种情况,避免打一个注定 400 的请求。
   */
  addImages: async (id: number, blobs: Blob[]): Promise<TodoImage[]> => {
    if (blobs.length === 0) return [];
    if (blobs.length > MAX_TODO_IMAGES) throw new Error(`最多 ${MAX_TODO_IMAGES} 张图片`);
    if (await hasToken()) {
      const fd = new FormData();
      // 字段名必须是 images,与后端 FilesInterceptor('images', 9) 一致;
      // 必须给文件名,否则 multer 可能拒收。
      blobs.forEach((b, i) => fd.append("images", b, `image-${i}.webp`));
      const t = await apiFetch<RemoteTodo>(`/api/todos/${id}/images`, { method: "POST", body: fd });
      return fromRemote(t).images;
    }
    const dataUrls = await Promise.all(blobs.map((b) => blobToDataUrl(b)));
    return localTodos.addImages(id, dataUrls);
  },

  /**
   * 删掉一张图。返回 void 而不是新的图片列表——因为后端的 DELETE 端点是
   * Promise<void>(todo.service.ts:178),没有响应体可映射,再拉一次纯属浪费请求。
   * 调用方自己从本地状态里过滤掉这个 id 即可。
   */
  removeImage: async (id: number, imageId: number): Promise<void> => {
    if (await hasToken()) {
      await apiFetch<void>(`/api/todos/${id}/images/${imageId}`, { method: "DELETE" });
      return;
    }
    await localTodos.removeImage(id, imageId);
  },
};
