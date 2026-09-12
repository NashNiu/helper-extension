import type { Rect } from "./rect";
import type { Ops } from "./annotate";

function make2d(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  return { canvas, ctx };
}

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

/**
 * 底图裁剪 + 按笔迹蒙版贴上马赛克。
 *
 * **预览与最终输出必须都调用这一个函数。** 另做一套「近似的」预览画法,是这类工具
 * 最常见的缺陷来源——用户看到的和存下来的对不上。
 *
 * pix 由调用方传入(见 pixelateCrop 的缓存说明)。
 */
export function renderAnnotated(bmp: ImageBitmap, crop: Rect, ops: Ops, pix: HTMLCanvasElement): HTMLCanvasElement {
  const out = make2d(crop.w, crop.h);
  out.ctx.drawImage(bmp, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
  if (ops.mosaics.length === 0) return out.canvas;

  // 蒙版:笔迹画成白色圆头粗线。笔迹是位图坐标,画进裁剪局部坐标要减去裁剪原点。
  const mask = make2d(crop.w, crop.h);
  mask.ctx.strokeStyle = "#fff";
  mask.ctx.fillStyle = "#fff";
  mask.ctx.lineCap = "round";
  mask.ctx.lineJoin = "round";
  for (const s of ops.mosaics) {
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
  return out.canvas;
}
