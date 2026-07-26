import type { MessageKey } from "../i18n/messages/en";

// 本地内置预设 id → 名称 i18n key(卡片标题、悬浮组件、通知、结束按钮统一取此)。
export function presetNameKey(id: number): MessageKey | null {
  switch (id) {
    case -1:
      return "timer.preset.pomodoro";
    case -4:
      return "timer.preset.rule5217";
    case -5:
      return "timer.preset.rule90";
    case -2:
      return "timer.preset.shortBreak";
    case -3:
      return "timer.preset.longBreak";
    default:
      return null;
  }
}

// 番茄钟类「专注方法」的休息配置。
export interface FocusMethod {
  shortBreakSec: number;
  longBreakSec: number;
  longBreakEvery: number;   // 每几轮一次长休息;0 = 无长休息(52/17、90 分钟)
  defaultCycles: number;
  simple: boolean;          // true = 单一休息、无长休息(设置页用简版副标题)
  techniqueKey: MessageKey; // 设置页标题 / 卡片副标题
}

// 经典番茄钟(5/15,每 4 轮长休息)。休息时长与 timerControl.SHORT/LONG_BREAK_SEC 一致
// (focusMethods.test.ts 断言二者相等,防止漂移)。
const POMODORO: FocusMethod = {
  shortBreakSec: 5 * 60,
  longBreakSec: 15 * 60,
  longBreakEvery: 4,
  defaultCycles: 4,
  simple: false,
  techniqueKey: "timer.pomodoroTechnique",
};

const FOCUS_METHODS: Record<number, FocusMethod> = {
  [-1]: POMODORO,
  // 52/17 法则:52 分钟工作 + 17 分钟休息,无长休息。
  [-4]: {
    shortBreakSec: 17 * 60,
    longBreakSec: 17 * 60,
    longBreakEvery: 0,
    defaultCycles: 2,
    simple: true,
    techniqueKey: "timer.rule5217Technique",
  },
  // 90 分钟计时法:90 分钟工作 + 20 分钟休息,无长休息。
  [-5]: {
    shortBreakSec: 20 * 60,
    longBreakSec: 20 * 60,
    longBreakEvery: 0,
    defaultCycles: 2,
    simple: true,
    techniqueKey: "timer.rule90Technique",
  },
};

// 工作预设的专注配置;未知 id(如后端自定义预设)按经典番茄钟处理。
export function focusMethod(id: number): FocusMethod {
  return FOCUS_METHODS[id] ?? POMODORO;
}
