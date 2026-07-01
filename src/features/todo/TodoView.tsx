import { useEffect, useState } from "react";
import { todoApi, type Todo } from "../../shared/api/todo";
import { Button } from "../../components/Button";
import { Loading } from "../../components/Loading";

export function TodoView({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      setItems(await todoApi.listActive());
    } catch {
      setErr("加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [refreshKey]);

  // 列表只含未完成项，勾选即标记完成并从列表移除。
  async function complete(t: Todo) {
    try {
      await todoApi.update(t.id, { is_done: true });
      setItems((xs) => xs.filter((x) => x.id !== t.id));
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

  // 后端已按 done=false 过滤；这里再兜底一次，兼容尚未部署该过滤的后端。
  const visible = items.filter((t) => !t.is_done);

  if (loading) return <Loading />;
  if (visible.length === 0 && !err) return <p className="p-4 text-center text-muted">暂无待办</p>;

  return (
    <>
      {err && (
        <div className="border-b border-line bg-danger/5 px-4 py-2 text-sm text-danger">
          {err}
        </div>
      )}
      <ul>
        {visible.map((t) => (
          <li key={t.id} className="flex items-start gap-3 border-b border-line px-4 py-3">
            <input
              type="checkbox"
              checked={false}
              onChange={() => complete(t)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
              aria-label={`完成「${t.content}」`}
            />
            <span className="min-w-0 flex-1 break-words text-sm leading-relaxed text-ink">
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
