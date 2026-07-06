import { describe, expect, it } from "vitest";
import { parseDurationEn, parseClockEn } from "./parseEn";

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
