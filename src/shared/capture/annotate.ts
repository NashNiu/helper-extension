import type { Rect } from "./rect";

export interface Pt {
  x: number;
  y: number;
}

export type OpColor = "red" | "yellow" | "green" | "blue";

export interface MosaicOp { kind: "mosaic"; id: string; points: Pt[]; radius: number }
export interface RectOp { kind: "rect"; id: string; r: Rect; color: OpColor; width: number }
export interface ArrowOp { kind: "arrow"; id: string; from: Pt; to: Pt; color: OpColor; width: number }
export interface TextOp { kind: "text"; id: string; at: Pt; text: string; color: OpColor; fontPx: number }
export type Op = MosaicOp | RectOp | ArrowOp | TextOp;

export interface Ops { list: Op[] }

/**
 * 正在进行中、还没落进 ops 的那一个操作。拖拽中的马赛克/矩形/箭头,以及正在
 * 输入的文字,都是同一个概念——渲染时并进列表,松手或定稿时才真正写入 ops。
 *
 * replacesId 为 null 表示这是个新建;非 null 表示它在就地改写列表里的同 id 项,
 * 这是文字二次编辑不打乱层叠顺序的原因。
 *
 * caret 只在文字编辑时有值,表示光标在第几个字符之前。它由 Task 9 的绘制代码
 * 消费,不入最终图像。
 */
export interface Draft { op: Op; replacesId: string | null; caret?: number }

// 自增计数器而不是 crypto.randomUUID():后者是 [SecureContext] 接口,内容脚本
// 跑在 http:// 页面上时它根本不存在,调用会直接抛。id 只需在一次覆盖层会话内唯一。
let idSeq = 0;
export function nextOpId(): string {
  return `op-${++idSeq}`;
}

export function emptyOps(): Ops {
  return { list: [] };
}

export function pushOp(ops: Ops, op: Op): Ops {
  return { list: [...ops.list, op] };
}

/** op 传 null 表示删除该项。找不到 id 时原样返回。 */
export function replaceOp(ops: Ops, id: string, op: Op | null): Ops {
  const out: Op[] = [];
  for (const o of ops.list) {
    if (o.id !== id) {
      out.push(o);
      continue;
    }
    if (op) out.push(op);
  }
  return { list: out };
}

/** 把草稿并进列表,得到本次要渲染的有效列表。 */
export function effectiveList(ops: Ops, draft?: Draft): Op[] {
  if (!draft) return ops.list;
  if (draft.replacesId === null) return [...ops.list, draft.op];
  return ops.list.map((o) => (o.id === draft.replacesId ? draft.op : o));
}

/**
 * 列表里有没有马赛克。这是要不要算 pixelateCrop 的闸门。
 *
 * 收的是 Op[] 而不是 Ops,调用方必须传 effectiveList(ops, draft)——正在拖拽的
 * 那一笔马赛克还在草稿里,只看 ops 会让预览直到松手才出现马赛克。
 */
export function hasMosaic(list: Op[]): boolean {
  return list.some((o) => o.kind === "mosaic");
}

export type BrushSize = "small" | "medium" | "large";

/** 笔刷半径(CSS 像素)。三档差距要拉开——遮一行小字和遮半张图不是一个量级。 */
export const BRUSH_CSS_RADIUS: Record<BrushSize, number> = { small: 8, medium: 16, large: 28 };
export const DEFAULT_BRUSH: BrushSize = "medium";

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
