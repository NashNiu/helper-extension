import { useCallback } from "react";
import { todoApi, type Todo } from "../../shared/api/todo";
import { Button } from "../../components/Button";
import { Loading } from "../../components/Loading";
import { useInfiniteList } from "../../shared/useInfiniteList";

export function TodoView({ refreshKey }: { refreshKey: number }) {
  const fetchPage = useCallback(
    (offset: number, limit: number) => todoApi.listActive(offset, limit),
    [],
  );
  const { items, setItems, loading, loadingMore, hasMore, err, setErr, sentinelRef } =
    useInfiniteList<Todo>(fetchPage, refreshKey);

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

  return (
    <>
      {err && (
        <div className="border-b border-line bg-danger/5 px-4 py-2 text-sm text-danger">
          {err}
        </div>
      )}
      {loading ? (
        <Loading />
      ) : visible.length === 0 ? (
        <p className="p-4 text-center text-muted">暂无待办</p>
      ) : (
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
      )}
      {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-px" />}
      {loadingMore && <p className="py-3 text-center text-xs text-muted">加载中…</p>}
    </>
  );
}
