import { apiFetch } from "../http";
import { hasToken } from "../auth";
import { localTodos } from "../local/todos";
import { blobToDataUrl, MAX_TODO_IMAGES } from "../images";

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
}

// 后端返回的原始形状:图片字段叫 image_path,值是 Supabase 的完整公开 URL。
interface RemoteTodoImage {
  id: number;
  image_path: string;
  sort_order: number;
}
type RemoteTodo = Omit<Todo, "images"> & { images?: RemoteTodoImage[] };

/**
 * 把后端形状归一成 UI 用的形状:image_path → url。
 * 这样 TodoView 完全不需要知道自己在登录态还是本地态,两边都是 img.url。
 */
function fromRemote(t: RemoteTodo): Todo {
  return {
    ...t,
    images: (t.images ?? [])
      .map((i) => ({ id: i.id, url: i.image_path, sort_order: i.sort_order }))
      .sort((a, b) => a.sort_order - b.sort_order),
  };
}

async function remoteCreate(content: string): Promise<Todo> {
  const fd = new FormData();
  fd.append("content", content);
  return fromRemote(await apiFetch<RemoteTodo>("/api/todos", { method: "POST", body: fd }));
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
  /** 仅未完成的待办,分页拉取。 */
  listActive: async (offset = 0, limit = 10) =>
    (await hasToken())
      ? (await apiFetch<RemoteTodo[]>(`/api/todos?done=false&limit=${limit}&offset=${offset}`)).map(fromRemote)
      : localTodos.listActive(offset, limit),
  /** 已完成的待办(个人中心历史),按完成时间倒序,分页拉取。 */
  listDone: async (offset = 0, limit = 10) =>
    (await hasToken())
      ? (await apiFetch<RemoteTodo[]>(`/api/todos?done=true&limit=${limit}&offset=${offset}`)).map(fromRemote)
      : localTodos.listDone(offset, limit),
  create: async (content: string) =>
    (await hasToken()) ? remoteCreate(content) : localTodos.create(content),
  update: async (id: number, data: { content?: string; is_done?: boolean }) =>
    (await hasToken())
      ? fromRemote(await apiFetch<RemoteTodo>(`/api/todos/${id}`, { method: "PATCH", json: data }))
      : localTodos.update(id, data),
  remove: async (id: number) =>
    (await hasToken())
      ? apiFetch<void>(`/api/todos/${id}`, { method: "DELETE" })
      : localTodos.remove(id),

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
