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
    await reminderApi.remove(id);
    setItems((xs) => xs.filter((x) => x.id !== id));
  }

  if (loading) return <p className="p-4 text-slate-400">加载中…</p>;
  if (err) return <p className="p-4 text-red-600">{err}</p>;
  if (items.length === 0) return <p className="p-4 text-slate-400">暂无待触发的提醒</p>;

  return (
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
  );
}
