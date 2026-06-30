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

export interface ActiveTimer {
  timerId: number;
  name: string;
  startAt: number;
  durationSeconds: number;
  status: "running" | "paused";
  pausedRemaining?: number;
}
