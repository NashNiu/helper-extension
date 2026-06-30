import { useEffect, useState } from "react";
import { todoApi, type Todo } from "../../shared/api/todo";
import { Button } from "../../components/Button";

export function TodoView({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      setItems(await todoApi.list());
    } catch {
      setErr("加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [refreshKey]);

  async function toggle(t: Todo) {
    try {
      const updated = await todoApi.update(t.id, { is_done: !t.is_done });
      setItems((xs) => xs.map((x) => (x.id === t.id ? updated : x)));
      setErr("");
    } catch {
      setErr("操作失败");
    }
  }

  async function remove(id: number) {
    try {
      await todoApi.remove(id);
      setItems((xs) => xs.filter((x) => x.id !== id));
      setErr("");
    } catch {
      setErr("删除失败");
    }
  }

  if (loading) return <p className="p-4 text-muted">加载中…</p>;
  if (items.length === 0 && !err) return <p className="p-4 text-muted">暂无待办</p>;

  return (
    <>
      {err && (
        <div className="border-b border-line bg-danger/5 px-4 py-2 text-sm text-danger">
          {err}
        </div>
      )}
      <ul>
        {items.map((t) => (
          <li key={t.id} className="flex items-start gap-3 border-b border-line px-4 py-3">
            <input
              type="checkbox"
              checked={t.is_done}
              onChange={() => toggle(t)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
            />
            <span
              className={`min-w-0 flex-1 break-words text-sm leading-relaxed ${
                t.is_done ? "text-muted line-through" : "text-ink"
              }`}
            >
              {t.content}
            </span>
            <Button variant="danger" onClick={() => remove(t.id)} className="shrink-0">
              删除
            </Button>
          </li>
        ))}
      </ul>
    </>
  );
}
