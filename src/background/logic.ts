import type { Reminder } from "../shared/api/reminder";
import type { Todo } from "../shared/api/todo";

export const REMINDER_ALARM_PREFIX = "reminder:";
export const TODO_REMIND_ALARM_PREFIX = "todoRemind:";
export const HEARTBEAT_ALARM = "heartbeat";
export const TIMER_ALARM = "timer:done";

export interface ScheduleAction {
  dueNow: Reminder[];
  toSchedule: { name: string; when: number }[];
}

interface TriggerSpec<T> {
  prefix: string;
  /** 返回 NaN 表示这项没有可用的时间，跳过。 */
  getTime: (item: T) => number;
  /** 已经不需要再触发了(已弹过 / 已完成)。 */
  isFired: (item: T) => boolean;
}

/**
 * 「哪些该现在弹、哪些该建闹钟」的通用规划。提醒与待办提醒共用。
 *
 * dueNow 不设过期窗口——过点多久都补弹一次。这与每日提醒和计时刻意不同
 * (那两者有 5 分钟容差，见 DAILY_CATCHUP_TOLERANCE_MS)：一条到点提醒错过了
 * 仍然是有用信息，而「八小时前该休息了」只是噪音。
 */
export function planTriggers<T extends { id: number }>(
  items: T[],
  spec: TriggerSpec<T>,
  now: number,
): { dueNow: T[]; toSchedule: { name: string; when: number }[] } {
  const dueNow: T[] = [];
  const toSchedule: { name: string; when: number }[] = [];
  for (const item of items) {
    if (spec.isFired(item)) continue;
    const when = spec.getTime(item);
    if (Number.isNaN(when)) continue;
    if (when <= now) dueNow.push(item);
    else toSchedule.push({ name: `${spec.prefix}${item.id}`, when });
  }
  return { dueNow, toSchedule };
}

export function planReminders(pending: Reminder[], now: number): ScheduleAction {
  return planTriggers(
    pending,
    {
      prefix: REMINDER_ALARM_PREFIX,
      getTime: (r) => Date.parse(r.trigger_at),
      isFired: (r) => r.is_triggered,
    },
    now,
  );
}

export function planTodoReminders(
  pending: Todo[],
  now: number,
): { dueNow: Todo[]; toSchedule: { name: string; when: number }[] } {
  return planTriggers(
    pending,
    {
      prefix: TODO_REMIND_ALARM_PREFIX,
      // 已完成也算「不必再触发」：列表理论上已过滤，但心跳拿到的是缓存/离线数据时
      // 这道判断是最后一关，不能只信调用方。
      getTime: (t) => (t.remind_at ? Date.parse(t.remind_at) : NaN),
      isFired: (t) => t.is_done || t.remind_triggered,
    },
    now,
  );
}

export function reminderIdFromAlarm(name: string): number | null {
  if (!name.startsWith(REMINDER_ALARM_PREFIX)) return null;
  const id = Number(name.slice(REMINDER_ALARM_PREFIX.length));
  return Number.isInteger(id) ? id : null;
}

export function todoRemindIdFromAlarm(name: string): number | null {
  if (!name.startsWith(TODO_REMIND_ALARM_PREFIX)) return null;
  const id = Number(name.slice(TODO_REMIND_ALARM_PREFIX.length));
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
  longBreakEvery?: number; // 每几个循环一次长休息(默认 4);0 表示无长休息(如 52/17 法则)
}

export interface ActiveTimer {
  timerId: number;
  name: string;               // 当前阶段展示名
  startAt: number;
  durationSeconds: number;
  status: "running" | "paused" | "awaiting"; // awaiting = 到点等用户点下一步
  pausedRemaining?: number;
  session?: PomodoroSession;  // 有则为番茄钟会话,无则为一次性计时
  methodName?: string;        // 会话方法名(内置=预设名,自定义=用户名);不随阶段变化
}

// 该循环后是否进入长休息:every>0 时每 every 个循环一次;every=0 表示没有长休息(如 52/17)。
export function isLongBreakCycle(cycleIndex: number, every = 4): boolean {
  return every > 0 && cycleIndex % every === 0;
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
    const phase: Phase = isLongBreakCycle(session.cycleIndex, session.longBreakEvery ?? 4)
      ? "long_break"
      : "short_break";
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

// 规划需要新建的每日闹钟:只为「当前没有闹钟」的提醒补建,绝不动已存在的。
// 关键——重建会用 nextDailyTrigger 把一个刚到点、正等待投递的闹钟改排到明天,
// 从而取消今天的触发(心跳与到点闹钟常在同一批被唤醒,心跳先跑就会顶掉它)。
// 已存在的闹钟要么在未来(没问题),要么正待投递(必须留着让它触发,fireDaily 会重排次日)。
export function planDailyAlarms(
  reminders: { id: number; hour: number; minute: number }[],
  existingNames: string[],
  now: number,
): { name: string; when: number }[] {
  const has = new Set(existingNames);
  const toCreate: { name: string; when: number }[] = [];
  for (const d of reminders) {
    const name = `${DAILY_ALARM_PREFIX}${d.id}`;
    if (has.has(name)) continue;
    toCreate.push({ name, when: nextDailyTrigger(d.hour, d.minute, now) });
  }
  return toCreate;
}

// 计时到点后的补触发容忍窗口。与每日提醒同一策略、同一数值:窗口内算「刚过点」,
// 补一次正常触发;超出窗口(如浏览器关了一夜)只结算状态,不补弹通知——八小时后
// 突然弹一个「该休息了」只是噪音。
export const TIMER_CATCHUP_TOLERANCE_MS = DAILY_CATCHUP_TOLERANCE_MS;

/** 自愈动作。none = 什么都不做;schedule = 补建闹钟;fire = 走正常到点流程;expire = 静默结算。 */
export type TimerRecovery =
  | { kind: "none" }
  | { kind: "schedule"; when: number }
  | { kind: "fire" }
  | { kind: "expire" };

/**
 * 拿持久化的计时状态核对 TIMER_ALARM,判断要不要自愈、怎么自愈。纯函数,便于单测。
 *
 * 为什么需要它:ActiveTimer 存在 storage 里(持久),但 TIMER_ALARM 只由面板侧的
 * timerControl 创建。扩展重载会清掉闹钟却留下状态,于是计时永远不会响——而这是
 * 唯一的完成路径(useCountdown 只渲染,awaiting 只由 fireTimerDone 设置)。
 */
export function planTimerAlarm(
  timer: ActiveTimer | null,
  hasTimerAlarm: boolean,
  now: number,
): TimerRecovery {
  if (!timer) return { kind: "none" };
  // 只有 running 才该有闹钟:paused 是故意清掉的,awaiting 说明早就触发过了。
  if (timer.status !== "running") return { kind: "none" };
  // 闹钟还在就绝不插手。照 planDailyAlarms 的教训:重建会把一个刚到点、正待投递的
  // 闹钟顶掉(心跳与到点闹钟常在同一批唤醒,心跳先跑就会取消这次触发)。
  if (hasTimerAlarm) return { kind: "none" };
  const due = timer.startAt + timer.durationSeconds * 1000;
  // 用原定到点时刻,不能「从现在起重新算一遍」——那会把已经走掉的时间白送回去。
  if (due > now) return { kind: "schedule", when: due };
  if (now - due <= TIMER_CATCHUP_TOLERANCE_MS) return { kind: "fire" };
  return { kind: "expire" };
}
