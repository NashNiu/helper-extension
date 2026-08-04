import { useCallback, useState } from "react";
import { todoApi, type Todo } from "../../shared/api/todo";
import { Input } from "../../components/Input";
import { Loading } from "../../components/Loading";
import { useInfiniteList } from "../../shared/useInfiniteList";
import { useT } from "../../i18n/react";
import { TodoImageStrip } from "./TodoImageStrip";
import { ClipboardImagePicker } from "./ClipboardImagePicker";
import { MAX_TODO_IMAGES } from "../../shared/api/todo";
import { downscale } from "../../shared/images";
import { MAX_IMAGE_BYTES } from "../../shared/clipboardStore";

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
  const [busyImageId, setBusyImageId] = useState<number | null>(null);
  const [pickingFor, setPickingFor] = useState<number | null>(null);

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

  /**
   * 从系统剪贴板取一张图并附加到待办。
   *
   * 流程:读剪贴板 → 找 image/* → 5MB 前置拦截(降采样前,避免把超大图解码进内存)
   * → 降采样 → 上传/存本地。navigator.clipboard.read() 需要面板有焦点,失败时给明确提示。
   */
  async function pasteImage(t: Todo) {
    if (t.images.length >= MAX_TODO_IMAGES) {
      setErr(tr("todo.imageMax", { max: MAX_TODO_IMAGES }));
      return;
    }
    setBusyImageId(t.id);
    try {
      const clipItems = await navigator.clipboard.read();
      let blob: Blob | null = null;
      for (const ci of clipItems) {
        const imgType = ci.types.find((ty) => ty.startsWith("image/"));
        if (imgType) {
          blob = await ci.getType(imgType);
          break;
        }
      }
      if (!blob) {
        setErr(tr("todo.noImageInClipboard"));
        return;
      }
      if (blob.size > MAX_IMAGE_BYTES) {
        setErr(tr("todo.imageTooLarge"));
        return;
      }
      const small = await downscale(blob);
      const images = await todoApi.addImages(t.id, [small]);
      setItems((xs) => xs.map((x) => (x.id === t.id ? { ...x, images } : x)));
      setErr("");
    } catch {
      setErr(tr("todo.imageAddFailed"));
    } finally {
      setBusyImageId(null);
    }
  }

  /** 从剪贴板板选中一张:dataUrl → Blob → 走与粘贴完全相同的降采样与上传路径。 */
  async function attachFromClipboard(todoId: number, dataUrl: string) {
    setPickingFor(null);
    const t = items.find((x) => x.id === todoId);
    if (!t) return;
    if (t.images.length >= MAX_TODO_IMAGES) {
      setErr(tr("todo.imageMax", { max: MAX_TODO_IMAGES }));
      return;
    }
    setBusyImageId(todoId);
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const small = await downscale(blob);
      const images = await todoApi.addImages(todoId, [small]);
      setItems((xs) => xs.map((x) => (x.id === todoId ? { ...x, images } : x)));
      setErr("");
    } catch {
      setErr(tr("todo.imageAddFailed"));
    } finally {
      setBusyImageId(null);
    }
  }

  /**
   * 删掉一张图。todoApi.removeImage 返回 void(后端 DELETE 端点没有响应体),
   * 所以这里自己从本地状态过滤掉该 id,而不是等一个新列表回来。
   */
  async function dropImage(t: Todo, imageId: number) {
    try {
      await todoApi.removeImage(t.id, imageId);
      setItems((xs) =>
        xs.map((x) =>
          x.id === t.id ? { ...x, images: x.images.filter((i) => i.id !== imageId) } : x,
        ),
      );
      setErr("");
    } catch {
      setErr(tr("err.deleteFailed"));
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
              <li key={t.id} className="border-b border-line px-4 py-3">
                <div className="flex items-center gap-2">
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
                </div>

                {editing ? (
                  <div className="mt-2 pl-6">
                    <button
                      type="button"
                      onClick={() => void pasteImage(t)}
                      disabled={busyImageId === t.id}
                      className="rounded-lg border border-line px-2 py-1 text-xs text-muted transition hover:border-accent hover:text-ink disabled:opacity-40"
                    >
                      {tr("todo.pasteImage")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPickingFor(t.id)}
                      disabled={busyImageId === t.id}
                      className="ml-1.5 rounded-lg border border-line px-2 py-1 text-xs text-muted transition hover:border-accent hover:text-ink disabled:opacity-40"
                    >
                      {tr("todo.fromClipboard")}
                    </button>
                    <TodoImageStrip images={t.images} onRemove={(imgId) => void dropImage(t, imgId)} />
                  </div>
                ) : (
                  <div className="pl-6">
                    <TodoImageStrip images={t.images} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-px" />}
      {loadingMore && <p className="py-3 text-center text-xs text-muted">{tr("common.loading")}</p>}
      {pickingFor !== null && (
        <ClipboardImagePicker
          onPick={(dataUrl) => void attachFromClipboard(pickingFor, dataUrl)}
          onClose={() => setPickingFor(null)}
        />
      )}
    </>
  );
}
