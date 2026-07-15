import {
  HEARTBEAT_ALARM,
  REMINDER_ALARM_PREFIX,
  TIMER_ALARM,
  planReminders,
  reminderIdFromAlarm,
  nextStep,
  DAILY_ALARM_PREFIX,
  dailyIdFromAlarm,
  nextDailyTrigger,
  isDailyFireMissed,
  planDailyAlarms,
} from "./logic";
import { reminderApi } from "../shared/api/reminder";
import { getActiveTimer, setActiveTimer } from "../shared/activeTimer";
import { translate } from "../i18n/core";
import { currentLocale } from "../shared/locale";
import { initClipboard } from "./clipboard";
import { storageGet, storageSet } from "../shared/storage";
import { localDailyReminders } from "../shared/local/dailyReminders";

const ICON = "icon-128.png";
// 记住回退弹窗的窗口 id:再次点通知时优先聚焦它,避免每次新建导致窗口越攒越多。
const PANEL_WINDOW_KEY = "helper.panelWindowId";
// 心跳/触发时需拿到全部待触发提醒(而非分页的前 10 条),故取一个较大的上限。
const SCHEDULE_LIMIT = 500;

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((e) => console.error(e));
  chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 1 });
  void initClipboard();
  void syncDailyAlarms();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 1 });
  void initClipboard();
  void syncDailyAlarms();
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
    await syncDailyAlarms();
  } catch (e) {
    console.error("heartbeat failed", e);
  }
}

// 自愈式补排:只为「当前没有闹钟」的每日提醒新建闹钟,绝不重建已存在的。
// 不能无条件重排——那会把一个刚到点、正待投递的闹钟顶到明天(心跳与到点闹钟常在
// 同一批唤醒,心跳先跑就会取消今天的触发),导致每日提醒永远不响。
async function syncDailyAlarms() {
  try {
    const list = await localDailyReminders.list();
    const existing = await chrome.alarms.getAll();
    console.log(
      "[daily-debug] syncDailyAlarms: reminders=",
      JSON.stringify(list),
      "existingAlarms=",
      existing.map((a) => `${a.name}@${new Date(a.scheduledTime).toISOString()}`),
    );
    const toCreate = planDailyAlarms(list, existing.map((a) => a.name), Date.now());
    console.log("[daily-debug] syncDailyAlarms: creating=", toCreate.map((s) => `${s.name}@${new Date(s.when).toISOString()}`));
    for (const s of toCreate) {
      chrome.alarms.create(s.name, { when: s.when });
    }
  } catch (e) {
    console.error("syncDailyAlarms failed", e);
  }
}

async function fireDaily(id: number, scheduledTime: number) {
  console.log("[daily-debug] fireDaily: id=", id, "scheduledTime=", new Date(scheduledTime).toISOString(), "now=", new Date().toISOString());
  try {
    const d = (await localDailyReminders.list()).find((x) => x.id === id);
    if (!d) {
      console.log("[daily-debug] fireDaily: reminder not found in store, aborting");
      return; // 已删除
    }
    // 只在准点(含小容差)时补弹;错过窗口(如浏览器重启后投递的过期闹钟)按设计只重排、不补提醒。
    const missed = isDailyFireMissed(scheduledTime, Date.now());
    console.log("[daily-debug] fireDaily: found reminder, missed=", missed);
    if (!missed) {
      const loc = await currentLocale();
      // 每次到点用唯一 id:同一固定 id 会被系统当「更新」而不重弹横幅。
      try {
        await notify(
          `${DAILY_ALARM_PREFIX}${d.id}:${Date.now()}`,
          translate(loc, "notify.reminderTitle"),
          d.message,
        );
        console.log("[daily-debug] fireDaily: notify() resolved OK");
      } catch (e) {
        console.error("[daily-debug] fireDaily: notify() FAILED", e);
      }
    }
    // 重排次日。
    chrome.alarms.create(`${DAILY_ALARM_PREFIX}${d.id}`, {
      when: nextDailyTrigger(d.hour, d.minute, Date.now()),
    });
    console.log("[daily-debug] fireDaily: rescheduled");
  } catch (e) {
    console.error("fireDaily failed", e);
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
  console.log("[daily-debug] onAlarm fired: name=", alarm.name, "scheduledTime=", new Date(alarm.scheduledTime).toISOString(), "now=", new Date().toISOString());
  if (alarm.name === HEARTBEAT_ALARM) {
    void runHeartbeat();
    return;
  }
  if (alarm.name === TIMER_ALARM) {
    void fireTimerDone();
    return;
  }
  const did = dailyIdFromAlarm(alarm.name);
  if (did !== null) {
    void fireDaily(did, alarm.scheduledTime);
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
