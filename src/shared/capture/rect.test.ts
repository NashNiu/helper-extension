import { describe, expect, it } from "vitest";
import { normalizeRect, isTooSmall, toBitmapRect, MIN_SELECTION } from "./rect";

describe("normalizeRect", () => {
  it("左上往右下拖", () => {
    expect(normalizeRect(10, 20, 110, 220)).toEqual({ x: 10, y: 20, w: 100, h: 200 });
  });

  it("右下往左上拖，结果与反方向一致", () => {
    expect(normalizeRect(110, 220, 10, 20)).toEqual({ x: 10, y: 20, w: 100, h: 200 });
  });

  it("右上往左下拖", () => {
    expect(normalizeRect(110, 20, 10, 220)).toEqual({ x: 10, y: 20, w: 100, h: 200 });
  });

  it("左下往右上拖", () => {
    expect(normalizeRect(10, 220, 110, 20)).toEqual({ x: 10, y: 20, w: 100, h: 200 });
  });

  it("小数坐标取整，避免后面画布尺寸出现小数", () => {
    expect(normalizeRect(10.4, 20.6, 110.2, 220.9)).toEqual({ x: 10, y: 21, w: 100, h: 200 });
  });
});

describe("isTooSmall", () => {
  it("没拖动（点一下）算太小", () => {
    expect(isTooSmall({ x: 5, y: 5, w: 0, h: 0 })).toBe(true);
  });

  it("只有一边够大也算太小", () => {
    expect(isTooSmall({ x: 0, y: 0, w: 100, h: 3 })).toBe(true);
    expect(isTooSmall({ x: 0, y: 0, w: 3, h: 100 })).toBe(true);
  });

  it("两边都到达阈值就不算太小", () => {
    expect(isTooSmall({ x: 0, y: 0, w: MIN_SELECTION, h: MIN_SELECTION })).toBe(false);
  });
});

describe("toBitmapRect", () => {
  it("scale 为 1 时原样返回", () => {
    expect(toBitmapRect({ x: 10, y: 20, w: 30, h: 40 }, 1, 1000, 1000)).toEqual({ x: 10, y: 20, w: 30, h: 40 });
  });

  it("高 DPI：按 scale 放大后取整", () => {
    expect(toBitmapRect({ x: 10, y: 20, w: 30, h: 40 }, 2, 1000, 1000)).toEqual({ x: 20, y: 40, w: 60, h: 80 });
  });

  it("非整数 scale 也不会溢出位图边界", () => {
    const r = toBitmapRect({ x: 0, y: 0, w: 800, h: 600 }, 1.25, 1000, 750);
    expect(r.x + r.w).toBeLessThanOrEqual(1000);
    expect(r.y + r.h).toBeLessThanOrEqual(750);
  });

  it("选区右下超出位图时裁到边界", () => {
    expect(toBitmapRect({ x: 900, y: 700, w: 500, h: 500 }, 1, 1000, 800)).toEqual({ x: 900, y: 700, w: 100, h: 100 });
  });

  it("负坐标夹回 0，且宽度相应缩短", () => {
    expect(toBitmapRect({ x: -20, y: -10, w: 100, h: 50 }, 1, 1000, 800)).toEqual({ x: 0, y: 0, w: 80, h: 40 });
  });

  it("完全在位图外时返回零尺寸，交给调用方当取消处理", () => {
    const r = toBitmapRect({ x: 2000, y: 2000, w: 100, h: 100 }, 1, 1000, 800);
    expect(r.w).toBe(0);
    expect(r.h).toBe(0);
  });
});
