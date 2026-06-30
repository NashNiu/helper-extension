import { useEffect, useState } from "react";
import { timerApi, type Timer } from "../../shared/api/timer";
import { setActiveTimer } from "../../shared/activeTimer";
import { TIMER_ALARM } from "../../background/logic";
import { useCountdown } from "./useCountdown";
import { Button } from "../../components/Button";

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TimerView() {
  const [presets, setPresets] = useState<Timer[]>([]);
  const { timer, remaining, refresh } = useCountdown();

  useEffect(() => {
    timerApi.list().then(setPresets).catch(() => {});
  }, []);

  async function start(t: Timer) {
    const startAt = Date.now();
    await setActiveTimer({
      timerId: t.id,
      name: t.name,
      startAt,
      durationSeconds: t.duration_seconds,
      status: "running",
    });
    chrome.alarms.create(TIMER_ALARM, { when: startAt + t.duration_seconds * 1000 });
    await refresh();
  }

  async function reset() {
    await setActiveTimer(null);
    await chrome.alarms.clear(TIMER_ALARM);
    await refresh();
  }

  if (timer) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <p className="text-sm text-muted">{timer.name}</p>
        <p className="font-mono text-5xl tabular-nums text-ink">{fmt(remaining)}</p>
        <Button variant="ghost" onClick={reset}>
          重置
        </Button>
      </div>
    );
  }

  return (
    <div className="p-3">
      <p className="mb-2 text-xs text-muted">选择一个计时</p>
      <div className="grid grid-cols-2 gap-2">
        {presets.map((t) => (
          <button
            key={t.id}
            onClick={() => start(t)}
            className="rounded-xl border border-line bg-surface px-3 py-4 text-center transition hover:border-accent"
          >
            <span className="block text-sm font-medium text-ink">{t.name}</span>
            <span className="block text-xs text-muted">
              {Math.round(t.duration_seconds / 60)} 分钟
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
