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
