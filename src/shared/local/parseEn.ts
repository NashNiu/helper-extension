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
