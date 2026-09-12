import { describe, expect, it } from "vitest";
import {
  emptyOps,
  isEmpty,
  pushStroke,
  undo,
  bitmapScale,
  toBitmapPt,
  brushRadius,
  BRUSH_CSS_RADIUS,
  DEFAULT_BRUSH,
  type Stroke,
} from "./annotate";

const stroke = (n: number): Stroke => ({ points: [{ x: n, y: n }], radius: 10 });

describe("操作列表", () => {
  it("新建的操作列表是空的", () => {
    expect(isEmpty(emptyOps())).toBe(true);
    expect(emptyOps().mosaics).toEqual([]);
  });

  it("追加笔迹后不再为空，且按追加顺序排列", () => {
    const ops = pushStroke(pushStroke(emptyOps(), stroke(1)), stroke(2));
    expect(isEmpty(ops)).toBe(false);
    expect(ops.mosaics.map((s) => s.points[0].x)).toEqual([1, 2]);
  });

  it("追加不修改原对象——渲染要靠重放，就地改会让撤销失去参照", () => {
    const before = emptyOps();
    pushStroke(before, stroke(1));
    expect(before.mosaics).toEqual([]);
  });

  it("撤销只去掉最后一条，更早的原样保留", () => {
    const ops = pushStroke(pushStroke(pushStroke(emptyOps(), stroke(1)), stroke(2)), stroke(3));
    expect(undo(ops).mosaics.map((s) => s.points[0].x)).toEqual([1, 2]);
  });

  it("空列表上撤销不报错，仍是空", () => {
    expect(() => undo(emptyOps())).not.toThrow();
    expect(isEmpty(undo(emptyOps()))).toBe(true);
  });
});

describe("bitmapScale", () => {
  it("位图与视口同宽时是 1", () => {
    expect(bitmapScale(1000, 1000)).toBe(1);
  });

  it("二倍屏是 2", () => {
    expect(bitmapScale(2000, 1000)).toBe(2);
  });

  it("innerWidth 为 0 时退回 1，避免除出 Infinity 把后面的坐标全毁掉", () => {
    expect(bitmapScale(1000, 0)).toBe(1);
  });
});

describe("toBitmapPt", () => {
  it("按比例换算并取整", () => {
    expect(toBitmapPt({ x: 10, y: 20 }, 2)).toEqual({ x: 20, y: 40 });
  });

  it("非整数比例也取整，画布坐标不该出现小数", () => {
    expect(toBitmapPt({ x: 10, y: 20 }, 1.25)).toEqual({ x: 13, y: 25 });
  });
});

describe("brushRadius", () => {
  it("三档的 CSS 半径依次拉开", () => {
    expect(BRUSH_CSS_RADIUS.small).toBeLessThan(BRUSH_CSS_RADIUS.medium);
    expect(BRUSH_CSS_RADIUS.medium).toBeLessThan(BRUSH_CSS_RADIUS.large);
  });

  it("三档的 CSS 半径钉死在约定的具体数值上——只校验顺序和比例,一个打错的常量也能蒙混过关", () => {
    expect(BRUSH_CSS_RADIUS).toEqual({ small: 8, medium: 16, large: 28 });
  });

  it("默认档是中", () => {
    expect(DEFAULT_BRUSH).toBe("medium");
  });

  it("按比例换算到位图尺度", () => {
    expect(brushRadius("medium", 2)).toBe(BRUSH_CSS_RADIUS.medium * 2);
  });

  it("再小也至少 1 像素——半径 0 会画出什么都没有的笔迹", () => {
    expect(brushRadius("small", 0.01)).toBe(1);
  });
});

