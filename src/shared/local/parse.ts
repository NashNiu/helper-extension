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
