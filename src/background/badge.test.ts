import { describe, expect, it } from "vitest";
import { badgeFor, BADGE_WORK, BADGE_BREAK, BADGE_PAUSED, BADGE_AWAITING } from "./badge";
import type { ActiveTimer, PomodoroSession } from "./logic";

const NOW = 1_700_000_000_000;

function oneShot(over: Partial<ActiveTimer> = {}): ActiveTimer {
  return {
    timerId: 1,
    name: "专注",
    startAt: NOW,
    durationSeconds: 25 * 60,
    status: "running",
    ...over,
  };
}

function session(phase: PomodoroSession["phase"], over: Partial<ActiveTimer> = {}): ActiveTimer {
  return oneShot({
    session: {
      cycles: 4,
      cycleIndex: 1,
      phase,
      workSec: 25 * 60,
      shortBreakSec: 5 * 60,
      longBreakSec: 15 * 60,
      longBreakEvery: 4,
    },
    ...over,
  });
}

describe("badgeFor", () => {
  it("空闲时清空徒标", () => {
    expect(badgeFor(null, NOW).text).toBe("");
  });

  it("一次性计时显示剩余分钟,用工作色", () => {
    expect(badgeFor(oneShot(), NOW)).toEqual({ text: "25", bg: BADGE_WORK });
  });

  it("会话工作段用工作色", () => {
    expect(badgeFor(session("work"), NOW).bg).toBe(BADGE_WORK);
  });

  it("短休息和长休息都用休息色", () => {
    expect(badgeFor(session("short_break"), NOW).bg).toBe(BADGE_BREAK);
    expect(badgeFor(session("long_break"), NOW).bg).toBe(BADGE_BREAK);
  });

  it("分钟数随时间推进递减", () => {
    expect(badgeFor(oneShot(), NOW + 60_000).text).toBe("24");
  });

  it("暂停用灰色,且读冻结的 pausedRemaining 而不是墙钟", () => {
    const t = oneShot({ status: "paused", pausedRemaining: 12 * 60 });
    // 墙钟已过去 20 分钟,但暂停期间不该走
    expect(badgeFor(t, NOW + 20 * 60_000)).toEqual({ text: "12", bg: BADGE_PAUSED });
  });

  it("到点待确认显示「!」", () => {
    expect(badgeFor(oneShot({ status: "awaiting" }), NOW)).toEqual({
      text: "!",
      bg: BADGE_AWAITING,
    });
  });

  it("优先级:暂停盖过工作段颜色", () => {
    const t = session("work", { status: "paused", pausedRemaining: 300 });
    expect(badgeFor(t, NOW).bg).toBe(BADGE_PAUSED);
  });

  it("优先级:awaiting 盖过休息段颜色,且不显示数字", () => {
    const t = session("short_break", { status: "awaiting" });
    expect(badgeFor(t, NOW)).toEqual({ text: "!", bg: BADGE_AWAITING });
  });

  it("99 分钟仍按分钟显示", () => {
    expect(badgeFor(oneShot({ durationSeconds: 99 * 60 }), NOW).text).toBe("99");
  });

  it("100 分钟起改用小时", () => {
    expect(badgeFor(oneShot({ durationSeconds: 100 * 60 }), NOW).text).toBe("1h");
    expect(badgeFor(oneShot({ durationSeconds: 120 * 60 }), NOW).text).toBe("2h");
  });

  it("剩 1 秒显示 1 而不是 0", () => {
    expect(badgeFor(oneShot({ durationSeconds: 1 }), NOW).text).toBe("1");
  });

  it("暂停但 pausedRemaining 缺失时不崩,回退到 1", () => {
    const t = oneShot({ status: "paused" });
    expect(badgeFor(t, NOW)).toEqual({ text: "1", bg: BADGE_PAUSED });
  });

  it("徒标文字永远不超过 3 个字符", () => {
    for (const min of [1, 25, 99, 100, 500, 5000]) {
      expect(badgeFor(oneShot({ durationSeconds: min * 60 }), NOW).text.length)
        .toBeLessThanOrEqual(3);
    }
  });
});
