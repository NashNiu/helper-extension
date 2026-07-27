import { describe, expect, it } from "vitest";
import { presetNameKey, focusMethod, focusConfigFor } from "./focusMethods";
import { SHORT_BREAK_SEC, LONG_BREAK_SEC } from "./timerControl";

describe("presetNameKey", () => {
  it("maps built-in preset ids to their name key", () => {
    expect(presetNameKey(-1)).toBe("timer.preset.pomodoro");
    expect(presetNameKey(-4)).toBe("timer.preset.rule5217");
    expect(presetNameKey(-5)).toBe("timer.preset.rule90");
    expect(presetNameKey(-2)).toBe("timer.preset.shortBreak");
    expect(presetNameKey(-3)).toBe("timer.preset.longBreak");
  });
  it("returns null for unknown ids", () => {
    expect(presetNameKey(7)).toBeNull();
  });
});

describe("focusMethod", () => {
  it("pomodoro: 5/15 breaks, long every 4th, 4 cycles, not simple", () => {
    expect(focusMethod(-1)).toMatchObject({
      shortBreakSec: 5 * 60,
      longBreakSec: 15 * 60,
      longBreakEvery: 4,
      defaultCycles: 4,
      simple: false,
    });
  });
  it("52/17: 17-min break, no long break, 2 cycles, simple", () => {
    expect(focusMethod(-4)).toMatchObject({
      shortBreakSec: 17 * 60,
      longBreakSec: 17 * 60,
      longBreakEvery: 0,
      defaultCycles: 2,
      simple: true,
    });
  });
  it("90-minute: 20-min break, no long break, 2 cycles, simple", () => {
    expect(focusMethod(-5)).toMatchObject({
      shortBreakSec: 20 * 60,
      longBreakSec: 20 * 60,
      longBreakEvery: 0,
      defaultCycles: 2,
      simple: true,
    });
  });
  it("falls back to pomodoro for unknown ids", () => {
    expect(focusMethod(99)).toBe(focusMethod(-1));
  });
  it("pomodoro break durations stay in sync with timerControl constants", () => {
    expect(focusMethod(-1).shortBreakSec).toBe(SHORT_BREAK_SEC);
    expect(focusMethod(-1).longBreakSec).toBe(LONG_BREAK_SEC);
  });
});

describe("focusConfigFor", () => {
  it("uses the custom timer's own break/cycles when breakSeconds is given (simple, no long break)", () => {
    expect(focusConfigFor({ id: -100, breakSeconds: 600, cycles: 3 })).toEqual({
      shortBreakSec: 600,
      longBreakSec: 600,
      longBreakEvery: 0,
      defaultCycles: 3,
      simple: true,
      techniqueKey: "timer.customFocusTechnique",
    });
  });
  it("defaults custom cycles to 2 when omitted", () => {
    expect(focusConfigFor({ id: -101, breakSeconds: 300 }).defaultCycles).toBe(2);
  });
  it("falls back to the built-in registry when no breakSeconds", () => {
    expect(focusConfigFor({ id: -1 })).toBe(focusMethod(-1));
    expect(focusConfigFor({ id: -4 })).toBe(focusMethod(-4));
  });
});
