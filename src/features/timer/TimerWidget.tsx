import { nextStep } from "../../background/logic";
import {
  pauseTimer,
  resumeTimer,
  restartPhase,
  advancePhase,
} from "../../shared/timerControl";
import { useState } from "react";
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

function ChevronRightIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

const smBtn = "px-2 py-1 text-xs";
const smOutline = "border border-line px-2 py-1 text-xs";

/** 悬浮计时小组件:计时进行时,在非「计时」标签页展示进度与快捷控制;点主体切回计时页。 */
export function TimerWidget({ onOpen }: { onOpen: () => void }) {
  const t = useT();
  const { timer, remaining, refresh } = useCountdown();
  // 默认收起为右边缘小胶囊，尽量不遮挡列表；点开才展开完整控制。
  const [collapsed, setCollapsed] = useState(true);
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
  const chipBg = isWork ? "bg-danger/10" : "bg-accent-soft";

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label={t("widget.expandAria")}
        title={`${title} · ${timeText}`}
        className="animate-widget-tab-in group absolute bottom-3 right-0 z-30 flex flex-col items-center gap-0.5 rounded-l-lg border border-r-0 border-line bg-surface/90 py-1.5 pl-1.5 pr-1 shadow-md backdrop-blur-sm transition hover:border-accent/60 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <span className={`${iconColor} [&>svg]:h-4 [&>svg]:w-4`}>
          <Icon />
        </span>
        {!awaiting && (
          <span className={`font-mono text-[10px] font-bold leading-none tabular-nums ${timeColor}`}>{fmt(remaining)}</span>
        )}
      </button>
    );
  }

  return (
    <div className="animate-widget-in absolute bottom-3 right-3 z-30 flex min-w-[210px] max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-2xl border border-line bg-surface/95 py-2.5 pl-2.5 pr-1.5 shadow-lg backdrop-blur-sm transition focus-within:border-accent/60 hover:border-accent/60">
      <button
        type="button"
        onClick={onOpen}
        aria-label={t("widget.openAria")}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${chipBg} ${iconColor}`}>
          <Icon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs text-muted">{title}</span>
          <span className={`block font-mono text-lg font-bold leading-tight tabular-nums ${timeColor}`}>{timeText}</span>
        </span>
      </button>
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
      <button
        type="button"
        onClick={() => setCollapsed(true)}
        aria-label={t("widget.collapseAria")}
        className="flex shrink-0 items-center self-stretch rounded-r-lg border-l border-line pl-1 text-muted transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <ChevronRightIcon />
      </button>
    </div>
  );
}
