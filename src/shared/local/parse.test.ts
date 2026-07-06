import { describe, expect, it } from "vitest";
import { zhToNum, parseDuration } from "./parse";

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

describe("parseDuration", () => {
  it("parses minutes", () => {
    expect(parseDuration("25分钟")).toBe(25 * 60);
    expect(parseDuration("番茄25分")).toBe(25 * 60);
  });
  it("parses hours and combined", () => {
    expect(parseDuration("1小时")).toBe(3600);
    expect(parseDuration("1小时30分")).toBe(90 * 60);
    expect(parseDuration("半小时")).toBe(1800);
  });
  it("parses seconds and chinese numerals", () => {
    expect(parseDuration("90秒")).toBe(90);
    expect(parseDuration("二十分钟")).toBe(20 * 60);
  });
  it("returns null when no duration", () => {
    expect(parseDuration("开会")).toBeNull();
    expect(parseDuration("明天九点")).toBeNull();
  });
});
