import { apiFetch } from "../http";
import { hasToken } from "../auth";
import { localTodos } from "../local/todos";
import { blobToDataUrl } from "../images";

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

/** 与后端一致的每条待办图片数上限。后端超限会抛 400,所以客户端必须前置拦截。 */
export const MAX_TODO_IMAGES = 9;

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
   * 上限检查在分流之前:两条路径共享同一规则,也避免打一个注定 400 的请求。
   */
  addImages: async (id: number, blobs: Blob[]): Promise<TodoImage[]> => {
    if (blobs.length === 0) return [];
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
