import { useEffect, useState } from "react";
import { timerApi, type Timer } from "../../shared/api/timer";
import {
  startTimer,
  startPomodoro,
  advancePhase,
  pauseTimer,
  resumeTimer,
  cancelTimer,
} from "../../shared/timerControl";
import { estimatedEndAt, isLongBreakCycle, nextStep } from "../../background/logic";
import { useCountdown } from "./useCountdown";
import { Button } from "../../components/Button";

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtClock(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 判定「工作/番茄钟」预设:本地固定 id -1,或名称含「番茄」,或时长 ≥ 20 分钟。
function isWorkPreset(t: Timer): boolean {
  return t.id === -1 || t.name.includes("番茄") || t.duration_seconds >= 20 * 60;
}

export function TimerView({ refreshKey }: { refreshKey: number }) {
  const [presets, setPresets] = useState<Timer[]>([]);
  const [pendingWork, setPendingWork] = useState<Timer | null>(null);
  const [cycles, setCycles] = useState(4);
  const { timer, remaining, refresh } = useCountdown();

  useEffect(() => {
    timerApi.list().then(setPresets).catch(() => {});
  }, [refreshKey]);

  async function startOneShot(t: Timer) {
    await startTimer(t.id, t.name, t.duration_seconds);
    await refresh();
  }

  async function confirmPomodoro() {
    if (!pendingWork) return;
    await startPomodoro(pendingWork, cycles);
    setPendingWork(null);
    await refresh();
  }

  async function onPause() {
    await pauseTimer();
    await refresh();
  }
  async function onResume() {
    await resumeTimer();
    await refresh();
  }
  async function onCancel() {
    await cancelTimer();
    await refresh();
  }
  async function onAdvance() {
    await advancePhase();
    await refresh();
  }

  if (timer) {
    const session = timer.session;
    const est = estimatedEndAt(timer, Date.now());

    let awaitingLabel = "开始休息";
    let finished = false;
    if (session && timer.status === "awaiting") {
      if (session.phase === "work") {
        awaitingLabel = isLongBreakCycle(session.cycleIndex) ? "开始长休息" : "开始休息";
      } else {
        finished = nextStep(session).done;
        awaitingLabel = "开始下一个番茄";
      }
    }

    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        {session ? (
          <p className="text-sm text-muted">
            {timer.name} · 第 {session.cycleIndex} / {session.cycles} 个
          </p>
        ) : (
          <p className="text-sm text-muted">{timer.name}</p>
        )}

        {timer.status === "awaiting" && finished ? (
          <p className="text-3xl font-semibold text-ink">全部完成 🎉</p>
        ) : (
          <p
            className={`font-mono text-5xl tabular-nums ${
              timer.status === "paused" ? "text-muted" : "text-ink"
            }`}
          >
            {fmt(remaining)}
          </p>
        )}

        {timer.status === "paused" && <p className="text-xs text-muted">已暂停</p>}
        {timer.status === "running" && (
          <p className="text-xs text-muted">预计 {fmtClock(est)} 结束(估算)</p>
        )}

        <div className="flex gap-2">
          {timer.status === "running" && (
            <>
              <Button onClick={onPause}>暂停</Button>
              <Button variant="ghost" onClick={onCancel}>
                取消
              </Button>
            </>
          )}
          {timer.status === "paused" && (
            <>
              <Button onClick={onResume}>继续</Button>
              <Button variant="ghost" onClick={onCancel}>
                取消
              </Button>
            </>
          )}
          {timer.status === "awaiting" &&
            (finished ? (
              <Button onClick={onAdvance}>结束</Button>
            ) : (
              <>
                <Button onClick={onAdvance}>{awaitingLabel}</Button>
                <Button variant="ghost" onClick={onCancel}>
                  取消
                </Button>
              </>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3">
      {pendingWork ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="mb-3 text-sm font-medium text-ink">{pendingWork.name} · 循环设置</p>
          <div className="mb-4 flex items-center gap-3">
            <span className="text-sm text-muted">循环</span>
            <input
              type="number"
              min={1}
              max={12}
              value={cycles}
              onChange={(e) => setCycles(Number(e.target.value))}
              className="w-16 rounded-lg border border-line bg-ground px-2 py-1 text-center text-ink"
            />
            <span className="text-sm text-muted">次</span>
          </div>
          <div className="flex gap-2">
            <Button onClick={confirmPomodoro}>开始</Button>
            <Button variant="ghost" onClick={() => setPendingWork(null)}>
              返回
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="mb-2 text-xs text-muted">选择一个计时</p>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((t) => (
              <button
                key={t.id}
                onClick={() => (isWorkPreset(t) ? setPendingWork(t) : startOneShot(t))}
                className="rounded-xl border border-line bg-surface px-3 py-4 text-center transition hover:border-accent"
              >
                <span className="block text-sm font-medium text-ink">{t.name}</span>
                <span className="block text-xs text-muted">
                  {Math.round(t.duration_seconds / 60)} 分钟
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
