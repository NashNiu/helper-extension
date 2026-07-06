import { describe, expect, it } from "vitest";
import { zhToNum } from "./parse";

describe("zhToNum", () => {
  it("parses arabic digits", () => {
    expect(zhToNum("30")).toBe(30);
    expect(zhToNum("0")).toBe(0);
  });
  it("parses single chinese numerals", () => {
    expect(zhToNum("九")).toBe(9);
    expect(zhToNum("两")).toBe(2);
    expect(zhToNum("十")).toBe(10);
  });
  it("parses composed chinese numerals up to 59", () => {
    expect(zhToNum("十五")).toBe(15);
    expect(zhToNum("三十")).toBe(30);
    expect(zhToNum("二十五")).toBe(25);
  });
  it("returns null for unsupported input", () => {
    expect(zhToNum("百")).toBeNull();
    expect(zhToNum("abc")).toBeNull();
    expect(zhToNum("")).toBeNull();
  });
});
