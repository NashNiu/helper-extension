import { describe, expect, it } from "vitest";
import {
  planReminders,
  reminderIdFromAlarm,
  remainingSeconds,
  REMINDER_ALARM_PREFIX,
} from "./logic";

const r = (id: number, iso: string) => ({
  id,
  message: "m",
  trigger_at: iso,
  is_triggered: false,
  created_at: iso,
});

describe("planReminders", () => {
  const now = Date.parse("2026-06-30T12:00:00Z");

  it("puts past-due reminders in dueNow", () => {
    const out = planReminders([r(1, "2026-06-30T11:59:00Z")], now);
    expect(out.dueNow.map((x) => x.id)).toEqual([1]);
    expect(out.toSchedule).toEqual([]);
  });

  it("schedules future reminders with prefixed name", () => {
    const future = "2026-06-30T12:05:00Z";
    const out = planReminders([r(2, future)], now);
    expect(out.dueNow).toEqual([]);
    expect(out.toSchedule).toEqual([
      { name: `${REMINDER_ALARM_PREFIX}2`, when: Date.parse(future) },
    ]);
  });

  it("excludes already-triggered reminders", () => {
    const triggered = { ...r(9, "2026-06-30T11:00:00Z"), is_triggered: true };
    const out = planReminders([triggered], now);
    expect(out.dueNow).toEqual([]);
    expect(out.toSchedule).toEqual([]);
  });

  it("treats trigger_at exactly equal to now as due", () => {
    const iso = "2026-06-30T12:00:00Z"; // equals `now`
    const out = planReminders([r(3, iso)], now);
    expect(out.dueNow.map((x) => x.id)).toEqual([3]);
    expect(out.toSchedule).toEqual([]);
  });
});

describe("reminderIdFromAlarm", () => {
  it("parses id", () => expect(reminderIdFromAlarm("reminder:42")).toBe(42));
  it("returns null for others", () => expect(reminderIdFromAlarm("heartbeat")).toBeNull());
  it("returns null for a non-integer suffix", () => expect(reminderIdFromAlarm("reminder:1.5")).toBeNull());
});

describe("remainingSeconds", () => {
  const now = 10_000;
  it("computes remaining", () => expect(remainingSeconds(0, 30, now)).toBe(20));
  it("never negative", () => expect(remainingSeconds(0, 5, now)).toBe(0));
});
