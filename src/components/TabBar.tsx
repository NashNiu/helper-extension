import type { ReactElement } from "react";
import { useT } from "../i18n/react";
import type { MessageKey } from "../i18n/messages/en";

export type TabKey = "reminder" | "timer" | "todo" | "clipboard";

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

function GearIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
    </svg>
  );
}

const tabs: { key: TabKey; Icon: () => ReactElement }[] = [
  { key: "todo", Icon: CheckSquareIcon },
  { key: "reminder", Icon: BellIcon },
  { key: "timer", Icon: ClockIcon },
  { key: "clipboard", Icon: ClipboardIcon },
];

const TAB_LABEL: Record<TabKey, MessageKey> = {
  todo: "tab.todo",
  reminder: "tab.reminder",
  timer: "tab.timer",
  clipboard: "tab.clipboard",
};

export function TabBar({
  value,
  onChange,
  onOpenProfile,
}: {
  value: TabKey;
  onChange: (k: TabKey) => void;
  onOpenProfile: () => void;
}) {
  const t = useT();
  return (
    <nav className="flex items-stretch border-b border-line bg-surface">
      <div className="flex flex-1">
        {tabs.map((tab) => {
          const active = value === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={`relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                active
                  ? "font-semibold text-accent-ink"
                  : "font-normal text-muted hover:text-ink"
              }`}
            >
              <tab.Icon />
              <span>{t(TAB_LABEL[tab.key])}</span>
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
        aria-label={t("nav.profile")}
        title={t("nav.profile")}
        className="relative flex min-w-[48px] items-center justify-center border-l border-line px-2.5 text-muted transition hover:bg-black/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <GearIcon />
      </button>
    </nav>
  );
}
