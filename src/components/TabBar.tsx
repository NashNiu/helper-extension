export type TabKey = "reminder" | "timer" | "todo";

const tabs: { key: TabKey; label: string }[] = [
  { key: "reminder", label: "提醒" },
  { key: "timer", label: "计时" },
  { key: "todo", label: "待办" },
];

export function TabBar({ value, onChange }: { value: TabKey; onChange: (k: TabKey) => void }) {
  return (
    <nav className="flex border-t border-slate-200 bg-white">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex-1 py-2.5 text-sm font-medium ${
            value === t.key ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
