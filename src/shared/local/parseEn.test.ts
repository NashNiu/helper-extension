import { describe, expect, it } from "vitest";
import { parseDurationEn } from "./parseEn";

describe("parseDurationEn", () => {
  it("parses minutes and hours", () => {
    expect(parseDurationEn("25 min")).toBe(1500);
    expect(parseDurationEn("25 minutes")).toBe(1500);
    expect(parseDurationEn("1 hour")).toBe(3600);
    expect(parseDurationEn("2 hrs")).toBe(7200);
  });
  it("parses half an hour and combined", () => {
    expect(parseDurationEn("half an hour")).toBe(1800);
    expect(parseDurationEn("1h30m")).toBe(5400);
    expect(parseDurationEn("1 hour 30 min")).toBe(5400);
  });
  it("parses seconds and is case-insensitive", () => {
    expect(parseDurationEn("90 sec")).toBe(90);
    expect(parseDurationEn("25 MIN")).toBe(1500);
  });
  it("returns null without a duration", () => {
    expect(parseDurationEn("buy milk")).toBeNull();
    expect(parseDurationEn("8pm")).toBeNull();
  });
});
