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
} from "../../shared/timerControl";
import { isLongBreakCycle, nextStep, plannedTotalSeconds } from "../../background/logic";
import { presetNameKey, focusConfigFor } from "../../shared/focusMethods";
import { localCustomTimers } from "../../shared/local/customTimers";
import { CustomTimerForm } from "./CustomTimerForm";
import { useCountdown } from "./useCountdown";
import { Button } from "../../components/Button";
import { useT } from "../../i18n/react";
import type { MessageKey } from "../../i18n/messages/en";

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

// 「专注法」预设(点击进入循环设置):内置 focus 预设与自定义 focus 均 type === "focus"。
function isFocusPreset(t: Timer): boolean {
  return t.type === "focus";
}

const stepBtn =
  "flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.06] text-xl font-bold text-ink transition hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
const outlineBtn = "border border-line";
const accentOutlineBtn = "border border-accent/40 text-accent";
const dangerOutlineBtn = "border border-danger/40";

const svgProps = {
  width: 28,
  height: 28,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function TimerIcon() {
  return (
    <svg {...svgProps}>
      <line x1="10" y1="2" x2="14" y2="2" />
      <line x1="12" y1="14" x2="15" y2="11" />
      <circle cx="12" cy="14" r="8" />
    </svg>
  );
}

function CoffeeIcon() {
  return (
    <svg {...svgProps}>
      <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg {...svgProps}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg {...svgProps}>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function HourglassIcon() {
  return (
    <svg {...svgProps}>
      <path d="M5 22h14" />
      <path d="M5 2h14" />
      <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
      <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
    </svg>
  );
}

// 52/17 → 闪电;90 分钟 → 沙漏;自定义倒计时 → 时钟;专注法(番茄钟/自定义)→ 计时器;长休息 → 月亮;短休息 → 咖啡杯。
function PresetIcon({ preset }: { preset: Timer }) {
  if (preset.id === -4) return <ZapIcon />;
  if (preset.id === -5) return <HourglassIcon />;
  if (preset.type === "countdown") return <ClockIcon />;
  if (isFocusPreset(preset)) return <TimerIcon />;
  if (preset.id === -3) return <MoonIcon />;
  return <CoffeeIcon />;
}

export function TimerView({ refreshKey }: { refreshKey: number }) {
  const t = useT();
  const [presets, setPresets] = useState<Timer[]>([]);
  const [pendingWork, setPendingWork] = useState<Timer | null>(null);
  const [cycles, setCycles] = useState(4);
  const [creating, setCreating] = useState(false);
  const { timer, remaining, refresh } = useCountdown();

  const reload = () => {
    timerApi.list().then(setPresets).catch(() => {});
  };
  useEffect(reload, [refreshKey]);

  function openSetup(p: Timer) {
    setCycles(focusConfigFor({ id: p.id, breakSeconds: p.breakSeconds, cycles: p.cycles }).defaultCycles);
    setPendingWork(p);
  }

  async function startOneShot(p: Timer) {
    await startTimer(p.id, p.name, p.duration_seconds);
    await refresh();
  }

  async function confirmPomodoro() {
    if (!pendingWork) return;
    const m = focusConfigFor({ id: pendingWork.id, breakSeconds: pendingWork.breakSeconds, cycles: pendingWork.cycles });
    await startPomodoro(pendingWork, cycles, {
      shortBreakSec: m.shortBreakSec,
      longBreakSec: m.longBreakSec,
      longBreakEvery: m.longBreakEvery,
    });
    setPendingWork(null);
    await refresh();
  }

  async function deleteCustom(id: number) {
    await localCustomTimers.remove(id);
    reload();
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

  const presetName = (p: Timer) => {
    const k = presetNameKey(p.id);
    return k ? t(k) : p.name;
  };

  // ── 计时进行中 ──────────────────────────────────────────────────────────────
  if (timer) {
    const running = timer.status === "running";
    const paused = timer.status === "paused";
    const awaiting = timer.status === "awaiting";
    const session = timer.session;

    // ── 番茄钟会话 ──
    if (session) {
      const isWork = session.phase === "work";
      const phaseKey: MessageKey =
        session.phase === "work"
          ? awaiting ? "timer.workEnded" : "timer.workRunning"
          : session.phase === "long_break"
            ? awaiting ? "timer.longEnded" : "timer.longRunning"
            : awaiting ? "timer.breakEnded" : "timer.breakRunning";
      const phaseText = t(phaseKey);
      const phaseColor = isWork ? "text-ink" : "text-accent";

      const finished = awaiting && !isWork && nextStep(session).done;
      const longNext = isLongBreakCycle(session.cycleIndex, session.longBreakEvery ?? 4);
      const breakMin = Math.round((longNext ? session.longBreakSec : session.shortBreakSec) / 60);
      const mKey = presetNameKey(timer.timerId);
      const methodName = mKey ? t(mKey) : (timer.methodName ?? timer.name);
      const advanceLabel = isWork
        ? t(longNext ? "timer.startLongBreak" : "timer.startBreak", { min: breakMin })
        : t("timer.startNextRound", { n: session.cycleIndex + 1 });

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
              {t("timer.cycleProgress", { current: session.cycleIndex, total: session.cycles })}
            </p>
            <p className={`mt-1 text-base font-semibold ${phaseColor}`}>{phaseText}</p>
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
              <p className="font-medium text-accent-ink">{t("timer.allDone")}</p>
              <Button className="px-8" onClick={onAdvance}>
                {t("timer.finish")}
              </Button>
            </div>
          ) : awaiting ? (
            <div className="flex flex-col items-center gap-3">
              <Button className="px-8" onClick={onAdvance}>
                {advanceLabel}
              </Button>
              <Button variant="ghost" onClick={onCancel}>
                {t("timer.endMethod", { name: methodName })}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-2">
              {running && (
                <Button variant="ghost" className={`${outlineBtn} text-ink`} onClick={onPause}>
                  {t("timer.pause")}
                </Button>
              )}
              {paused && <Button onClick={onResume}>{t("timer.resume")}</Button>}
              <Button variant="ghost" className={accentOutlineBtn} onClick={onRestart}>
                {t("timer.resetPhase")}
              </Button>
              <Button variant="danger" className={dangerOutlineBtn} onClick={onCancel}>
                {t("timer.endMethod", { name: methodName })}
              </Button>
            </div>
          )}

          <p className="text-xs text-muted">{t("timer.hintSession")}</p>
        </div>
      );
    }

    // ── 一次性计时 ──
    const oneShotTitle = (() => {
      const k = presetNameKey(timer.timerId);
      return k ? t(k) : timer.name;
    })();

    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
        <h2 className="text-xl font-semibold text-ink">{oneShotTitle}</h2>
        <div
          className={`font-mono text-6xl font-bold tabular-nums ${paused ? "text-muted" : "text-ink"}`}
        >
          {fmt(remaining)}
        </div>
        {paused && <p className="text-xs text-muted">{t("timer.paused")}</p>}
        <div className="flex flex-wrap justify-center gap-2">
          {running && (
            <Button variant="ghost" className={`${outlineBtn} text-ink`} onClick={onPause}>
              {t("timer.pause")}
            </Button>
          )}
          {paused && <Button onClick={onResume}>{t("timer.resume")}</Button>}
          <Button variant="ghost" className={accentOutlineBtn} onClick={onRestart}>
            {t("timer.reset")}
          </Button>
          <Button variant="danger" className={dangerOutlineBtn} onClick={onCancel}>
            {t("action.cancel")}
          </Button>
        </div>
        <p className="text-xs text-muted">{t("timer.hintOneShot")}</p>
      </div>
    );
  }

  // ── 新建自定义计时器 ──────────────────────────────────────────────────────────
  if (creating) {
    return (
      <CustomTimerForm
        onCancel={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          reload();
        }}
      />
    );
  }

  // ── 番茄钟设置:选循环次数 ────────────────────────────────────────────────────
  if (pendingWork) {
    const m = focusConfigFor({ id: pendingWork.id, breakSeconds: pendingWork.breakSeconds, cycles: pendingWork.cycles });
    const simple = m.simple;
    const workMin = Math.round(pendingWork.duration_seconds / 60);
    const shortMin = Math.round(m.shortBreakSec / 60);
    const longMin = Math.round(m.longBreakSec / 60);
    const totalSec = plannedTotalSeconds(cycles, pendingWork.duration_seconds, m.shortBreakSec, m.longBreakSec);
    const totalMin = Math.round(totalSec / 60);
    const endStr = fmtClock(Date.now() + totalSec * 1000);

    return (
      <div className="flex h-full flex-col items-center justify-center gap-8 p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-ink">
            {simple ? presetName(pendingWork) : t("timer.pomodoroTechnique")}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {simple
              ? t("timer.setupSubtitleSimple", { work: workMin, break: shortMin })
              : t("timer.setupSubtitle", { work: workMin, short: shortMin, long: longMin })}
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-medium text-ink">{t("timer.chooseCycles")}</p>
          <div className="flex items-center gap-5">
            <button
              aria-label={t("timer.decreaseAria")}
              onClick={() => setCycles((c) => Math.max(1, c - 1))}
              className={stepBtn}
            >
              −
            </button>
            <span className="w-12 text-center text-4xl font-bold tabular-nums text-ink">{cycles}</span>
            <button
              aria-label={t("timer.increaseAria")}
              onClick={() => setCycles((c) => Math.min(8, c + 1))}
              className={stepBtn}
            >
              +
            </button>
          </div>
          <div className="mt-1 space-y-0.5 text-center">
            <p className="text-sm text-muted">{t("timer.totalMinutes", { n: totalMin })}</p>
            <p className="text-sm font-medium text-ink">{t("timer.estimatedEnd", { time: endStr })}</p>
          </div>
        </div>

        <Button className="px-10" onClick={confirmPomodoro}>
          {t("timer.start")}
        </Button>
        <Button variant="ghost" onClick={() => setPendingWork(null)}>
          {t("timer.back")}
        </Button>
      </div>
    );
  }

  // ── 预设选择 ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-3">
      <p className="mb-2 text-xs text-muted">{t("timer.pickOne")}</p>
      <div className="grid grid-cols-2 gap-2">
        {presets.map((p) => (
          <div key={p.id} className="relative">
            <button
              onClick={() => (isFocusPreset(p) ? openSetup(p) : startOneShot(p))}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface px-3 py-4 transition hover:border-accent"
            >
              <span className="shrink-0 text-accent">
                <PresetIcon preset={p} />
              </span>
              <span className="min-w-0 text-left">
                <span className="block text-sm font-medium text-ink">{presetName(p)}</span>
                <span className="block text-xs text-muted">
                  {isFocusPreset(p)
                    ? t(focusConfigFor({ id: p.id, breakSeconds: p.breakSeconds, cycles: p.cycles }).techniqueKey)
                    : t("timer.minutes", { n: Math.round(p.duration_seconds / 60) })}
                </span>
              </span>
            </button>
            {!p.is_preset && (
              <button
                type="button"
                onClick={() => deleteCustom(p.id)}
                aria-label={t("timer.deleteCustomAria", { name: p.name })}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md text-muted transition hover:bg-danger/10 hover:text-danger"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-line px-3 py-4 text-sm font-medium text-muted transition hover:border-accent hover:text-accent"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {t("timer.newTimer")}
        </button>
      </div>
    </div>
  );
}
