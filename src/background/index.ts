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
import { LOCALE_KEY, detectSystemLocale, resolveLocale, translate, type Locale, type LocalePref } from "../i18n/core";
import { storageGet, storageSet } from "../shared/storage";

const ICON = "icon-128.png";
// 记住回退弹窗的窗口 id:再次点通知时优先聚焦它,避免每次新建导致窗口越攒越多。
const PANEL_WINDOW_KEY = "helper.panelWindowId";
// 心跳/触发时需拿到全部待触发提醒(而非分页的前 10 条),故取一个较大的上限。
const SCHEDULE_LIMIT = 500;

async function currentLocale(): Promise<Locale> {
  const pref = (await storageGet<LocalePref>(LOCALE_KEY)) ?? "system";
  return resolveLocale(pref, detectSystemLocale());
}

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
    const loc = await currentLocale();
    await notify(`${REMINDER_ALARM_PREFIX}${r.id}`, translate(loc, "notify.reminderTitle"), r.message);
    await reminderApi.markTriggered(r.id);
  } catch (e) {
    console.error("fireReminder failed", e);
  }
}

async function runHeartbeat() {
  try {
    const pending = await reminderApi.listPending(0, SCHEDULE_LIMIT);
    const { dueNow, toSchedule } = planReminders(pending, Date.now());
    const loc = await currentLocale();
    for (const r of dueNow) {
      await notify(`${REMINDER_ALARM_PREFIX}${r.id}`, translate(loc, "notify.reminderTitle"), r.message);
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
  const loc = await currentLocale();
  // 每次到点用唯一 id:同一固定 id 会被系统当作「更新」而不重新弹横幅。
  const nid = `${TIMER_ALARM}:${Date.now()}`;
  if (t.session) {
    // 会话:置等待态,不清空,等用户在面板手动进入下一段。
    await setActiveTimer({ ...t, status: "awaiting" });
    if (t.session.phase === "work") {
      await notify(
        nid,
        translate(loc, "notify.breakTitle"),
        translate(loc, "notify.breakBody", { name: translate(loc, "timer.preset.pomodoro") }),
      );
    } else {
      const finished = nextStep(t.session).done;
      await notify(
        nid,
        finished ? translate(loc, "notify.allDoneTitle") : translate(loc, "notify.breakOverTitle"),
        finished ? translate(loc, "notify.allDoneBody") : translate(loc, "notify.breakOverBody"),
      );
    }
    return;
  }
  // 一次性计时:现状——通知 + 清空。
  await notify(nid, translate(loc, "notify.timeUp"), translate(loc, "notify.timerEnded", { name: t.name }));
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

// 打开面板弹窗:若上次开的窗口还在,聚焦它;否则新建一个并记住 id。
// 无 tabs 权限无法按 URL 查已开标签,故用存储的窗口 id 去重。
async function focusOrCreatePanel(): Promise<void> {
  const savedId = await storageGet<number>(PANEL_WINDOW_KEY);
  if (typeof savedId === "number") {
    try {
      await chrome.windows.get(savedId); // 抛错 = 窗口已关闭
      await chrome.windows.update(savedId, { focused: true });
      return;
    } catch {
      // 窗口不存在,继续新建
    }
  }
  const win = await chrome.windows.create({
    url: chrome.runtime.getURL("src/panel/index.html"),
    type: "popup",
    width: 420,
    height: 680,
  });
  if (win.id !== undefined) await storageSet(PANEL_WINDOW_KEY, win.id);
}

// 点击通知 → 打开应用。优先侧边栏;但 MV3 里从通知点击打开侧边栏受「用户手势」
// 限制(取窗口 id 的异步调用会消耗手势),常会失败,故失败时退回用弹窗打开面板页,
// 保证点通知一定能进入应用。
chrome.notifications.onClicked.addListener((id) => {
  chrome.notifications.clear(id);
  chrome.windows
    .getLastFocused()
    .then((w) => {
      if (w.id === undefined) throw new Error("no window");
      return chrome.sidePanel.open({ windowId: w.id });
    })
    .catch(() => focusOrCreatePanel().catch(() => {}));
});

// 面板弹窗被关闭时清掉记录,避免下次误聚焦到别的窗口。
chrome.windows.onRemoved.addListener((winId) => {
  void storageGet<number>(PANEL_WINDOW_KEY).then((saved) => {
    if (saved === winId) void storageSet(PANEL_WINDOW_KEY, null);
  });
});
