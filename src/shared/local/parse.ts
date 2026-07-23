import {
  parseClockEn,
  parseTimerEn,
  tryRelativeEn,
  tryNamedDayEn,
  tryWeekdayEn,
  tryAbsoluteEn,
  cleanReminderMessageEn,
  hasEnDateAnchorEn,
} from "./parseEn";

export type AssistantType = "reminder" | "timer" | "todo";

export interface ParsedReminder {
  message: string;
  trigger_at: string; // ISO 8601
}

export interface ParsedTimer {
  name: string;
  duration_seconds: number;
}

/** 正则片段:匹配一段阿拉伯数字或中文数字。使用时用 `(${NUM})` 包成捕获组。 */
export const NUM = "\\d+|[零〇一二两三四五六七八九十]+";

const DIGIT: Record<string, number> = {
  零: 0, "〇": 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4,
  五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

/** 中文/阿拉伯数字 → number,支持 0–59 的常见组合;无法识别返回 null。 */
export function zhToNum(s: string): number | null {
  if (!s) return null;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (s.length === 1) return s in DIGIT ? DIGIT[s] : null;
  if (s[0] === "十") {
    const u = DIGIT[s[1]];
    return u == null || u >= 10 ? null : 10 + u;
  }
  const ti = s.indexOf("十");
  if (ti > 0) {
    const tens = DIGIT[s.slice(0, ti)];
    if (tens == null || tens >= 10) return null;
    const rest = s.slice(ti + 1);
    if (rest === "") return tens * 10;
    const u = DIGIT[rest];
    return u == null || u >= 10 ? null : tens * 10 + u;
  }
  return null;
}

/** 解析时长(分/时/秒,含"半小时"),返回总秒数;无时长返回 null。 */
export function parseDuration(input: string): number | null {
  let total = 0;
  let found = false;

  const h = input.match(new RegExp(`(${NUM})\\s*(?:个|個)?\\s*(?:小时|小時|钟头|鐘頭)`));
  if (h) {
    const n = zhToNum(h[1]);
    if (n != null) { total += n * 3600; found = true; }
  }
  if (/半\s*(?:个|個)?\s*(?:小时|小時|钟头|鐘頭)/.test(input)) {
    total += 1800; found = true;
  }
  const m = input.match(new RegExp(`(${NUM})\\s*(?:分钟|分鐘|分)`));
  if (m) {
    const n = zhToNum(m[1]);
    if (n != null) { total += n * 60; found = true; }
  }
  const s = input.match(new RegExp(`(${NUM})\\s*(?:秒钟?|秒鐘?)`));
  if (s) {
    const n = zhToNum(s[1]);
    if (n != null) { total += n; found = true; }
  }
  return found ? total : null;
}

/** 解析计时:提取时长 + 计时名。无时长且非番茄钟返回 null。 */
export function parseTimer(input: string): ParsedTimer | null {
  let seconds = parseDuration(input);
  const isPomodoro = /番茄|蕃茄/.test(input);
  if (seconds == null && isPomodoro) seconds = 25 * 60;
  if (seconds == null || seconds <= 0) return /[一-鿿]/.test(input) ? null : parseTimerEn(input);

  const name = input
    .replace(/(计时|計時|倒计时|倒計時|定时|定時|番茄钟?|蕃茄钟?|专注|專注)/g, "")
    .replace(/半\s*(?:个|個)?\s*(?:小时|小時|钟头|鐘頭)/g, "")
    .replace(
      new RegExp(`(${NUM})\\s*(?:个|個)?\\s*(?:小时|小時|钟头|鐘頭|分钟|分鐘|分|秒钟?|秒鐘?)`, "g"),
      "",
    )
    .replace(/\s+/g, "")
    .trim();

  if (name) return { name, duration_seconds: seconds };
  return { name: isPomodoro ? "番茄钟" : "计时", duration_seconds: seconds };
}

/** 解析「几点几分」并应用时段(下午/晚上 +12 等);无时刻返回 null。 */
export function parseClock(input: string): { hour: number; minute: number } | null {
  const re = new RegExp(
    `(上午|早上|早晨|凌晨|中午|下午|傍晚|晚上|夜里|夜晚)?\\s*(${NUM})\\s*[点點:：时時]\\s*(半|一刻|三刻|(?:${NUM}))?\\s*分?`,
  );
  const m = input.match(re);
  if (!m) return parseClockEn(input);

  let hour = zhToNum(m[2]);
  if (hour == null || hour > 23) return null;

  let minute = 0;
  const mm = m[3];
  if (mm === "半") minute = 30;
  else if (mm === "一刻") minute = 15;
  else if (mm === "三刻") minute = 45;
  else if (mm) {
    const v = zhToNum(mm);
    if (v != null && v < 60) minute = v;
  }

  const period = m[1];
  if ((period === "下午" || period === "傍晚" || period === "晚上" || period === "夜里" || period === "夜晚") && hour < 12) {
    hour += 12;
  }
  if (period === "中午" && hour < 12) hour = 12;
  if ((period === "凌晨" || period === "早上" || period === "早晨" || period === "上午") && hour === 12) {
    hour = 0;
  }
  return { hour, minute };
}

function tryRelative(input: string, now: Date): Date | null {
  if (/半\s*(?:个|個)?\s*(?:小时|小時|钟头|鐘頭)(?:后|後|之后|之後|以后|以後)/.test(input)) {
    return new Date(now.getTime() + 1800 * 1000);
  }
  const re = new RegExp(
    `(${NUM})\\s*(?:个|個)?\\s*(分钟|分鐘|分|小时|小時|钟头|鐘頭|天|日|周|週|星期|礼拜|禮拜|秒)(?:钟|鐘)?\\s*(?:后|後|之后|之後|以后|以後)`,
  );
  const m = input.match(re);
  if (!m) return null;
  const n = zhToNum(m[1]);
  if (n == null) return null;
  const unit = m[2];
  const mult = /分/.test(unit)
    ? 60
    : /小时|小時|钟头|鐘頭/.test(unit)
      ? 3600
      : /天|日/.test(unit)
        ? 86400
        : /周|週|星期|礼拜|禮拜/.test(unit)
          ? 604800
          : 1;
  return new Date(now.getTime() + n * mult * 1000);
}

function tryNamedDay(input: string, now: Date): Date | null {
  const days: Array<[RegExp, number]> = [
    [/大后天|大後天/, 3],
    [/后天|後天/, 2],
    [/明天|明日|明儿/, 1],
    [/今天|今日|今晚|今早|今晨/, 0],
  ];
  for (const [pat, offset] of days) {
    if (!pat.test(input)) continue;
    const base = new Date(now);
    base.setDate(base.getDate() + offset);
    const clock = parseClock(input);
    base.setHours(clock ? clock.hour : 9, clock ? clock.minute : 0, 0, 0);
    return base;
  }
  return null;
}

function tryWeekday(input: string, now: Date): Date | null {
  const m = input.match(/(?:周|週|星期|礼拜|禮拜)([一二三四五六日天末])/);
  if (!m) return null;
  const map: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0, 末: 6 };
  const target = map[m[1]];
  if (target == null) return null;

  const base = new Date(now);
  const nextWeek = /下(?:个|個)?(?:周|週|星期|礼拜|禮拜)/.test(input);
  if (nextWeek) {
    // 下周X:下一个自然周(周一为起点)的星期 X
    const mondayOffset = (base.getDay() + 6) % 7; // 今天距本周一的天数
    base.setDate(base.getDate() - mondayOffset + 7); // 下周一
    base.setDate(base.getDate() + ((target + 6) % 7)); // 周一=0 … 周日=6
  } else {
    // 周X:下一次到来的星期 X(不含今天)
    let diff = (target - base.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    base.setDate(base.getDate() + diff);
  }

  const clock = parseClock(input);
  base.setHours(clock ? clock.hour : 9, clock ? clock.minute : 0, 0, 0);
  return base;
}

function tryAbsolute(input: string, now: Date): Date | null {
  const m = input.match(new RegExp(`(?:(${NUM})\\s*月)?\\s*(${NUM})\\s*[日号號]`));
  if (!m) return null;
  const day = zhToNum(m[2]);
  if (day == null || day < 1 || day > 31) return null;
  const base = new Date(now);
  const hasMonth = m[1] != null;
  const month = hasMonth ? (zhToNum(m[1]) ?? NaN) - 1 : base.getMonth();
  if (Number.isNaN(month) || month < 0 || month > 11) return null;
  base.setDate(1);
  base.setMonth(month);
  base.setDate(day);
  if (base.getDate() !== day) return null; // 非法日期(如 2月30日)溢出 → 视为无法解析
  const clock = parseClock(input);
  base.setHours(clock ? clock.hour : 9, clock ? clock.minute : 0, 0, 0);
  if (base.getTime() < now.getTime()) {
    if (hasMonth) base.setFullYear(base.getFullYear() + 1);
    else base.setMonth(base.getMonth() + 1);
  }
  return base;
}

// 无日期的纯时刻(如"晚上8点""九点""15:45"):默认今天,已过则顺延到明天。
// 若输入含日期锚点(月日、命名日、星期、相对时长后缀)则不处理,让上层分支负责。
function tryClockOnly(input: string, now: Date): Date | null {
  // 仅当输入含"数字+月/日/号"这种被 tryAbsolute 拒绝(如非法日期 2月30日)后残留的日期锚点时,才放弃纯时刻解析。
  // 用数字前缀避免误伤"每日/生日/日常"等非日期词。
  const hasNumericDateAnchor =
    new RegExp(`(?:${NUM})\\s*月`).test(input) ||
    new RegExp(`(?:${NUM})\\s*[日号號]`).test(input) ||
    hasEnDateAnchorEn(input);
  if (hasNumericDateAnchor) return null;
  const clock = parseClock(input);
  if (!clock) return null;
  const base = new Date(now);
  base.setHours(clock.hour, clock.minute, 0, 0);
  if (base.getTime() <= now.getTime()) base.setDate(base.getDate() + 1);
  return base;
}

/** 自然语言 → 触发时间。识别不到时间返回 null。 */
export function parseReminderTime(input: string, now: Date): Date | null {
  const zh =
    tryRelative(input, now) ??
    tryNamedDay(input, now) ??
    tryWeekday(input, now) ??
    tryAbsolute(input, now);
  if (zh) return zh;
  // 英文分支仅在纯非中文输入上运行,避免中文串里夹带的英文单词(如"看sunday的邮件")被误判为提醒。
  if (!/[一-鿿]/.test(input)) {
    const en =
      tryRelativeEn(input, now) ??
      tryNamedDayEn(input, now) ??
      tryWeekdayEn(input, now) ??
      tryAbsoluteEn(input, now);
    if (en) return en;
  }
  return tryClockOnly(input, now);
}

/** 剔除提醒消息中的时间词和提示词,返回纯消息。 */
function cleanReminderMessage(input: string): string {
  if (!/[一-鿿]/.test(input)) return cleanReminderMessageEn(input);
  return input
    .replace(/(大后天|大後天|后天|後天|明天|明日|明儿|今天|今日|今晚|今早|今晨)/g, "")
    .replace(/(下(?:个|個)?)?(?:周|週|星期|礼拜|禮拜)[一二三四五六日天末]/g, "")
    .replace(new RegExp(`(${NUM})\\s*月`, "g"), "")
    .replace(new RegExp(`(${NUM})\\s*[日号號]`, "g"), "")
    .replace(
      new RegExp(
        `(上午|早上|早晨|凌晨|中午|下午|傍晚|晚上|夜里|夜晚)?\\s*(?:${NUM})\\s*[点點:：时時]\\s*(?:(?:${NUM})|半|一刻|三刻)?\\s*分?`,
        "g",
      ),
      "",
    )
    .replace(
      new RegExp(
        `(?:半\\s*(?:个|個)?\\s*(?:小时|小時|钟头|鐘頭)|(?:${NUM})\\s*(?:个|個)?\\s*(?:分钟|分鐘|分|小时|小時|钟头|鐘頭|天|日|周|週|星期|礼拜|禮拜|秒)(?:钟|鐘)?)\\s*(?:后|後|之后|之後|以后|以後)`,
        "g",
      ),
      "",
    )
    .replace(/(提醒我?|记得|別忘了?|别忘了?|叫我|喊我|提示|闹钟|定时|定時)/g, "")
    .trim();
}

/** 自然语言 → 提醒(消息 + ISO 触发时间);无时间返回 null。 */
export function parseReminder(input: string, now: Date): ParsedReminder | null {
  const at = parseReminderTime(input, now);
  if (!at) return null;
  const message = cleanReminderMessage(input) || input;
  return { message, trigger_at: at.toISOString() };
}

export interface ParsedDailyReminder {
  message: string;
  hour: number;
  minute: number;
}

const DAILY_CUE = /每天|每日|每晚|每早/;

// 剔除每日线索词后,复用 cleanReminderMessage 清洗时刻/提示词。
function cleanDailyMessage(input: string): string {
  const withoutCue = input.replace(/每天早上|每天早晨|每天晚上|每天|每日|每晚|每早/g, "");
  return cleanReminderMessage(withoutCue);
}

/** 自然语言 → 每日提醒(内容 + 时:分);无每日线索或无时刻返回 null。 */
export function parseDailyReminder(input: string): ParsedDailyReminder | null {
  if (!DAILY_CUE.test(input)) return null;
  // 归一化用于时刻解析:每晚→晚上、每早→早上,每天/每日删除,让 parseClock 的时段词生效。
  const clockSrc = input
    .replace(/每晚/g, "晚上")
    .replace(/每早/g, "早上")
    .replace(/每天|每日/g, "");
  const clock = parseClock(clockSrc);
  if (!clock) return null;
  const message = cleanDailyMessage(input) || input;
  return { message, hour: clock.hour, minute: clock.minute };
}

/** 归类:reminder / todo(只返回单一类型;无可解析时间即归 todo)。一句话添加不再产生计时。 */
export function classify(input: string, now: Date): { types: AssistantType[] } {
  if (parseReminderTime(input, now)) return { types: ["reminder"] };
  return { types: ["todo"] };
}
