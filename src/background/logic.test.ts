import { describe, expect, it } from "vitest";
import {
  planReminders,
  reminderIdFromAlarm,
  remainingSeconds,
  REMINDER_ALARM_PREFIX,
  DAILY_ALARM_PREFIX,
  nextDailyTrigger,
  dailyIdFromAlarm,
  isDailyFireMissed,
  DAILY_CATCHUP_TOLERANCE_MS,
  planDailyAlarms,
  isLongBreakCycle,
  phaseDurationSec,
  phaseLabel,
  nextStep,
  estimatedEndAt,
  displayRemaining,
  plannedTotalSeconds,
  type PomodoroSession,
  type ActiveTimer,
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

const sess = (over: Partial<PomodoroSession> = {}): PomodoroSession => ({
  cycles: 4,
  cycleIndex: 1,
  phase: "work",
  workSec: 1500,
  shortBreakSec: 300,
  longBreakSec: 900,
  ...over,
});

describe("isLongBreakCycle", () => {
  it("true on every 4th", () => {
    expect(isLongBreakCycle(4)).toBe(true);
    expect(isLongBreakCycle(8)).toBe(true);
  });
  it("false otherwise", () => {
    expect(isLongBreakCycle(1)).toBe(false);
    expect(isLongBreakCycle(3)).toBe(false);
    expect(isLongBreakCycle(5)).toBe(false);
  });
});

describe("plannedTotalSeconds", () => {
  it("sums work + per-cycle break, long every 4th, trailing break kept", () => {
    // cycles=4, work=1500, short=300, long=900
    // 4*1500 + (300+300+300+900) = 6000 + 1800 = 7800
    expect(plannedTotalSeconds(4, 1500, 300, 900)).toBe(7800);
  });
  it("single cycle = work + short break", () => {
    expect(plannedTotalSeconds(1, 1500, 300, 900)).toBe(1800);
  });
});

describe("phaseDurationSec / phaseLabel", () => {
  const s = sess();
  it("maps duration", () => {
    expect(phaseDurationSec(s, "work")).toBe(1500);
    expect(phaseDurationSec(s, "short_break")).toBe(300);
    expect(phaseDurationSec(s, "long_break")).toBe(900);
  });
  it("maps label", () => {
    expect(phaseLabel("work")).toBe("番茄钟");
    expect(phaseLabel("short_break")).toBe("短休息");
    expect(phaseLabel("long_break")).toBe("长休息");
  });
});

describe("nextStep", () => {
  it("work → short break (non-4th cycle)", () => {
    const out = nextStep(sess({ cycleIndex: 1, phase: "work" }));
    expect(out.done).toBe(false);
    expect(out.phase).toBe("short_break");
    expect(out.session.cycleIndex).toBe(1);
  });
  it("work → long break (4th cycle)", () => {
    const out = nextStep(sess({ cycleIndex: 4, phase: "work" }));
    expect(out.phase).toBe("long_break");
  });
  it("break → next work when cycles remain", () => {
    const out = nextStep(sess({ cycles: 4, cycleIndex: 1, phase: "short_break" }));
    expect(out.done).toBe(false);
    expect(out.phase).toBe("work");
    expect(out.session.cycleIndex).toBe(2);
  });
  it("break → done on final cycle", () => {
    const out = nextStep(sess({ cycles: 2, cycleIndex: 2, phase: "short_break" }));
    expect(out.done).toBe(true);
  });
});

describe("estimatedEndAt", () => {
  it("running with session sums remaining phases", () => {
    const now = 0;
    const timer: ActiveTimer = {
      timerId: 1,
      name: "番茄钟",
      startAt: 0,
      durationSeconds: 1500,
      status: "running",
      session: sess({ cycles: 1, cycleIndex: 1, phase: "work" }),
    };
    // 序列 W(1500) S(300);当前 W 结束在 1500s,余下 short 300s
    expect(estimatedEndAt(timer, now)).toBe((1500 + 300) * 1000);
  });
  it("paused uses pausedRemaining for current phase end", () => {
    const now = 10_000;
    const timer: ActiveTimer = {
      timerId: 1,
      name: "番茄钟",
      startAt: 0,
      durationSeconds: 1500,
      status: "paused",
      pausedRemaining: 600,
      session: sess({ cycles: 1, cycleIndex: 1, phase: "work" }),
    };
    // 当前阶段结束 = now + 600s;余下 short 300s
    expect(estimatedEndAt(timer, now)).toBe(now + (600 + 300) * 1000);
  });
  it("no session returns current phase end", () => {
    const timer: ActiveTimer = {
      timerId: 5,
      name: "专注",
      startAt: 1000,
      durationSeconds: 60,
      status: "running",
    };
    expect(estimatedEndAt(timer, 0)).toBe(1000 + 60 * 1000);
  });
});

describe("displayRemaining", () => {
  const base: ActiveTimer = {
    timerId: 1,
    name: "番茄钟",
    startAt: 0,
    durationSeconds: 30,
    status: "running",
  };
  it("running computes from clock", () => {
    expect(displayRemaining(base, 10_000)).toBe(20);
  });
  it("paused returns pausedRemaining", () => {
    expect(displayRemaining({ ...base, status: "paused", pausedRemaining: 12 }, 999_999)).toBe(12);
  });
  it("awaiting returns 0", () => {
    expect(displayRemaining({ ...base, status: "awaiting" }, 0)).toBe(0);
  });
});

describe("nextDailyTrigger", () => {
  const now = new Date(2026, 0, 1, 8, 0, 0).getTime(); // 2026-01-01 08:00 本地

  it("uses today when the time is still ahead", () => {
    const at = new Date(nextDailyTrigger(20, 0, now));
    expect([at.getDate(), at.getHours(), at.getMinutes()]).toEqual([1, 20, 0]);
  });
  it("rolls to tomorrow when the time already passed", () => {
    const at = new Date(nextDailyTrigger(7, 0, now));
    expect([at.getDate(), at.getHours(), at.getMinutes()]).toEqual([2, 7, 0]);
  });
  it("treats a time exactly equal to now as tomorrow", () => {
    const at = new Date(nextDailyTrigger(8, 0, now));
    expect(at.getDate()).toBe(2);
  });
});

describe("dailyIdFromAlarm", () => {
  it("parses id", () => expect(dailyIdFromAlarm(`${DAILY_ALARM_PREFIX}7`)).toBe(7));
  it("returns null for a reminder alarm", () => expect(dailyIdFromAlarm("reminder:7")).toBeNull());
  it("returns null for a non-integer suffix", () => expect(dailyIdFromAlarm("daily:1.5")).toBeNull());
});

describe("isDailyFireMissed", () => {
  const scheduledTime = Date.parse("2026-01-01T08:00:00Z");

  it("false on-time delivery (now == scheduledTime)", () => {
    expect(isDailyFireMissed(scheduledTime, scheduledTime)).toBe(false);
  });

  it("false for a small delay within tolerance", () => {
    const now = scheduledTime + 60_000;
    expect(isDailyFireMissed(scheduledTime, now)).toBe(false);
  });

  it("false exactly at the tolerance boundary (strict >)", () => {
    const now = scheduledTime + DAILY_CATCHUP_TOLERANCE_MS;
    expect(isDailyFireMissed(scheduledTime, now)).toBe(false);
  });

  it("true well past tolerance (e.g. a 2-hour-late restart delivery)", () => {
    const now = scheduledTime + 2 * 60 * 60 * 1000;
    expect(isDailyFireMissed(scheduledTime, now)).toBe(true);
  });
});

describe("planDailyAlarms", () => {
  const now = new Date(2026, 0, 1, 8, 0, 0).getTime();
  const reminders = [
    { id: 1, hour: 20, minute: 0 },
    { id: 2, hour: 7, minute: 30 },
  ];

  it("creates an alarm for every reminder when none exist yet", () => {
    expect(planDailyAlarms(reminders, [], now)).toEqual([
      { name: `${DAILY_ALARM_PREFIX}1`, when: nextDailyTrigger(20, 0, now) },
      { name: `${DAILY_ALARM_PREFIX}2`, when: nextDailyTrigger(7, 30, now) },
    ]);
  });

  it("never recreates an alarm that already exists (must not clobber a pending fire)", () => {
    // 回归:心跳重排若顶掉一个刚到点、正待投递的 daily:1,今天就不会触发。
    const out = planDailyAlarms(reminders, [`${DAILY_ALARM_PREFIX}1`], now);
    expect(out).toEqual([{ name: `${DAILY_ALARM_PREFIX}2`, when: nextDailyTrigger(7, 30, now) }]);
  });

  it("returns nothing when all reminders already have alarms", () => {
    const existing = [`${DAILY_ALARM_PREFIX}1`, `${DAILY_ALARM_PREFIX}2`];
    expect(planDailyAlarms(reminders, existing, now)).toEqual([]);
  });

  it("ignores unrelated alarm names when deciding what is missing", () => {
    const existing = ["heartbeat", "timer:done", `${DAILY_ALARM_PREFIX}2`];
    expect(planDailyAlarms(reminders, existing, now)).toEqual([
      { name: `${DAILY_ALARM_PREFIX}1`, when: nextDailyTrigger(20, 0, now) },
    ]);
  });
});
