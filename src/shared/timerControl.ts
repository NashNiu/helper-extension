import { getActiveTimer, setActiveTimer } from "./activeTimer";
import {
  TIMER_ALARM,
  remainingSeconds,
  nextStep,
  phaseDurationSec,
  phaseLabel,
  type PomodoroSession,
} from "../background/logic";
import type { Timer } from "./api/timer";

export const SHORT_BREAK_SEC = 5 * 60;
export const LONG_BREAK_SEC = 15 * 60;

function setTimerAlarm(when: number): void {
  if (typeof chrome !== "undefined" && chrome.alarms) {
    chrome.alarms.create(TIMER_ALARM, { when });
  }
}

function clearTimerAlarm(): void {
  if (typeof chrome !== "undefined" && chrome.alarms) {
    void chrome.alarms.clear(TIMER_ALARM);
  }
}

/**
 * 启动一次性计时(无 session):供 TimerView 点非工作预设、未登录 QuickAdd「计时X分钟」共用。
 */
export async function startTimer(
  timerId: number,
  name: string,
  durationSeconds: number,
): Promise<void> {
  const startAt = Date.now();
  await setActiveTimer({ timerId, name, startAt, durationSeconds, status: "running" });
  setTimerAlarm(startAt + durationSeconds * 1000);
}

/** 番茄钟类循环会话的休息配置;缺省即经典番茄钟(5/15,每 4 轮长休息)。 */
export interface FocusBreakOpts {
  shortBreakSec?: number;
  longBreakSec?: number;
  longBreakEvery?: number; // 0 = 无长休息(如 52/17 法则)
}

/** 启动番茄钟类循环会话:第 1 个工作段立即运行。 */
export async function startPomodoro(
  workTimer: Timer,
  cycles: number,
  opts: FocusBreakOpts = {},
): Promise<void> {
  const n = Math.min(12, Math.max(1, Math.round(cycles) || 1));
  const startAt = Date.now();
  const session: PomodoroSession = {
    cycles: n,
    cycleIndex: 1,
    phase: "work",
    workSec: workTimer.duration_seconds,
    shortBreakSec: opts.shortBreakSec ?? SHORT_BREAK_SEC,
    longBreakSec: opts.longBreakSec ?? LONG_BREAK_SEC,
    longBreakEvery: opts.longBreakEvery ?? 4,
  };
  await setActiveTimer({
    timerId: workTimer.id,
    name: phaseLabel("work"),
    startAt,
    durationSeconds: session.workSec,
    status: "running",
    session,
  });
  setTimerAlarm(startAt + session.workSec * 1000);
}

/** 用户在 awaiting 态点「下一步」:进入下一阶段,或结束会话。 */
export async function advancePhase(): Promise<void> {
  const t = await getActiveTimer();
  if (!t || !t.session) return;
  const step = nextStep(t.session);
  if (step.done) {
    await setActiveTimer(null);
    clearTimerAlarm();
    return;
  }
  const startAt = Date.now();
  const durationSeconds = phaseDurationSec(step.session, step.phase);
  await setActiveTimer({
    ...t,
    name: phaseLabel(step.phase),
    startAt,
    durationSeconds,
    status: "running",
    pausedRemaining: undefined,
    session: step.session,
  });
  setTimerAlarm(startAt + durationSeconds * 1000);
}

export async function pauseTimer(): Promise<void> {
  const t = await getActiveTimer();
  if (!t || t.status !== "running") return;
  const pausedRemaining = remainingSeconds(t.startAt, t.durationSeconds, Date.now());
  await setActiveTimer({ ...t, status: "paused", pausedRemaining });
  clearTimerAlarm();
}

export async function resumeTimer(): Promise<void> {
  const t = await getActiveTimer();
  if (!t || t.status !== "paused") return;
  const startAt = Date.now();
  const durationSeconds = t.pausedRemaining ?? 0;
  await setActiveTimer({
    ...t,
    status: "running",
    startAt,
    durationSeconds,
    pausedRemaining: undefined,
  });
  setTimerAlarm(startAt + durationSeconds * 1000);
}

/** 重置当前阶段:从本阶段完整时长重新计时(会话或一次性均适用)。 */
export async function restartPhase(): Promise<void> {
  const t = await getActiveTimer();
  if (!t) return;
  const startAt = Date.now();
  await setActiveTimer({ ...t, startAt, status: "running", pausedRemaining: undefined });
  setTimerAlarm(startAt + t.durationSeconds * 1000);
}

export async function cancelTimer(): Promise<void> {
  await setActiveTimer(null);
  clearTimerAlarm();
}
