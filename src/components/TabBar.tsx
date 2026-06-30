import React from "react";

export type TabKey = "reminder" | "timer" | "todo";

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CheckSquareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

const tabs: { key: TabKey; label: string; Icon: () => React.ReactElement }[] = [
  { key: "reminder", label: "提醒", Icon: BellIcon },
  { key: "timer", label: "计时", Icon: ClockIcon },
  { key: "todo", label: "待办", Icon: CheckSquareIcon },
];

export function TabBar({
  value,
  onChange,
  onSignOut,
}: {
  value: TabKey;
  onChange: (k: TabKey) => void;
  onSignOut: () => void;
}) {
  return (
    <nav className="flex items-stretch border-b border-line bg-surface">
      <div className="flex flex-1">
        {tabs.map((t) => {
          const active = value === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={`relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm transition ${
                active
                  ? "font-semibold text-accent-ink"
                  : "font-normal text-muted hover:text-ink"
              }`}
            >
              <t.Icon />
              <span>{t.label}</span>
              {active && (
                <span
                  className="absolute bottom-0 left-1/2 h-[2.5px] -translate-x-1/2 rounded-full bg-accent"
                  style={{ width: "60%" }}
                />
              )}
            </button>
          );
        })}
      </div>
      <button
        onClick={onSignOut}
        aria-label="退出"
        className="flex min-w-[40px] items-center justify-center border-l border-line px-3 text-muted transition hover:bg-black/5"
      >
        <LogOutIcon />
      </button>
    </nav>
  );
}
