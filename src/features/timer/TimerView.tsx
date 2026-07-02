import { useEffect, useState } from "react";
import { timerApi, type Timer } from "../../shared/api/timer";
import {
  startTimer,
  startPomodoro,
  advancePhase,
  pauseTimer,
  resumeTimer,
  restartPhase,
  cancelTimer,
  SHORT_BREAK_SEC,
  LONG_BREAK_SEC,
} from "../../shared/timerControl";
import { isLongBreakCycle, nextStep, plannedTotalSeconds } from "../../background/logic";
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

const stepBtn =
  "flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.06] text-xl font-bold text-ink transition hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
const outlineBtn = "border border-line";

export function TimerView({ refreshKey }: { refreshKey: number }) {
  const [presets, setPresets] = useState<Timer[]>([]);
  const [pendingWork, setPendingWork] = useState<Timer | null>(null);
  const [cycles, setCycles] = useState(4);
  const { timer, remaining, refresh } = useCountdown();

  useEffect(() => {
    timerApi.list().then(setPresets).catch(() => {});
  }, [refreshKey]);

  function openSetup(t: Timer) {
    setCycles(4);
    setPendingWork(t);
  }

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

  const act = (fn: () => Promise<void>) => async () => {
    await fn();
    await refresh();
  };
  const onPause = act(pauseTimer);
  const onResume = act(resumeTimer);
  const onRestart = act(restartPhase);
  const onAdvance = act(advancePhase);
  const onCancel = act(cancelTimer);

  // ── 计时进行中 ──────────────────────────────────────────────────────────────
  if (timer) {
    const running = timer.status === "running";
    const paused = timer.status === "paused";
    const awaiting = timer.status === "awaiting";
    const session = timer.session;

    // ── 番茄钟会话 ──
    if (session) {
      const isWork = session.phase === "work";
      const base = isWork ? "工作" : session.phase === "long_break" ? "长休息" : "休息";
      const phaseLabel = awaiting ? `${base}结束` : `${base}中`;
      const phaseColor = isWork ? "text-ink" : "text-accent";

      const finished = awaiting && !isWork && nextStep(session).done;
      const longNext = isLongBreakCycle(session.cycleIndex);
      const breakMin = Math.round((longNext ? session.longBreakSec : session.shortBreakSec) / 60);
      const advanceLabel = isWork
        ? `开始${longNext ? "长" : ""}休息（${breakMin} 分钟）`
        : `开始第 ${session.cycleIndex + 1} 轮工作`;

      return (
        <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
          <div className="text-center">
            <div className="mb-2 flex items-center justify-center gap-1.5">
              {Array.from({ length: session.cycles }, (_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i < session.cycleIndex - 1
                      ? "w-4 bg-ink/40"
                      : i === session.cycleIndex - 1
                        ? "w-6 bg-ink"
                        : "w-4 bg-line"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-muted">
              第 {session.cycleIndex} 轮 / 共 {session.cycles} 轮
            </p>
            <p className={`mt-1 text-base font-semibold ${phaseColor}`}>{phaseLabel}</p>
          </div>

          <div
            className={`font-mono text-6xl font-bold tabular-nums ${
              paused ? "text-muted" : finished ? "text-accent" : phaseColor
            }`}
          >
            {fmt(remaining)}
          </div>

          {finished ? (
            <div className="flex flex-col items-center gap-3">
              <p className="font-medium text-accent-ink">全部完成,辛苦了!</p>
              <Button className="px-8" onClick={onAdvance}>
                完成
              </Button>
            </div>
          ) : awaiting ? (
            <div className="flex flex-col items-center gap-3">
              <Button className="px-8" onClick={onAdvance}>
                {advanceLabel}
              </Button>
              <Button variant="ghost" onClick={onCancel}>
                结束番茄钟
              </Button>
            </div>
          ) : (
            <div className="flex gap-3">
              {running && (
                <Button variant="ghost" className={outlineBtn} onClick={onPause}>
                  暂停
                </Button>
              )}
              {paused && <Button onClick={onResume}>继续</Button>}
              <Button variant="ghost" className={outlineBtn} onClick={onRestart}>
                重置本阶段
              </Button>
            </div>
          )}

          <p className="text-xs text-muted">切换到其他页面时计时继续,到点后等待确认。</p>
        </div>
      );
    }

    // ── 一次性计时 ──
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
        <h2 className="text-xl font-semibold text-ink">{timer.name}</h2>
        <div
          className={`font-mono text-6xl font-bold tabular-nums ${paused ? "text-muted" : "text-ink"}`}
        >
          {fmt(remaining)}
        </div>
        {paused && <p className="text-xs text-muted">已暂停</p>}
        <div className="flex gap-3">
          {running && (
            <Button variant="ghost" className={outlineBtn} onClick={onPause}>
              暂停
            </Button>
          )}
          {paused && <Button onClick={onResume}>继续</Button>}
          <Button variant="ghost" className={outlineBtn} onClick={onRestart}>
            重置
          </Button>
        </div>
        <p className="text-xs text-muted">切换到其他页面时计时继续,到点会有系统通知。</p>
      </div>
    );
  }

  // ── 番茄钟设置:选循环次数 ────────────────────────────────────────────────────
  if (pendingWork) {
    const workMin = Math.round(pendingWork.duration_seconds / 60);
    const shortMin = Math.round(SHORT_BREAK_SEC / 60);
    const longMin = Math.round(LONG_BREAK_SEC / 60);
    const totalSec = plannedTotalSeconds(cycles, pendingWork.duration_seconds, SHORT_BREAK_SEC, LONG_BREAK_SEC);
    const totalMin = Math.round(totalSec / 60);
    const endStr = fmtClock(Date.now() + totalSec * 1000);

    return (
      <div className="flex h-full flex-col items-center justify-center gap-8 p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-ink">番茄工作法</h2>
          <p className="mt-1 text-sm text-muted">
            {workMin} 分钟工作 · {shortMin} 分钟休息 · 每 4 轮长休息 {longMin} 分钟
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-medium text-ink">选择循环次数</p>
          <div className="flex items-center gap-5">
            <button
              aria-label="减少"
              onClick={() => setCycles((c) => Math.max(1, c - 1))}
              className={stepBtn}
            >
              −
            </button>
            <span className="w-12 text-center text-4xl font-bold tabular-nums text-ink">{cycles}</span>
            <button
              aria-label="增加"
              onClick={() => setCycles((c) => Math.min(8, c + 1))}
              className={stepBtn}
            >
              +
            </button>
          </div>
          <div className="mt-1 space-y-0.5 text-center">
            <p className="text-sm text-muted">共 {totalMin} 分钟</p>
            <p className="text-sm font-medium text-ink">预计 {endStr} 结束</p>
          </div>
        </div>

        <Button className="px-10" onClick={confirmPomodoro}>
          开始
        </Button>
        <Button variant="ghost" onClick={() => setPendingWork(null)}>
          ← 返回
        </Button>
      </div>
    );
  }

  // ── 预设选择 ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-3">
      <p className="mb-2 text-xs text-muted">选择一个计时</p>
      <div className="grid grid-cols-2 gap-2">
        {presets.map((t) => (
          <button
            key={t.id}
            onClick={() => (isWorkPreset(t) ? openSetup(t) : startOneShot(t))}
            className="rounded-xl border border-line bg-surface px-3 py-4 text-center transition hover:border-accent"
          >
            <span className="block text-sm font-medium text-ink">{t.name}</span>
            <span className="block text-xs text-muted">
              {isWorkPreset(t) ? "番茄工作法" : `${Math.round(t.duration_seconds / 60)} 分钟`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
