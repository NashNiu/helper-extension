import {
  HEARTBEAT_ALARM,
  REMINDER_ALARM_PREFIX,
  TIMER_ALARM,
  planReminders,
  reminderIdFromAlarm,
} from "./logic";
import { reminderApi } from "../shared/api/reminder";
import { getActiveTimer, setActiveTimer } from "../shared/activeTimer";

const ICON = "icon-128.png";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((e) => console.error(e));
  chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 1 });
});

async function notify(id: string, title: string, message: string) {
  await chrome.notifications.create(id, {
    type: "basic",
    iconUrl: ICON,
    title,
    message,
    priority: 2,
  });
}

async function fireReminder(reminderId: number) {
  try {
    const pending = await reminderApi.listPending();
    const r = pending.find((x) => x.id === reminderId);
    if (!r) return; // 已被删除/触发
    await notify(`${REMINDER_ALARM_PREFIX}${r.id}`, "提醒", r.message);
    await reminderApi.markTriggered(r.id);
  } catch (e) {
    console.error("fireReminder failed", e);
  }
}

async function runHeartbeat() {
  try {
    const pending = await reminderApi.listPending();
    const { dueNow, toSchedule } = planReminders(pending, Date.now());
    for (const r of dueNow) {
      await notify(`${REMINDER_ALARM_PREFIX}${r.id}`, "提醒", r.message);
      await reminderApi.markTriggered(r.id);
    }
    for (const s of toSchedule) {
      chrome.alarms.create(s.name, { when: s.when });
    }
  } catch (e) {
    console.error("heartbeat failed", e);
  }
}

async function fireTimerDone() {
  const t = await getActiveTimer();
  if (!t) return;
  await notify(TIMER_ALARM, "时间到", `「${t.name}」已结束`);
  await setActiveTimer(null);
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === HEARTBEAT_ALARM) {
    void runHeartbeat();
    return;
  }
  if (alarm.name === TIMER_ALARM) {
    void fireTimerDone();
    return;
  }
  const rid = reminderIdFromAlarm(alarm.name);
  if (rid !== null) void fireReminder(rid);
});

// 点击任意通知 → 打开侧边栏（需在用户手势上下文之外尽力打开当前窗口）
chrome.notifications.onClicked.addListener((id) => {
  chrome.notifications.clear(id);
  chrome.windows
    .getCurrent()
    .then((w) => {
      if (w.id !== undefined) chrome.sidePanel.open({ windowId: w.id }).catch(() => {});
    })
    .catch(() => {});
});
