/** 降采样后的长边上限。1600px 对「截图当备注」远远够用。 */
export const MAX_EDGE = 1600;
/**
 * 粘贴到待办场景下,解码前的原始体积上限。特意比剪贴板板用的 MAX_IMAGE_BYTES(5MB)
 * 宽得多——那个 5MB 保护的是剪贴板板的本地存储,因为板会把原始字节原样存下来;
 * 这里的原始字节在 downscale() 重编码完之后立刻就被丢弃(见 TodoView.pasteImage),
 * 从不落盘,所以一张大图片对这条路径来说只多花一次解码的代价,不存在「占存储」的问题。
 * 25MB 只是防止把一个荒谬大小的输入解码进内存,不是为了省空间。
 */
export const MAX_PASTE_IMAGE_BYTES = 25 * 1024 * 1024;
/** WebP 编码质量。0.8 在这个用途下肉眼无损。 */
export const WEBP_QUALITY = 0.8;
/**
 * 与后端一致的每条待办图片数上限(backend/src/todo/todo.service.ts:145,
 * `todo.images.length + files.length > 9` 触发 400)。放在这个中立模块而不是
 * api/todo.ts,是因为 api/todo.ts 与 local/todos.ts 都需要引用它,而
 * local/todos.ts 目前只以 `type` 方式引用 api/todo.ts(编译期擦除,不构成运行时环);
 * 若反过来在 api/todo.ts 里定义再被 local/todos.ts 当作值导入,就会在
 * api/todo.ts(运行时导入 localTodos)与 local/todos.ts 之间闭合出一个真实的
 * 运行时循环依赖,可能在模块初始化顺序不对时拿到 undefined。images.ts 不依赖
 * 这两者中的任何一个,对双方都是安全的公共依赖。
 */
export const MAX_TODO_IMAGES = 9;

/**
 * 等比缩放到长边不超过 max。长边已在限内时原样返回——绝不放大。
 * 极端长条时短边至少保留 1px,避免算出 0 导致画布创建失败。
 */
export function fitWithin(w: number, h: number, max: number): { w: number; h: number } {
  const longest = Math.max(w, h);
  if (longest <= max) return { w, h };
  const scale = max / longest;
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

/**
 * 降采样:长边压到 MAX_EDGE、重编码为 WebP。
 *
 * 这一步决定了本地存储能否持续:一张 5MB 截图转 base64 是 ~6.7MB,而它最终只在
 * 400px 的面板里当备注看;压完通常降到几百 KB,差二十倍。
 *
 * 依赖 createImageBitmap / OffscreenCanvas,所以只在面板里调用(附件是在编辑态添加的)。
 */
export async function downscale(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  try {
    const { w, h } = fitWithin(bmp.width, bmp.height, MAX_EDGE);
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("OffscreenCanvas 2d context unavailable");
    ctx.drawImage(bmp, 0, 0, w, h);
    return await canvas.convertToBlob({ type: "image/webp", quality: WEBP_QUALITY });
  } finally {
    // 无论成败都要释放位图,否则大图会把内存占住。
    bmp.close();
  }
}

/**
 * Blob → dataURL。用 arrayBuffer + btoa 而不是 FileReader,这样在没有 DOM 的环境也成立。
 *
 * 注意:background/clipboard.ts 里有一份同样逻辑的实现。本次不去合并它——那属于剪贴板
 * 功能,合并会把改动面扩大到与本功能无关的代码。
 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${blob.type || "image/webp"};base64,${btoa(bin)}`;
}
