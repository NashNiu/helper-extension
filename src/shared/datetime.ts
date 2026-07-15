export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}`;
}

export function formatHourMinute(hour: number, minute: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(hour)}:${p(minute)}`;
}
