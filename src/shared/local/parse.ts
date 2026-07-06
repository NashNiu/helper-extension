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
  if (seconds == null || seconds <= 0) return null;

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
  if (!m) return null;

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
