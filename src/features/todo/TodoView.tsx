import { useCallback, useState } from "react";
import { todoApi, type Todo } from "../../shared/api/todo";
import { Input } from "../../components/Input";
import { Loading } from "../../components/Loading";
import { useInfiniteList } from "../../shared/useInfiniteList";
import { useT } from "../../i18n/react";

const iconBtn =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-black/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
const iconBtnDanger =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
const iconBtnAccent =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-accent transition hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 6.5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function TodoView({ refreshKey }: { refreshKey: number }) {
  const tr = useT();
  const fetchPage = useCallback(
    (offset: number, limit: number) => todoApi.listActive(offset, limit),
    [],
  );
  const { items, setItems, loading, loadingMore, hasMore, err, setErr, sentinelRef } =
    useInfiniteList<Todo>(fetchPage, refreshKey);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  // 列表只含未完成项，勾选即标记完成并从列表移除。
  async function complete(t: Todo) {
    try {
      await todoApi.update(t.id, { is_done: true });
      setItems((xs) => xs.filter((x) => x.id !== t.id));
      setErr("");
    } catch {
      setErr(tr("err.actionFailed"));
    }
  }

  async function remove(id: number) {
    try {
      await todoApi.remove(id);
      setItems((xs) => xs.filter((x) => x.id !== id));
      setErr("");
    } catch {
      setErr(tr("err.deleteFailed"));
    }
  }

  function startEdit(t: Todo) {
    setEditingId(t.id);
    setDraft(t.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft("");
  }

  async function saveEdit(t: Todo) {
    const content = draft.trim();
    if (!content || content === t.content) {
      cancelEdit();
      return;
    }
    try {
      await todoApi.update(t.id, { content });
      setItems((xs) => xs.map((x) => (x.id === t.id ? { ...x, content } : x)));
      cancelEdit();
      setErr("");
    } catch {
      setErr(tr("err.saveFailed"));
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
        <p className="p-4 text-center text-muted">{tr("todo.empty")}</p>
      ) : (
        <ul>
          {visible.map((t) => {
            const editing = editingId === t.id;
            return (
              <li key={t.id} className="flex items-center gap-2 border-b border-line px-4 py-3">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => complete(t)}
                  disabled={editing}
                  className="h-4 w-4 shrink-0 accent-accent disabled:opacity-40"
                  aria-label={tr("todo.completeAria", { content: t.content })}
                />
                {editing ? (
                  <>
                    <Input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveEdit(t);
                        else if (e.key === "Escape") cancelEdit();
                      }}
                      className="min-w-0 flex-1 py-1"
                      aria-label={tr("todo.editAria")}
                    />
                    <button onClick={() => void saveEdit(t)} aria-label={tr("action.save")} className={iconBtnAccent}>
                      <CheckIcon />
                    </button>
                    <button onClick={cancelEdit} aria-label={tr("action.cancel")} className={iconBtn}>
                      <XIcon />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 break-words text-sm leading-relaxed text-ink">
                      {t.content}
                    </span>
                    <button onClick={() => startEdit(t)} aria-label={tr("action.edit")} title={tr("action.edit")} className={iconBtn}>
                      <PencilIcon />
                    </button>
                    <button onClick={() => remove(t.id)} aria-label={tr("action.delete")} title={tr("action.delete")} className={iconBtnDanger}>
                      <TrashIcon />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-px" />}
      {loadingMore && <p className="py-3 text-center text-xs text-muted">{tr("common.loading")}</p>}
    </>
  );
}
