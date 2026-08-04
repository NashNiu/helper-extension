/** 降采样后的长边上限。1600px 对「截图当备注」远远够用。 */
export const MAX_EDGE = 1600;
/** WebP 编码质量。0.8 在这个用途下肉眼无损。 */
export const WEBP_QUALITY = 0.8;

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
