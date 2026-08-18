import { useCallback, useState } from "react";
import { todoApi, type Todo } from "../../shared/api/todo";
import { Input } from "../../components/Input";
import { Loading } from "../../components/Loading";
import { useInfiniteList } from "../../shared/useInfiniteList";
import { useT } from "../../i18n/react";
import { TodoImageStrip } from "./TodoImageStrip";
import { ClipboardImagePicker } from "./ClipboardImagePicker";
import { MAX_TODO_IMAGES } from "../../shared/api/todo";
import { downscale, MAX_PASTE_IMAGE_BYTES } from "../../shared/images";
import { formatDateTime } from "../../shared/datetime";
import type { TodoCategory } from "../../shared/api/todoCategory";
import type { CategorySelection } from "./TodoCategoryBar";
import { chipClass } from "./categoryChip";

const iconBtn =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-black/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
const iconBtnDanger =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
const iconBtnAccent =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-accent transition hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

// datetime-local 控件要的是本地时间字符串 YYYY-MM-DDTHH:mm，不是 ISO(UTC)。
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

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

export function TodoView({
  refreshKey,
  category,
  categories,
}: {
  refreshKey: number;
  category: CategorySelection;
  categories: TodoCategory[];
}) {
  const tr = useT();
  const fetchPage = useCallback(
    (offset: number, limit: number) =>
      todoApi.listActive(offset, limit, category ?? undefined),
    [category],
  );
  // 筛选条件编进重置键:换分类要退回第 0 页重新拉,而 useInfiniteList 只认这个键
  // (它刻意不依赖 fetchPage 的身份,见那边的注释)。
  const { items, setItems, loading, loadingMore, hasMore, err, setErr, sentinelRef } =
    useInfiniteList<Todo>(fetchPage, `${refreshKey}:${category ?? "all"}`);

  const categoryName = (id: number | null) =>
    id === null ? null : (categories.find((c) => c.id === id)?.name ?? null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [remindDraft, setRemindDraft] = useState("");
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
    setRemindDraft(toLocalInput(t.remind_at));
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft("");
    setRemindDraft("");
  }

  async function saveEdit(t: Todo) {
    const content = draft.trim();
    const beforeLocal = toLocalInput(t.remind_at);
    const remindChanged = remindDraft !== beforeLocal;
    if ((!content || content === t.content) && !remindChanged) {
      cancelEdit();
      return;
    }
    try {
      // 只在真的变了时才带 remind_at——否则改内容会把 remind_triggered 重置，
      // 一条已经弹过的提醒会莫名其妙复活。
      const updated = await todoApi.update(t.id, {
        ...(content && content !== t.content ? { content } : {}),
        ...(remindChanged
          ? { remind_at: remindDraft ? new Date(remindDraft).toISOString() : null }
          : {}),
      });
      setItems((xs) => xs.map((x) => (x.id === t.id ? updated : x)));
      cancelEdit();
      setErr("");
    } catch {
      setErr(tr("err.saveFailed"));
    }
  }

  function matchesFilter(t: Todo): boolean {
    if (category === null) return true;
    return category === "none" ? t.category_id === null : t.category_id === category;
  }

  /**
   * 改一条待办的分类。
   *
   * 正在按分类筛选时,改成别的分类就意味着这条待办不再属于当前列表——留着会让
   * 列表里混进一条不符合筛选条件的条目。这时连编辑态一起收掉,因为那一行马上就没了。
   */
  async function changeCategory(t: Todo, categoryId: number | null) {
    try {
      const updated = await todoApi.update(t.id, { category_id: categoryId });
      if (!matchesFilter(updated)) {
        setItems((xs) => xs.filter((x) => x.id !== t.id));
        cancelEdit();
      } else {
        setItems((xs) => xs.map((x) => (x.id === t.id ? updated : x)));
      }
      setErr("");
    } catch {
      setErr(tr("err.saveFailed"));
    }
  }

  /**
   * 从系统剪贴板取一张图并附加到待办。
   *
   * 流程:读剪贴板 → 找 image/* → 25MB 前置拦截(降采样前,避免把超大图解码进内存;
   * 这个上限比剪贴板板的 5MB 宽得多,见 shared/images.ts 里 MAX_PASTE_IMAGE_BYTES
   * 的注释)→ 降采样 → 上传/存本地。navigator.clipboard.read() 需要面板有焦点,
   * 失败时给明确提示。
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
      if (blob.size > MAX_PASTE_IMAGE_BYTES) {
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
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="shrink-0 text-xs text-muted">
                        {tr("todo.remindLabel")}
                      </span>
                      <input
                        type="datetime-local"
                        value={remindDraft}
                        onChange={(e) => setRemindDraft(e.target.value)}
                        aria-label={tr("todo.remindLabel")}
                        className="min-w-0 flex-1 rounded-lg border border-line bg-transparent px-2 py-1 text-xs text-ink"
                      />
                      {remindDraft && (
                        <button
                          type="button"
                          onClick={() => setRemindDraft("")}
                          className="shrink-0 text-xs text-muted transition hover:text-danger"
                        >
                          {tr("todo.clearRemind")}
                        </button>
                      )}
                    </div>
                    {/* 一个分类都没有时整行不出现:没有可归的分类,只摆一枚「未分类」
                        是个按了也没用的空控件。 */}
                    {categories.length > 0 && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="shrink-0 text-xs text-muted">
                          {tr("todo.categoryLabel")}
                        </span>
                        {/* 单选就用单选的语义:radiogroup + aria-checked,键盘与读屏才对。
                            刻意不用 <select>——它展开后的列表由浏览器绘制,配色和字体
                            都进不了这套设计。 */}
                        <div
                          role="radiogroup"
                          aria-label={tr("todo.categoryLabel")}
                          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto"
                        >
                          <button
                            type="button"
                            role="radio"
                            aria-checked={t.category_id === null}
                            onClick={() => void changeCategory(t, null)}
                            className={chipClass(t.category_id === null)}
                          >
                            {tr("todo.categoryNone")}
                          </button>
                          {categories.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              role="radio"
                              aria-checked={t.category_id === c.id}
                              onClick={() => void changeCategory(t, c.id)}
                              className={chipClass(t.category_id === c.id)}
                            >
                              {c.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <TodoImageStrip images={t.images} onRemove={(imgId) => void dropImage(t, imgId)} />
                  </div>
                ) : (
                  <div className="pl-6">
                    {categoryName(t.category_id) && (
                      <span className="mr-1.5 inline-block rounded-full bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent-ink">
                        {categoryName(t.category_id)}
                      </span>
                    )}
                    {t.remind_at && (
                      <p className="tabular-nums text-xs text-muted">
                        ⏰ {formatDateTime(t.remind_at)}
                      </p>
                    )}
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
