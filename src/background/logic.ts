import type { Reminder } from "../shared/api/reminder";

export const REMINDER_ALARM_PREFIX = "reminder:";
export const HEARTBEAT_ALARM = "heartbeat";
export const TIMER_ALARM = "timer:done";

export interface ScheduleAction {
  dueNow: Reminder[];
  toSchedule: { name: string; when: number }[];
}

export function planReminders(pending: Reminder[], now: number): ScheduleAction {
  const dueNow: Reminder[] = [];
  const toSchedule: { name: string; when: number }[] = [];
  for (const r of pending) {
    if (r.is_triggered) continue;
    const when = Date.parse(r.trigger_at);
    if (Number.isNaN(when)) continue;
    if (when <= now) dueNow.push(r);
    else toSchedule.push({ name: `${REMINDER_ALARM_PREFIX}${r.id}`, when });
  }
  return { dueNow, toSchedule };
}

export function reminderIdFromAlarm(name: string): number | null {
  if (!name.startsWith(REMINDER_ALARM_PREFIX)) return null;
  const id = Number(name.slice(REMINDER_ALARM_PREFIX.length));
  return Number.isInteger(id) ? id : null;
}

export function remainingSeconds(startAt: number, durationSeconds: number, now: number): number {
  return Math.max(0, Math.round((startAt + durationSeconds * 1000 - now) / 1000));
}

export type Phase = "work" | "short_break" | "long_break";

export interface PomodoroSession {
  cycles: number;       // N,总循环数
  cycleIndex: number;   // 1..N,当前处于第几个循环
  phase: Phase;
  workSec: number;
  shortBreakSec: number;
  longBreakSec: number;
}

export interface ActiveTimer {
  timerId: number;
  name: string;               // 当前阶段展示名
  startAt: number;
  durationSeconds: number;
  status: "running" | "paused" | "awaiting"; // awaiting = 到点等用户点下一步
  pausedRemaining?: number;
  session?: PomodoroSession;  // 有则为番茄钟会话,无则为一次性计时
}

export function isLongBreakCycle(cycleIndex: number): boolean {
  return cycleIndex % 4 === 0;
}

// 一轮完整会话的总时长(秒):N 个工作段 + 每段后的休息(每 4 轮长休息,尾部休息保留)。
export function plannedTotalSeconds(
  cycles: number,
  workSec: number,
  shortBreakSec: number,
  longBreakSec: number,
): number {
  let total = 0;
  for (let k = 1; k <= cycles; k++) {
    total += workSec + (isLongBreakCycle(k) ? longBreakSec : shortBreakSec);
  }
  return total;
}

export function phaseDurationSec(session: PomodoroSession, phase: Phase): number {
  if (phase === "work") return session.workSec;
  if (phase === "long_break") return session.longBreakSec;
  return session.shortBreakSec;
}

export function phaseLabel(phase: Phase): string {
  if (phase === "work") return "番茄钟";
  if (phase === "long_break") return "长休息";
  return "短休息";
}

export interface NextStep {
  done: boolean;
  session: PomodoroSession;
  phase: Phase;
}

// 计算「用户点下一步」后的下一阶段。
export function nextStep(session: PomodoroSession): NextStep {
  if (session.phase === "work") {
    const phase: Phase = isLongBreakCycle(session.cycleIndex) ? "long_break" : "short_break";
    return { done: false, phase, session: { ...session, phase } };
  }
  // 当前是休息
  if (session.cycleIndex < session.cycles) {
    const phase: Phase = "work";
    return {
      done: false,
      phase,
      session: { ...session, cycleIndex: session.cycleIndex + 1, phase },
    };
  }
  return { done: true, phase: session.phase, session };
}

// 预计结束时刻(ms):当前阶段结束 + 所有剩余阶段时长之和(假设不间断)。
export function estimatedEndAt(timer: ActiveTimer, now: number): number {
  const currentEnd =
    timer.status === "paused"
      ? now + (timer.pausedRemaining ?? 0) * 1000
      : timer.startAt + timer.durationSeconds * 1000;
  if (!timer.session) return currentEnd;
  let total = 0;
  let step = nextStep(timer.session);
  while (!step.done) {
    total += phaseDurationSec(step.session, step.phase);
    step = nextStep(step.session);
  }
  return currentEnd + total * 1000;
}

// UI 展示用剩余秒:暂停冻结、等待为 0、运行按时钟计算。
export function displayRemaining(timer: ActiveTimer, now: number): number {
  if (timer.status === "paused") return timer.pausedRemaining ?? 0;
  if (timer.status === "awaiting") return 0;
  return remainingSeconds(timer.startAt, timer.durationSeconds, now);
}

export const DAILY_ALARM_PREFIX = "daily:";

// 下一次到点的时间戳(ms):今天 HH:MM 若仍在未来则今天,否则明天。
export function nextDailyTrigger(hour: number, minute: number, now: number): number {
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function dailyIdFromAlarm(name: string): number | null {
  if (!name.startsWith(DAILY_ALARM_PREFIX)) return null;
  const id = Number(name.slice(DAILY_ALARM_PREFIX.length));
  return Number.isInteger(id) ? id : null;
}

// 到点通知的容差(ms):闹钟被投递的时刻比计划时刻晚不超过此值才补弹;
// 超过则视为「浏览器当时未运行而错过」,按设计只重排、不补提醒。
export const DAILY_CATCHUP_TOLERANCE_MS = 5 * 60_000;

// 该次每日闹钟是否已错过补发窗口(投递延迟超过容差)。
export function isDailyFireMissed(scheduledTime: number, now: number): boolean {
  return now - scheduledTime > DAILY_CATCHUP_TOLERANCE_MS;
}
