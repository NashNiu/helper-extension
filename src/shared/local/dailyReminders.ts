import { DAILY_ALARM_PREFIX, nextDailyTrigger } from "../../background/logic";
import { readList, writeList, nextId } from "./store";

export interface DailyReminder {
  id: number;
  message: string;
  hour: number;   // 0–23,本地时区
  minute: number; // 0–59
  created_at: string;
}

const KEY = "helper.local.dailyReminders";

function byTime(a: DailyReminder, b: DailyReminder): number {
  return a.hour - b.hour || a.minute - b.minute || a.id - b.id;
}

// 在扩展页面/SW 中都可用;测试等无 chrome.alarms 环境下静默跳过。
function scheduleAlarm(r: DailyReminder): void {
  try {
    if (typeof chrome !== "undefined" && chrome.alarms) {
      chrome.alarms.create(`${DAILY_ALARM_PREFIX}${r.id}`, {
        when: nextDailyTrigger(r.hour, r.minute, Date.now()),
      });
    }
  } catch {
    /* 忽略排程失败,后台 syncDailyAlarms 会兜底重排 */
  }
}

function clearAlarm(id: number): void {
  try {
    if (typeof chrome !== "undefined" && chrome.alarms) {
      chrome.alarms.clear(`${DAILY_ALARM_PREFIX}${id}`);
    }
  } catch {
    /* 忽略 */
  }
}

export const localDailyReminders = {
  async list(): Promise<DailyReminder[]> {
    return (await readList<DailyReminder>(KEY)).sort(byTime);
  },

  async create(data: { message: string; hour: number; minute: number }): Promise<DailyReminder> {
    const list = await readList<DailyReminder>(KEY);
    const reminder: DailyReminder = {
      id: nextId(list),
      message: data.message,
      hour: data.hour,
      minute: data.minute,
      created_at: new Date().toISOString(),
    };
    await writeList(KEY, [...list, reminder]);
    scheduleAlarm(reminder);
    return reminder;
  },

  async remove(id: number): Promise<void> {
    const list = await readList<DailyReminder>(KEY);
    await writeList(KEY, list.filter((r) => r.id !== id));
    clearAlarm(id);
  },
};
