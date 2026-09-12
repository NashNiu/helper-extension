import type { Rect } from "./rect";
import {
  arrowHead,
  effectiveList,
  fontString,
  OP_COLORS,
  type ArrowOp,
  type Draft,
  type Measure,
  type MosaicOp,
  type Ops,
  type OpColor,
  type RectOp,
  type TextOp,
} from "./annotate";

function make2d(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  return { canvas, ctx };
}

/** 文字描边色。四个标注色里只有黄是浅色,配深色描边;其余配白。 */
const TEXT_OUTLINE: Record<OpColor, string> = {
  red: "#fff", yellow: "#000", green: "#fff", blue: "#fff",
};

/**
 * 生产环境的文字度量。每次新建一张 1×1 画布,代价可忽略(measureText 不依赖画布
 * 尺寸),换来的是不必在模块里留一个长期存活的画布。
 *
 * 取不到 2D 上下文时退回按字数估算的宽度,而**不是**抛异常:命中判定跑在
 * mousedown 路径上,让它抛会把整个点击处理打断,用户看到的是「文字工具点了没反应」。
 * 估算值不准,但不准的命中范围远好过功能整个失灵——这与「预览渲染失败只隐藏预览、
 * 不拖垮覆盖层」是同一个取舍。happy-dom 里没有 2D 上下文,单测走的也正是这条分支。
 */
export const measureText: Measure = (text, fontPx) => {
  try {
    const { ctx } = make2d(1, 1);
    ctx.font = fontString(fontPx);
    return ctx.measureText(text).width;
  } catch {
    return text.length * fontPx * 0.6;
  }
};

/** 马赛克块边长。随位图宽度自适应——写死常数在高分屏上会小到看不出遮挡。 */
export function blockSizeFor(bmpWidth: number): number {
  return Math.max(6, Math.round(bmpWidth / 120));
}

/**
 * 把整块裁剪区域像素化成一张画布。
 *
 * 只依赖底图与裁剪矩形,不依赖笔迹——所以调用方可以按选区缓存它,涂抹过程中
 * 只重画蒙版,不必每次 mousemove 都重算这一步(大选区上那会很卡)。
 */
export function pixelateCrop(bmp: ImageBitmap, crop: Rect): HTMLCanvasElement {
  const block = blockSizeFor(bmp.width);
  const sw = Math.max(1, Math.round(crop.w / block));
  const sh = Math.max(1, Math.round(crop.h / block));

  const small = make2d(sw, sh);
  small.ctx.drawImage(bmp, crop.x, crop.y, crop.w, crop.h, 0, 0, sw, sh);

  const out = make2d(crop.w, crop.h);
  // 关掉平滑才是马赛克。开着平滑放大回去得到的是模糊,而模糊在很多场景下是可还原的。
  out.ctx.imageSmoothingEnabled = false;
  out.ctx.drawImage(small.canvas, 0, 0, sw, sh, 0, 0, crop.w, crop.h);
  return out.canvas;
}

/** 空心矩形。坐标是位图坐标,画进裁剪局部坐标要减去裁剪原点。 */
function drawRect(ctx: CanvasRenderingContext2D, op: RectOp, crop: Rect): void {
  ctx.save();
  ctx.strokeStyle = OP_COLORS[op.color];
  ctx.lineWidth = op.width;
  ctx.lineJoin = "miter";
  ctx.strokeRect(op.r.x - crop.x, op.r.y - crop.y, op.r.w, op.r.h);
  ctx.restore();
}

/** 直线 + 实心三角箭头。 */
function drawArrow(ctx: CanvasRenderingContext2D, op: ArrowOp, crop: Rect): void {
  const head = arrowHead(op.from, op.to, op.width);
  if (!head) return; // 零长度,整支不画
  ctx.save();
  ctx.strokeStyle = OP_COLORS[op.color];
  ctx.fillStyle = OP_COLORS[op.color];
  ctx.lineWidth = op.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(op.from.x - crop.x, op.from.y - crop.y);
  ctx.lineTo(op.to.x - crop.x, op.to.y - crop.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(head[0].x - crop.x, head[0].y - crop.y);
  ctx.lineTo(head[1].x - crop.x, head[1].y - crop.y);
  ctx.lineTo(head[2].x - crop.x, head[2].y - crop.y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 单行文字。先描一圈对比色再填充——红字压在红按钮上,没有描边就是废的。 */
function drawText(ctx: CanvasRenderingContext2D, op: TextOp, crop: Rect, caret?: number): void {
  const x = op.at.x - crop.x;
  const y = op.at.y - crop.y;
  ctx.save();
  ctx.font = fontString(op.fontPx);
  ctx.textBaseline = "top";
  ctx.lineWidth = Math.max(2, Math.round(op.fontPx / 6));
  // 不设 round 会在笔画尖角处甩出毛刺。
  ctx.lineJoin = "round";
  ctx.strokeStyle = TEXT_OUTLINE[op.color];
  ctx.strokeText(op.text, x, y);
  ctx.fillStyle = OP_COLORS[op.color];
  ctx.fillText(op.text, x, y);
  if (caret !== undefined) {
    // 光标由画布自己画:位置靠 measureText 算前缀宽度,与文字用的是同一个字体串,
    // 所以它一定落在正确的字符之间。光标不入最终图像——保存时不传 caret。
    const cx = x + ctx.measureText(op.text.slice(0, caret)).width;
    ctx.fillRect(cx, y, Math.max(1, Math.round(op.fontPx / 12)), Math.round(op.fontPx * 1.25));
  }
  ctx.restore();
}

/**
 * 底图裁剪 + 标注。
 *
 * **预览与最终输出必须都调用这一个函数。** 另做一套「近似的」预览画法,是这类工具
 * 最常见的缺陷来源——用户看到的和存下来的对不上。
 *
 * 马赛克恒在最底层:它遮的是原图像素,让它盖住一支箭头没有意义——那支箭头本来
 * 就不在原图里。所以先一次性合成全部马赛克,再按 list 顺序画其余 op。
 *
 * pix 由调用方传入(见 pixelateCrop 的缓存说明)。没有马赛克时它不会被读取,
 * 调用方可以传一张空画布。
 */
export function renderAnnotated(
  bmp: ImageBitmap,
  crop: Rect,
  ops: Ops,
  pix: HTMLCanvasElement,
  draft?: Draft,
): HTMLCanvasElement {
  const list = effectiveList(ops, draft);
  const out = make2d(crop.w, crop.h);
  out.ctx.drawImage(bmp, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);

  const mosaics = list.filter((o): o is MosaicOp => o.kind === "mosaic");
  if (mosaics.length > 0) {
    // 蒙版:笔迹画成白色圆头粗线。笔迹是位图坐标,画进裁剪局部坐标要减去裁剪原点。
    const mask = make2d(crop.w, crop.h);
    mask.ctx.strokeStyle = "#fff";
    mask.ctx.fillStyle = "#fff";
    mask.ctx.lineCap = "round";
    mask.ctx.lineJoin = "round";
    for (const s of mosaics) {
      const first = s.points[0];
      if (!first) continue;
      mask.ctx.beginPath();
      if (s.points.length === 1) {
        // 只点一下没拖:lineTo 画不出任何东西,得用一个圆点代替,否则点击等于白点。
        mask.ctx.arc(first.x - crop.x, first.y - crop.y, s.radius, 0, Math.PI * 2);
        mask.ctx.fill();
        continue;
      }
      mask.ctx.lineWidth = s.radius * 2;
      mask.ctx.moveTo(first.x - crop.x, first.y - crop.y);
      for (let i = 1; i < s.points.length; i++) {
        mask.ctx.lineTo(s.points[i].x - crop.x, s.points[i].y - crop.y);
      }
      mask.ctx.stroke();
    }
    // 只保留笔迹覆盖到的那部分马赛克,再叠回原图。
    const masked = make2d(crop.w, crop.h);
    masked.ctx.drawImage(pix, 0, 0);
    masked.ctx.globalCompositeOperation = "destination-in";
    masked.ctx.drawImage(mask.canvas, 0, 0);
    out.ctx.drawImage(masked.canvas, 0, 0);
  }

  // rect、arrow、text 的绘制分支。光标只画在草稿那一条上。
  for (const op of list) {
    if (op.kind === "rect") drawRect(out.ctx, op, crop);
    else if (op.kind === "arrow") drawArrow(out.ctx, op, crop);
    else if (op.kind === "text") drawText(out.ctx, op, crop, op.id === draft?.op.id ? draft?.caret : undefined);
  }
  return out.canvas;
}
