import { describe, expect, it } from "vitest";
import { parseDurationEn, parseClockEn, tryRelativeEn, tryNamedDayEn } from "./parseEn";

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

describe("parseClockEn", () => {
  it("parses am/pm", () => {
    expect(parseClockEn("8pm")).toEqual({ hour: 20, minute: 0 });
    expect(parseClockEn("8:30 pm")).toEqual({ hour: 20, minute: 30 });
    expect(parseClockEn("8am")).toEqual({ hour: 8, minute: 0 });
    expect(parseClockEn("12am")).toEqual({ hour: 0, minute: 0 });
  });
  it("parses 24h colon and 'at N'", () => {
    expect(parseClockEn("15:45")).toEqual({ hour: 15, minute: 45 });
    expect(parseClockEn("at 3")).toEqual({ hour: 3, minute: 0 });
  });
  it("parses noon and midnight", () => {
    expect(parseClockEn("noon")).toEqual({ hour: 12, minute: 0 });
    expect(parseClockEn("midnight")).toEqual({ hour: 0, minute: 0 });
  });
  it("ignores bare numbers with no clock signal", () => {
    expect(parseClockEn("buy 5 apples")).toBeNull();
  });
});

const NOW = new Date(2026, 0, 1, 8, 0, 0); // Thu 2026-01-01 08:00

describe("tryRelativeEn", () => {
  it("parses 'in N unit'", () => {
    expect(tryRelativeEn("in 30 minutes", NOW)!.getTime()).toBe(NOW.getTime() + 1800 * 1000);
    expect(tryRelativeEn("in 2 hours", NOW)!.getTime()).toBe(NOW.getTime() + 7200 * 1000);
    expect(tryRelativeEn("in a week", NOW)!.getTime()).toBe(NOW.getTime() + 604800 * 1000);
    expect(tryRelativeEn("in half an hour", NOW)!.getTime()).toBe(NOW.getTime() + 1800 * 1000);
  });
  it("returns null otherwise", () => {
    expect(tryRelativeEn("buy milk", NOW)).toBeNull();
  });
});

describe("tryNamedDayEn", () => {
  it("parses tomorrow with clock", () => {
    const at = tryNamedDayEn("tomorrow at 8pm", NOW)!;
    expect([at.getMonth(), at.getDate(), at.getHours()]).toEqual([0, 2, 20]);
  });
  it("defaults to 09:00 and handles day-after-tomorrow", () => {
    expect([tryNamedDayEn("today", NOW)!.getDate(), tryNamedDayEn("today", NOW)!.getHours()]).toEqual([1, 9]);
    expect(tryNamedDayEn("the day after tomorrow", NOW)!.getDate()).toBe(3);
  });
});
