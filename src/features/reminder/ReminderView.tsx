import { useEffect, useState } from "react";
import { reminderApi, type Reminder } from "../../shared/api/reminder";
import { formatDateTime } from "../../shared/datetime";
import { Button } from "../../components/Button";

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

  if (loading) return <p className="p-4 text-slate-400">加载中…</p>;
  if (items.length === 0 && !err) return <p className="p-4 text-slate-400">暂无待触发的提醒</p>;

  return (
    <>
      {err && (
        <div className="px-4 py-2 text-sm text-red-600 bg-red-50 border-b border-red-200">
          {err}
        </div>
      )}
      <ul className="divide-y divide-slate-100">
        {items.map((r) => (
          <li key={r.id} className="flex items-center gap-2 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-slate-800">{r.message}</p>
              <p className="text-xs text-slate-400">{formatDateTime(r.trigger_at)}</p>
            </div>
            <Button variant="danger" onClick={() => remove(r.id)}>
              删除
            </Button>
          </li>
        ))}
      </ul>
    </>
  );
}
