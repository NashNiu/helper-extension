import { nextStep } from "../../background/logic";
import {
  pauseTimer,
  resumeTimer,
  restartPhase,
  advancePhase,
} from "../../shared/timerControl";
import { useCountdown } from "./useCountdown";
import { Button } from "../../components/Button";
import { useT } from "../../i18n/react";
import type { MessageKey } from "../../i18n/messages/en";

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function localPresetKey(id: number): MessageKey | null {
  if (id === -1) return "timer.preset.pomodoro";
  if (id === -2) return "timer.preset.shortBreak";
  if (id === -3) return "timer.preset.longBreak";
  return null;
}

function FlameIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

function CupIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4Z" />
      <line x1="6" y1="2" x2="6" y2="4" />
      <line x1="10" y1="2" x2="10" y2="4" />
      <line x1="14" y1="2" x2="14" y2="4" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
    </svg>
  );
}

const smBtn = "px-2 py-1 text-xs";
const smOutline = "border border-line px-2 py-1 text-xs";

/** 悬浮计时小组件:计时进行时,在非「计时」标签页展示进度与快捷控制;点主体切回计时页。 */
export function TimerWidget({ onOpen }: { onOpen: () => void }) {
  const t = useT();
  const { timer, remaining, refresh } = useCountdown();
  if (!timer) return null;

  const session = timer.session;
  const isWork = !session || session.phase === "work";
  const running = timer.status === "running";
  const paused = timer.status === "paused";
  const awaiting = timer.status === "awaiting";
  const finished = !!session && awaiting && session.phase !== "work" && nextStep(session).done;

  const act = (fn: () => Promise<void>) => async (e: React.MouseEvent) => {
    e.stopPropagation();
    await fn();
    await refresh();
  };

  const title = session
    ? t("widget.title", { current: session.cycleIndex, total: session.cycles, phase: t(isWork ? "widget.work" : "widget.break") })
    : (() => { const k = localPresetKey(timer.timerId); return k ? t(k) : timer.name; })();
  const timeText = awaiting ? (finished ? t("widget.allDone") : t("widget.phaseDone")) : fmt(remaining);
  const timeColor = paused ? "text-muted" : isWork ? "text-ink" : "text-accent";
  const Icon = finished ? ClockIcon : isWork ? FlameIcon : CupIcon;
  const iconColor = isWork ? "text-danger" : "text-accent";

  return (
    <button
      onClick={onOpen}
      aria-label={t("widget.openAria")}
      className="absolute bottom-3 right-3 z-30 flex min-w-[210px] max-w-[calc(100%-1.5rem)] items-center gap-2.5 rounded-2xl border border-line bg-surface px-3 py-2.5 text-left shadow-xl transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <span className={`shrink-0 ${iconColor}`}>
        <Icon />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs text-muted">{title}</span>
        <span className={`block font-mono text-lg font-bold tabular-nums ${timeColor}`}>{timeText}</span>
      </span>
      <span className="flex shrink-0 flex-col gap-1">
        {running && (
          <Button className={smBtn} onClick={act(pauseTimer)}>
            {t("timer.pause")}
          </Button>
        )}
        {paused && (
          <Button className={smBtn} onClick={act(resumeTimer)}>
            {t("timer.resume")}
          </Button>
        )}
        {(running || paused) && (
          <Button variant="ghost" className={smOutline} onClick={act(restartPhase)}>
            {t("timer.reset")}
          </Button>
        )}
        {awaiting && (
          <Button className={smBtn} onClick={act(advancePhase)}>
            {finished ? t("timer.finish") : t("widget.next")}
          </Button>
        )}
      </span>
    </button>
  );
}
