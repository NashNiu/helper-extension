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
