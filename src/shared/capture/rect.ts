/** 选区最小边长(CSS 像素)。比这小视为误点,按取消处理。 */
export const MIN_SELECTION = 5;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 把拖动的起止两点归一化成左上角 + 宽高。四个拖动方向必须得到同一个矩形。
 * 全程取整:后面要拿它当画布尺寸和 createImageBitmap 的裁剪参数,小数会带来
 * 亚像素模糊,也可能让画布尺寸被静默向下取整而与选区差一像素。
 */
export function normalizeRect(x1: number, y1: number, x2: number, y2: number): Rect {
  const left = Math.round(Math.min(x1, x2));
  const top = Math.round(Math.min(y1, y2));
  const right = Math.round(Math.max(x1, x2));
  const bottom = Math.round(Math.max(y1, y2));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** 两边都要够大才算有效选区——只有一边够长的细条同样是误操作。 */
export function isTooSmall(r: Rect): boolean {
  return r.w < MIN_SELECTION || r.h < MIN_SELECTION;
}

/**
 * CSS 像素坐标 → 截图位图坐标,并夹到位图边界内。
 *
 * scale 由调用方按「位图宽 / window.innerWidth」实测得出,不用 devicePixelRatio:
 * 多屏、页面缩放、系统缩放下 DPR 与实际截图尺寸会对不上,裁出来会偏。
 *
 * 先夹左上角再算右下角,保证 x/y 非负的同时宽高相应缩短,不会出现「左上被夹了
 * 但宽度没变」而整体右移的错位。完全落在位图外时宽高会算成 0,由调用方当取消处理。
 */
export function toBitmapRect(r: Rect, scale: number, bmpW: number, bmpH: number): Rect {
  const left = Math.round(r.x * scale);
  const top = Math.round(r.y * scale);
  const right = Math.round((r.x + r.w) * scale);
  const bottom = Math.round((r.y + r.h) * scale);

  const cl = Math.min(Math.max(left, 0), bmpW);
  const ct = Math.min(Math.max(top, 0), bmpH);
  const cr = Math.min(Math.max(right, 0), bmpW);
  const cb = Math.min(Math.max(bottom, 0), bmpH);

  return { x: cl, y: ct, w: Math.max(0, cr - cl), h: Math.max(0, cb - ct) };
}
