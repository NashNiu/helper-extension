import { setActiveTimer } from "./activeTimer";
import { TIMER_ALARM } from "../background/logic";

/**
 * 启动一个计时:写入活动计时状态 + 注册到点闹钟。
 * 供 TimerView(点预设)和未登录 QuickAdd(“计时X分钟” → 立即开始)共用。
 */
export async function startTimer(
  timerId: number,
  name: string,
  durationSeconds: number,
): Promise<void> {
  const startAt = Date.now();
  await setActiveTimer({
    timerId,
    name,
    startAt,
    durationSeconds,
    status: "running",
  });
  if (typeof chrome !== "undefined" && chrome.alarms) {
    chrome.alarms.create(TIMER_ALARM, { when: startAt + durationSeconds * 1000 });
  }
}
