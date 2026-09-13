import { describe, expect, it } from "vitest";
import { blockSizeFor } from "./render";

describe("blockSizeFor", () => {
  it("随位图宽度变大", () => {
    expect(blockSizeFor(2400)).toBeGreaterThan(blockSizeFor(1200));
  });

  it("窄图上也不小于 6——块太小就失去遮挡意义", () => {
    expect(blockSizeFor(100)).toBe(6);
  });

  it("1920 宽给出 16", () => {
    expect(blockSizeFor(1920)).toBe(16);
  });
});
