import { describe, expect, it } from "vitest";
import { fitWithin, MAX_EDGE } from "./images";

describe("fitWithin", () => {
  it("长边在限内时原样返回", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ w: 800, h: 600 });
  });

  it("正好等于上限时不改动", () => {
    expect(fitWithin(1600, 900, 1600)).toEqual({ w: 1600, h: 900 });
  });

  it("绝不放大", () => {
    expect(fitWithin(100, 50, 1600)).toEqual({ w: 100, h: 50 });
  });

  it("横图超限:长边压到上限,短边等比", () => {
    expect(fitWithin(3200, 1600, 1600)).toEqual({ w: 1600, h: 800 });
  });

  it("竖图超限:按高压缩", () => {
    expect(fitWithin(1600, 3200, 1600)).toEqual({ w: 800, h: 1600 });
  });

  it("正方形超限:两边都变成上限", () => {
    expect(fitWithin(2000, 2000, 1600)).toEqual({ w: 1600, h: 1600 });
  });

  it("极端长条不会把短边算成 0", () => {
    const r = fitWithin(10000, 30, 1600);
    expect(r.w).toBe(1600);
    expect(r.h).toBeGreaterThanOrEqual(1);
  });

  it("缩放后长边不超过上限(对一批尺寸成立)", () => {
    for (const [w, h] of [[4000, 3000], [3000, 4000], [1601, 1], [5000, 5000], [1, 9000]]) {
      const r = fitWithin(w, h, MAX_EDGE);
      expect(Math.max(r.w, r.h)).toBeLessThanOrEqual(MAX_EDGE);
    }
  });
});
