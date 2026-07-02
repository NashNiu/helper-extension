import {
  HEARTBEAT_ALARM,
  REMINDER_ALARM_PREFIX,
  TIMER_ALARM,
  planReminders,
  reminderIdFromAlarm,
  nextStep,
} from "./logic";
import { reminderApi } from "../shared/api/reminder";
import { getActiveTimer, setActiveTimer } from "../shared/activeTimer";

const ICON = "icon-128.png";
// 心跳/触发时需拿到全部待触发提醒(而非分页的前 10 条),故取一个较大的上限。
const SCHEDULE_LIMIT = 500;

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
    iconUrl: chrome.runtime.getURL(ICON),
    title,
    message,
    priority: 2,
    // 常驻直到用户处理,避免横幅一闪而过被错过。
    requireInteraction: true,
  });
}

async function fireReminder(reminderId: number) {
  // listPending 按登录态分流:登录读后端,未登录读本地。两种模式都要能触发。
  try {
    const pending = await reminderApi.listPending(0, SCHEDULE_LIMIT);
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
    const pending = await reminderApi.listPending(0, SCHEDULE_LIMIT);
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
  // 每次到点用唯一 id:同一固定 id 会被系统当作「更新」而不重新弹横幅。
  const nid = `${TIMER_ALARM}:${Date.now()}`;
  if (t.session) {
    // 会话:置等待态,不清空,等用户在面板手动进入下一段。
    await setActiveTimer({ ...t, status: "awaiting" });
    if (t.session.phase === "work") {
      await notify(nid, "该休息了", `「${t.name}」完成,打开面板开始休息`);
    } else {
      const finished = nextStep(t.session).done;
      await notify(
        nid,
        finished ? "全部完成 🎉" : "休息结束",
        finished ? "本轮番茄钟已全部完成" : "打开面板开始下一个番茄",
      );
    }
    return;
  }
  // 一次性计时:现状——通知 + 清空。
  await notify(nid, "时间到", `「${t.name}」已结束`);
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
