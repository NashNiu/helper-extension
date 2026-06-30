import { useEffect, useState } from "react";
import { reminderApi, type Reminder } from "../../shared/api/reminder";
import { formatDateTime } from "../../shared/datetime";
import { Button } from "../../components/Button";
import { Loading } from "../../components/Loading";

function BellIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function ReminderView({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      setItems(await reminderApi.listPending());
    } catch {
      setErr("加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [refreshKey]);

  async function remove(id: number) {
    try {
      await reminderApi.remove(id);
      setItems((xs) => xs.filter((x) => x.id !== id));
    } catch {
      setErr("删除失败");
    }
  }

  if (loading) return <Loading />;
  if (items.length === 0 && !err) return <p className="p-4 text-muted">暂无待触发的提醒</p>;

  return (
    <>
      {err && (
        <div className="border-b border-line bg-danger/5 px-4 py-2 text-sm text-danger">
          {err}
        </div>
      )}
      <p className="px-4 pt-3 pb-1 text-xs text-muted">待触发的提醒</p>
      <ul>
        {items.map((r) => (
          <li key={r.id} className="flex items-start gap-3 border-b border-line px-4 py-3">
            <span className="mt-0.5 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-ink">
              <BellIcon />
            </span>
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm leading-relaxed text-ink">{r.message}</p>
              <p className="tabular-nums text-xs text-muted">{formatDateTime(r.trigger_at)}</p>
            </div>
            <Button variant="danger" onClick={() => remove(r.id)} className="shrink-0">
              删除
            </Button>
          </li>
        ))}
      </ul>
    </>
  );
}
