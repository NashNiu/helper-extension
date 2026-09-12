export interface Pt {
  x: number;
  y: number;
}

/** 一次涂抹。points 与 radius 都已经是位图坐标/尺度,渲染时不再换算。 */
export interface Stroke {
  points: Pt[];
  radius: number;
}

/**
 * 标注操作。刻意按类型分组而不是一个有序数组:这次只有马赛克一种,分组更直白;
 * 以后加矩形/文字时若真需要严格的绘制先后顺序,再换成有序数组也只影响渲染函数内部。
 */
export interface Ops {
  mosaics: Stroke[];
}

export type BrushSize = "small" | "medium" | "large";

/** 笔刷半径(CSS 像素)。三档差距要拉开——遮一行小字和遮半张图不是一个量级。 */
export const BRUSH_CSS_RADIUS: Record<BrushSize, number> = { small: 8, medium: 16, large: 28 };
export const DEFAULT_BRUSH: BrushSize = "medium";

export function emptyOps(): Ops {
  return { mosaics: [] };
}

export function isEmpty(ops: Ops): boolean {
  return ops.mosaics.length === 0;
}

/**
 * 追加与撤销都返回新对象,不就地修改。渲染是「从空白重放整个列表」,
 * 就地改会让调用方分不清手上这份是改之前还是改之后的。
 */
export function pushStroke(ops: Ops, s: Stroke): Ops {
  return { ...ops, mosaics: [...ops.mosaics, s] };
}

export function undo(ops: Ops): Ops {
  // slice(0, -1) 在空数组上返回空数组,所以不需要额外判空。
  return { ...ops, mosaics: ops.mosaics.slice(0, -1) };
}

/**
 * 位图像素 / CSS 像素。全项目只此一处实现:copyRegion 裁剪要用它,笔迹收集也要用它,
 * 两边各算一遍迟早会漂移。
 *
 * 不用 devicePixelRatio——多屏、页面缩放、系统缩放下它与真实截图尺寸对不上。
 */
export function bitmapScale(bmpWidth: number, innerWidth: number): number {
  return innerWidth > 0 ? bmpWidth / innerWidth : 1;
}

export function toBitmapPt(p: Pt, scale: number): Pt {
  return { x: Math.round(p.x * scale), y: Math.round(p.y * scale) };
}

export function brushRadius(size: BrushSize, scale: number): number {
  // 至少 1:半径 0 的笔迹画出来什么都没有,用户会以为功能坏了。
  return Math.max(1, Math.round(BRUSH_CSS_RADIUS[size] * scale));
}

