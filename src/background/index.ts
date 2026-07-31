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
  planTimerAlarm,
} from "./logic";
import { reminderApi } from "../shared/api/reminder";
import { getActiveTimer, setActiveTimer, ACTIVE_TIMER_KEY } from "../shared/activeTimer";
import { translate } from "../i18n/core";
import { currentLocale } from "../shared/locale";
import { initClipboard } from "./clipboard";
import { storageGet, storageSet } from "../shared/storage";
import { localDailyReminders } from "../shared/local/dailyReminders";
import { presetNameKey } from "../shared/focusMethods";
import { playChime } from "./sound";
import type { ChimeTone } from "../shared/chime";
import { refreshBadge } from "./badge";

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
  void refreshBadge();
  void recoverTimerAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 1 });
  void initClipboard();
  void syncDailyAlarms();
});

async function notify(id: string, title: string, message: string, tone: ChimeTone) {
  // 不 await:声音失败绝不能挡住横幅,也不该让横幅等它。
  void playChime(tone);
  await chrome.notifications.create(id, {
    type: "basic",
    iconUrl: chrome.runtime.getURL(ICON),
    title,
    message,
    priority: 2,
    // 常驻直到用户处理,避免横幅一闪而过被错过。
    requireInteraction: true,
    // 压掉系统通知中心自带的提示音:我们自己已经放了 chime,两个声音会叠在一起。
    // 关掉声音开关时就是彻底静音——「关掉声音提醒」本来就该是这个意思。
    silent: true,
  });
}

async function fireReminder(reminderId: number) {
  // listPending 按登录态分流:登录读后端,未登录读本地。两种模式都要能触发。
  try {
    const pending = await reminderApi.listPending(0, SCHEDULE_LIMIT);
    const r = pending.find((x) => x.id === reminderId);
    if (!r) return; // 已被删除/触发
    const loc = await currentLocale();
    await notify(`${REMINDER_ALARM_PREFIX}${r.id}`, translate(loc, "notify.reminderTitle"), r.message, "reminder");
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
      await notify(`${REMINDER_ALARM_PREFIX}${r.id}`, translate(loc, "notify.reminderTitle"), r.message, "reminder");
      await reminderApi.markTriggered(r.id);
    }
    for (const s of toSchedule) {
      chrome.alarms.create(s.name, { when: s.when });
    }
    await syncDailyAlarms();
  } catch (e) {
    console.error("heartbeat failed", e);
  } finally {
    // 放 finally:上面的 listPending 离线时会抛,不能让网络失败把自愈和徒标一起冻住。
    void recoverTimerAlarm();
    void refreshBadge();
  }
}

// 自愈式补排:只为「当前没有闹钟」的每日提醒新建闹钟,绝不重建已存在的。
// 不能无条件重排——那会把一个刚到点、正待投递的闹钟顶到明天(心跳与到点闹钟常在
// 同一批唤醒,心跳先跑就会取消今天的触发),导致每日提醒永远不响。
async function syncDailyAlarms() {
  try {
    const list = await localDailyReminders.list();
    const existing = await chrome.alarms.getAll();
    const toCreate = planDailyAlarms(list, existing.map((a) => a.name), Date.now());
    for (const s of toCreate) {
      chrome.alarms.create(s.name, { when: s.when });
    }
  } catch (e) {
    console.error("syncDailyAlarms failed", e);
  }
}

async function fireDaily(id: number, scheduledTime: number) {
  try {
    const d = (await localDailyReminders.list()).find((x) => x.id === id);
    if (!d) return; // 已删除
    // 只在准点(含小容差)时补弹;错过窗口(如浏览器重启后投递的过期闹钟)按设计只重排、不补提醒。
    if (!isDailyFireMissed(scheduledTime, Date.now())) {
      const loc = await currentLocale();
      // 每次到点用唯一 id:同一固定 id 会被系统当「更新」而不重弹横幅。
      await notify(
        `${DAILY_ALARM_PREFIX}${d.id}:${Date.now()}`,
        translate(loc, "notify.reminderTitle"),
        d.message,
        "reminder",
      );
    }
    // 重排次日。
    chrome.alarms.create(`${DAILY_ALARM_PREFIX}${d.id}`, {
      when: nextDailyTrigger(d.hour, d.minute, Date.now()),
    });
  } catch (e) {
    console.error("fireDaily failed", e);
  }
}

// silent = true:只结算状态,不弹通知不响 chime。用于自愈时发现计时已过期太久
// (如浏览器关了一夜)——阶段确实结束了,状态该转,但八小时后补弹通知只是噪音。
async function fireTimerDone(silent = false) {
  const t = await getActiveTimer();
  // 只结算「正在跑」的计时。加上状态判断让这个函数幂等:自愈与到点闹钟可能在同一批
  // 唤醒里都想结算同一个计时,第二个进来时状态已是 awaiting(会话)或已被清空(一次性),
  // 这里直接返回,不会重复弹横幅。
  if (!t || t.status !== "running") return;
  const loc = await currentLocale();
  // 每次到点用唯一 id:同一固定 id 会被系统当作「更新」而不重新弹横幅。
  const nid = `${TIMER_ALARM}:${Date.now()}`;
  if (t.session) {
    // 会话:置等待态,不清空,等用户在面板手动进入下一段。
    await setActiveTimer({ ...t, status: "awaiting" });
    const nameKey = presetNameKey(t.timerId);
    const methodName = nameKey ? translate(loc, nameKey) : (t.methodName ?? t.name);
    if (t.session.phase === "work") {
      if (!silent) {
        await notify(
          nid,
          translate(loc, "notify.breakTitle"),
          translate(loc, "notify.breakBody", { name: methodName }),
          "timer",
        );
      }
    } else {
      const finished = nextStep(t.session).done;
      if (!silent) {
        await notify(
          nid,
          finished ? translate(loc, "notify.allDoneTitle") : translate(loc, "notify.breakOverTitle"),
          finished
            ? translate(loc, "notify.allDoneBody", { name: methodName })
            : translate(loc, "notify.breakOverBody"),
          "timer",
        );
      }
    }
    return;
  }
  // 一次性计时:通知 + 清空。
  if (!silent) {
    await notify(nid, translate(loc, "notify.timeUp"), translate(loc, "notify.timerEnded", { name: t.name }), "timer");
  }
  await setActiveTimer(null);
}

// 结算串行化。与 fireTimerDone 里的状态判断配对使用,两道缺一不可:
// 判断保证「状态已变就不重复结算」,串行化保证「第二个进来时状态确实已经变了」。
// 否则自愈与到点闹钟在同一批唤醒里并发跑,两边都会在第一个 await 处读到 running。
let settleTail: Promise<void> = Promise.resolve();
function settleTimer(silent: boolean): Promise<void> {
  // 用 catch 起链:前一次结算失败不能把后续的结算全部卡死。
  const run = settleTail.catch(() => {}).then(() => fireTimerDone(silent));
  settleTail = run.catch(() => {});
  return run;
}

// 拿持久化的计时状态核对 TIMER_ALARM,缺了就补。
//
// 为什么需要:ActiveTimer 存在 storage 里(持久),而 TIMER_ALARM 只由面板侧的
// timerControl 创建。扩展重载/更新会清掉闹钟却留下状态,于是这个计时永远不会响
// ——TIMER_ALARM → fireTimerDone 是唯一的完成路径。提醒和每日提醒早就各有自愈
// (planReminders / planDailyAlarms),计时之前被漏了。
async function recoverTimerAlarm() {
  try {
    const t = await getActiveTimer();
    // 已存在的闹钟必须原样不动,所以先查再判。
    const existing = await chrome.alarms.get(TIMER_ALARM);
    // @types/chrome 把 alarms.get 标成返回 Promise<Alarm>,但实际没有闹钟时
    // Chrome 会 resolve undefined。用 != null 兜住 null/undefined 两种哨兵值,
    // 避免哪天引擎行为变了、严格比较误判成「闹钟还在」导致自愈永久失效。
    const action = planTimerAlarm(t, existing != null, Date.now());
    if (action.kind === "schedule") {
      chrome.alarms.create(TIMER_ALARM, { when: action.when });
    } else if (action.kind === "fire") {
      await settleTimer(false);
    } else if (action.kind === "expire") {
      await settleTimer(true);
    }
  } catch (e) {
    console.error("recoverTimerAlarm failed", e);
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === HEARTBEAT_ALARM) {
    void runHeartbeat();
    return;
  }
  if (alarm.name === TIMER_ALARM) {
    void settleTimer(false);
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

// 计时状态一变就刷徒标。
//
// 监听 storage 而不是去改 timerControl.ts:那些操作(开始/暂停/继续/下一步/取消)跑在面板
// 上下文里,而徒标只能由 service worker 写。解耦之后面板只管改状态,SW 只管反映状态,
// 一个监听器就覆盖了全部状态变更——包括 fireTimerDone 自己置的 awaiting 态。
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  // 必须按 key 过滤:剪贴板、设置等写入很频繁,不过滤就会每次都白刷一遍徒标。
  if (!(ACTIVE_TIMER_KEY in changes)) return;
  void refreshBadge();
});

// service worker 每次被拉起都会重跑顶层脚本,这里是覆盖「SW 重启 / 浏览器重启」的唯一
// 正确位置——onStartup 只在浏览器 profile 启动时触发,SW 被回收后重新拉起不会触发它。
void refreshBadge();
void recoverTimerAlarm();
