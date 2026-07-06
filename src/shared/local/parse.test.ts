import { describe, expect, it } from "vitest";
import { zhToNum, parseDuration, parseTimer, parseClock, parseReminderTime } from "./parse";

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

describe("parseTimer", () => {
  it("parses duration with a name", () => {
    expect(parseTimer("背单词计时25分钟")).toEqual({ name: "背单词", duration_seconds: 1500 });
  });
  it("defaults pomodoro to 25 minutes", () => {
    expect(parseTimer("番茄钟")).toEqual({ name: "番茄钟", duration_seconds: 1500 });
  });
  it("falls back to a default name", () => {
    expect(parseTimer("计时5分钟")).toEqual({ name: "计时", duration_seconds: 300 });
  });
  it("returns null without a usable duration", () => {
    expect(parseTimer("买牛奶")).toBeNull();
  });
});

describe("parseClock", () => {
  it("parses chinese hour", () => {
    expect(parseClock("九点")).toEqual({ hour: 9, minute: 0 });
  });
  it("parses half and quarter", () => {
    expect(parseClock("九点半")).toEqual({ hour: 9, minute: 30 });
    expect(parseClock("下午三点一刻")).toEqual({ hour: 15, minute: 15 });
  });
  it("parses colon form and afternoon", () => {
    expect(parseClock("晚上8点30")).toEqual({ hour: 20, minute: 30 });
    expect(parseClock("15:45")).toEqual({ hour: 15, minute: 45 });
  });
  it("returns null without a clock", () => {
    expect(parseClock("开会")).toBeNull();
  });
  it("normalizes midnight period to 0", () => {
    expect(parseClock("凌晨十二点")).toEqual({ hour: 0, minute: 0 });
  });
  it("rejects an out-of-range hour", () => {
    expect(parseClock("25点")).toBeNull();
  });
});

const NOW = new Date(2026, 0, 1, 8, 0, 0); // 2026-01-01(周四)08:00 本地时间

describe("parseReminderTime - relative", () => {
  it("parses N分钟后", () => {
    const at = parseReminderTime("30分钟后提醒我喝水", NOW)!;
    expect(at.getTime()).toBe(NOW.getTime() + 30 * 60 * 1000);
  });
  it("parses N小时后 with chinese numeral", () => {
    const at = parseReminderTime("两小时后开会", NOW)!;
    expect(at.getTime()).toBe(NOW.getTime() + 2 * 3600 * 1000);
  });
  it("parses 半小时后", () => {
    const at = parseReminderTime("半小时后", NOW)!;
    expect(at.getTime()).toBe(NOW.getTime() + 30 * 60 * 1000);
  });
  it("returns null with no time", () => {
    expect(parseReminderTime("买牛奶", NOW)).toBeNull();
  });
});

describe("parseReminderTime - named day", () => {
  it("parses 明天 + clock", () => {
    const at = parseReminderTime("明天九点开会", NOW)!;
    expect([at.getFullYear(), at.getMonth(), at.getDate(), at.getHours(), at.getMinutes()])
      .toEqual([2026, 0, 2, 9, 0]);
  });
  it("parses 后天 with afternoon", () => {
    const at = parseReminderTime("后天下午三点半交报告", NOW)!;
    expect([at.getMonth(), at.getDate(), at.getHours(), at.getMinutes()]).toEqual([0, 3, 15, 30]);
  });
  it("defaults to 09:00 when no clock given", () => {
    const at = parseReminderTime("明天记得体检", NOW)!;
    expect([at.getDate(), at.getHours(), at.getMinutes()]).toEqual([2, 9, 0]);
  });
});

describe("parseReminderTime - weekday & absolute", () => {
  it("parses 周五 as the next friday", () => {
    // 周四 → 周五 = 次日 1/2
    const at = parseReminderTime("周五10点面试", NOW)!;
    expect([at.getMonth(), at.getDate(), at.getHours()]).toEqual([0, 2, 10]);
  });
  it("parses 下周一", () => {
    // 周四 → 下周一 = 1/5
    const at = parseReminderTime("下周一开会", NOW)!;
    expect([at.getMonth(), at.getDate(), at.getHours()]).toEqual([0, 5, 9]);
  });
  it("parses 月日 absolute", () => {
    const at = parseReminderTime("3月5日上午十点体检", NOW)!;
    expect([at.getMonth(), at.getDate(), at.getHours()]).toEqual([2, 5, 10]);
  });
  it("rolls day-only past date to next month", () => {
    // NOW=1/1;"1号" 已过(1/1 09:00 > 08:00 之前?)这里用明确过去日:测 1 号 08:00 之前
    const at = parseReminderTime("每月1号9点还款", NOW)!;
    // 1/1 09:00 晚于 NOW(08:00),仍是本月 1 号
    expect([at.getMonth(), at.getDate(), at.getHours()]).toEqual([0, 1, 9]);
  });
});
