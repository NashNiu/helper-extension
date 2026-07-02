import type { ReactElement } from "react";

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

function PersonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

const tabs: { key: TabKey; label: string; Icon: () => ReactElement }[] = [
  { key: "todo", label: "待办", Icon: CheckSquareIcon },
  { key: "reminder", label: "提醒", Icon: BellIcon },
  { key: "timer", label: "计时", Icon: ClockIcon },
];

export function TabBar({
  value,
  onChange,
  loggedIn,
  userInitial,
  onOpenProfile,
}: {
  value: TabKey;
  onChange: (k: TabKey) => void;
  loggedIn: boolean;
  userInitial: string;
  onOpenProfile: () => void;
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
              className={`relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
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
        onClick={onOpenProfile}
        aria-label="个人中心"
        title="个人中心"
        className="relative flex min-w-[48px] items-center justify-center border-l border-line px-2.5 transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        {loggedIn ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-white">
            {userInitial}
          </span>
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.06] text-muted">
            <PersonIcon />
          </span>
        )}
      </button>
    </nav>
  );
}
