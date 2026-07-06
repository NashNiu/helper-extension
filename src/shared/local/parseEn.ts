import type { ParsedTimer } from "./parse";

/** 英文时长 → 总秒数(大小写不敏感,支持 1h30m 组合与 half an hour);无时长返回 null。 */
export function parseDurationEn(input: string): number | null {
  const s = input.toLowerCase();
  let total = 0;
  let found = false;

  const h = s.match(/(\d+)\s*(?:hours?|hrs?|h)(?![a-z])/);
  if (h) { total += parseInt(h[1], 10) * 3600; found = true; }
  if (/\bhalf\s+(?:an?\s+)?hour\b/.test(s)) { total += 1800; found = true; }
  const m = s.match(/(\d+)\s*(?:minutes?|mins?|m)(?![a-z])/);
  if (m) { total += parseInt(m[1], 10) * 60; found = true; }
  const sec = s.match(/(\d+)\s*(?:seconds?|secs?|s)(?![a-z])/);
  if (sec) { total += parseInt(sec[1], 10); found = true; }

  return found ? total : null;
}

/** 英文时刻 → {hour, minute};要求时钟信号(am/pm、冒号、at 前缀、noon/midnight),裸数字不算。 */
export function parseClockEn(input: string): { hour: number; minute: number } | null {
  const s = input.toLowerCase();
  if (/\bnoon\b/.test(s)) return { hour: 12, minute: 0 };
  if (/\bmidnight\b/.test(s)) return { hour: 0, minute: 0 };

  let m = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/); // 8pm / 8:30pm
  if (m) {
    let hour = parseInt(m[1], 10);
    const minute = m[2] ? parseInt(m[2], 10) : 0;
    if (hour > 12 || minute > 59) return null;
    if (m[3] === "pm" && hour < 12) hour += 12;
    if (m[3] === "am" && hour === 12) hour = 0;
    return { hour, minute };
  }
  m = s.match(/\b(\d{1,2}):(\d{2})\b/); // 24h 15:45
  if (m) {
    const hour = parseInt(m[1], 10);
    const minute = parseInt(m[2], 10);
    if (hour > 23 || minute > 59) return null;
    return { hour, minute };
  }
  m = s.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/); // at 8 / at 8:30
  if (m) {
    const hour = parseInt(m[1], 10);
    const minute = m[2] ? parseInt(m[2], 10) : 0;
    if (hour > 23 || minute > 59) return null;
    return { hour, minute };
  }
  return null;
}

/** 英文相对时间 "in N unit"(含 in a week / in half an hour)→ Date;否则 null。 */
export function tryRelativeEn(input: string, now: Date): Date | null {
  const s = input.toLowerCase();
  if (/\bin\s+half\s+(?:an?\s+)?hour\b/.test(s)) {
    return new Date(now.getTime() + 1800 * 1000);
  }
  const m = s.match(
    /\bin\s+(\d+|an?)\s*(minutes?|mins?|hours?|hrs?|days?|weeks?|seconds?|secs?)\b/,
  );
  if (!m) return null;
  const n = m[1] === "a" || m[1] === "an" ? 1 : parseInt(m[1], 10);
  const unit = m[2];
  const mult = /^h/.test(unit)
    ? 3600
    : /^m/.test(unit)
      ? 60
      : /^d/.test(unit)
        ? 86400
        : /^w/.test(unit)
          ? 604800
          : 1;
  return new Date(now.getTime() + n * mult * 1000);
}

/** 英文具名日 today/tonight/tomorrow/the day after tomorrow → Date;无时刻默认 09:00。 */
export function tryNamedDayEn(input: string, now: Date): Date | null {
  const s = input.toLowerCase();
  const days: Array<[RegExp, number]> = [
    [/\bthe day after tomorrow\b/, 2],
    [/\btomorrow\b/, 1],
    [/\b(?:today|tonight)\b/, 0],
  ];
  for (const [pat, offset] of days) {
    if (!pat.test(s)) continue;
    const base = new Date(now);
    base.setDate(base.getDate() + offset);
    const clock = parseClockEn(input);
    base.setHours(clock ? clock.hour : 9, clock ? clock.minute : 0, 0, 0);
    return base;
  }
  return null;
}

const EN_WEEKDAY: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tues: 2, tue: 2,
  wednesday: 3, wed: 3, thursday: 4, thurs: 4, thur: 4, thu: 4,
  friday: 5, fri: 5, saturday: 6, sat: 6,
};

/** 英文星期 → Date;next X = 下一自然周(周一起点),裸 X = 下一次到来(不含今天);无时刻默认 09:00。 */
export function tryWeekdayEn(input: string, now: Date): Date | null {
  const s = input.toLowerCase();
  const m = s.match(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (!m) return null;
  const target = EN_WEEKDAY[m[2]];
  if (target == null) return null;

  const base = new Date(now);
  if (m[1]) {
    const mondayOffset = (base.getDay() + 6) % 7;
    base.setDate(base.getDate() - mondayOffset + 7);
    base.setDate(base.getDate() + ((target + 6) % 7));
  } else {
    let diff = (target - base.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    base.setDate(base.getDate() + diff);
  }
  const clock = parseClockEn(input);
  base.setHours(clock ? clock.hour : 9, clock ? clock.minute : 0, 0, 0);
  return base;
}

const EN_MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sept: 9, sep: 9, october: 10, oct: 10, november: 11, nov: 11,
  december: 12, dec: 12,
};

/** 月名正则片段(供 tryAbsoluteEn / cleanReminderMessageEn / hasEnDateAnchorEn 复用)。 */
export const EN_MONTH_RE =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

/** 英文绝对日期(仅月名形式,支持序数后缀)→ Date;非法日期 null;已过→明年;无时刻默认 09:00。 */
export function tryAbsoluteEn(input: string, now: Date): Date | null {
  const s = input.toLowerCase();
  let month = -1;
  let day = -1;

  let m = s.match(new RegExp(`\\b(${EN_MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`));
  if (m) { month = EN_MONTHS[m[1]]; day = parseInt(m[2], 10); }
  else {
    m = s.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${EN_MONTH_RE})\\b`));
    if (m) { day = parseInt(m[1], 10); month = EN_MONTHS[m[2]]; }
  }
  if (month < 1 || day < 1 || day > 31) return null;

  const base = new Date(now);
  base.setDate(1);
  base.setMonth(month - 1);
  base.setDate(day);
  if (base.getDate() !== day) return null; // 非法日期(如 Feb 30)溢出
  const clock = parseClockEn(input);
  base.setHours(clock ? clock.hour : 9, clock ? clock.minute : 0, 0, 0);
  if (base.getTime() < now.getTime()) base.setFullYear(base.getFullYear() + 1);
  return base;
}

export const EN_REMINDER_CUE = /\b(remind|remember|don'?t forget)\b/i;
export const EN_TIMER_CUE = /\b(timer|pomodoro|countdown|focus)\b/i;

/** 英文计时:时长 + 计时名;pomodoro 默认 25 分钟;无可用时长返回 null。 */
export function parseTimerEn(input: string): ParsedTimer | null {
  let seconds = parseDurationEn(input);
  const isPomodoro = /\bpomodoro\b/i.test(input);
  if (seconds == null && isPomodoro) seconds = 25 * 60;
  if (seconds == null || seconds <= 0) return null;

  const name = input
    .replace(/\b(timer|countdown|focus|pomodoro)\b/gi, "")
    .replace(/\bfor\b/gi, "")
    .replace(/\bhalf\s+(?:an?\s+)?hour\b/gi, "")
    .replace(/(\d+)\s*(?:hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)(?![a-z])/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (name) return { name, duration_seconds: seconds };
  return { name: isPomodoro ? "Pomodoro" : "Timer", duration_seconds: seconds };
}

/** 英文月名日期锚点检测(供 tryClockOnly 守卫,避免非法日期被纯时刻救回)。 */
export function hasEnDateAnchorEn(input: string): boolean {
  const s = input.toLowerCase();
  return (
    new RegExp(`\\b(?:${EN_MONTH_RE})\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`).test(s) ||
    new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${EN_MONTH_RE})\\b`).test(s)
  );
}

/** 剔除英文提醒消息中的提示词与时间词,返回纯消息(镜像中文清洗)。 */
export function cleanReminderMessageEn(input: string): string {
  return input
    .replace(/\b(remind me to|remind me|remember to|remember|don'?t forget to|don'?t forget)\b/gi, "")
    .replace(/\bin\s+(?:\d+|an?)\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?|seconds?|secs?)\b/gi, "")
    .replace(/\bin\s+half\s+(?:an?\s+)?hour\b/gi, "")
    .replace(/\b(the day after tomorrow|tomorrow|today|tonight)\b/gi, "")
    .replace(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, "")
    .replace(new RegExp(`\\b(?:${EN_MONTH_RE})\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, "gi"), "")
    .replace(new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${EN_MONTH_RE})\\b`, "gi"), "")
    .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, "")
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, "")
    .replace(/\b\d{1,2}:\d{2}\b/gi, "")
    .replace(/\b(noon|midnight)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
