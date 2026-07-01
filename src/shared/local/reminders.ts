import type { Reminder } from "../api/reminder";
import { REMINDER_ALARM_PREFIX } from "../../background/logic";
import { readList, writeList, nextId } from "./store";

const KEY = "helper.local.reminders";

// 与后端一致:按触发时间正序(近的在前)。
function byTriggerAsc(a: Reminder, b: Reminder): number {
  return a.trigger_at.localeCompare(b.trigger_at) || a.id - b.id;
}

// 在扩展页面/SW 中都可用;测试等无 chrome.alarms 环境下静默跳过。
function scheduleAlarm(r: Reminder): void {
  try {
    const when = Date.parse(r.trigger_at);
    if (Number.isNaN(when)) return;
    if (typeof chrome !== "undefined" && chrome.alarms) {
      chrome.alarms.create(`${REMINDER_ALARM_PREFIX}${r.id}`, { when });
    }
  } catch {
    /* 忽略排程失败,心跳会兜底重排 */
  }
}

function clearAlarm(id: number): void {
  try {
    if (typeof chrome !== "undefined" && chrome.alarms) {
      chrome.alarms.clear(`${REMINDER_ALARM_PREFIX}${id}`);
    }
  } catch {
    /* 忽略 */
  }
}

export const localReminders = {
  async listPending(offset = 0, limit = 10): Promise<Reminder[]> {
    const all = (await readList<Reminder>(KEY))
      .filter((r) => !r.is_triggered)
      .sort(byTriggerAsc);
    return all.slice(offset, offset + limit);
  },

  async create(data: { message: string; trigger_at: string }): Promise<Reminder> {
    const list = await readList<Reminder>(KEY);
    const reminder: Reminder = {
      id: nextId(list),
      message: data.message,
      trigger_at: data.trigger_at,
      is_triggered: false,
      created_at: new Date().toISOString(),
    };
    await writeList(KEY, [...list, reminder]);
    scheduleAlarm(reminder);
    return reminder;
  },

  async markTriggered(id: number): Promise<Reminder> {
    const list = await readList<Reminder>(KEY);
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`local reminder ${id} not found`);
    list[idx] = { ...list[idx], is_triggered: true };
    await writeList(KEY, list);
    return list[idx];
  },

  async remove(id: number): Promise<void> {
    const list = await readList<Reminder>(KEY);
    await writeList(KEY, list.filter((r) => r.id !== id));
    clearAlarm(id);
  },
};
