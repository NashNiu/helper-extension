import { useState } from "react";
import { Input } from "../../components/Input";
import { useT } from "../../i18n/react";
import {
  isNameTakenError,
  MAX_CATEGORY_NAME,
  type TodoCategory,
} from "../../shared/api/todoCategory";
import { chipClass } from "./categoryChip";

/** null = 全部,"none" = 未分类,数字 = 某个分类。 */
export type CategorySelection = number | "none" | null;

const iconBtn =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-black/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
const iconBtnDanger =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
const iconBtnAccent =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-accent transition hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 6.5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/**
 * 待办分类栏。一栏两用:选中的分类既是列表的筛选条件,也是「一句话添加」新建待办
 * 时归入的分类——侧边栏太窄,放两排控件不值当,而「我现在在某个分类里干活」这个
 * 心智模型本身也更直觉。
 *
 * 齿轮切到管理态:同一块地方就地变成新建/重命名/删除,不弹层——面板本来就窄,
 * 弹层会把列表整个盖住。
 */
export function TodoCategoryBar({
  categories,
  selected,
  onSelect,
  onCreate,
  onRename,
  onRemove,
}: {
  categories: TodoCategory[];
  selected: CategorySelection;
  onSelect: (s: CategorySelection) => void;
  onCreate: (name: string) => Promise<unknown>;
  onRename: (id: number, name: string) => Promise<unknown>;
  onRemove: (id: number) => Promise<unknown>;
}) {
  const tr = useT();
  const [managing, setManaging] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  function reportError(e: unknown) {
    setErr(isNameTakenError(e) ? tr("todo.categoryNameTaken") : tr("err.saveFailed"));
  }

  async function create() {
    const name = draftName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await onCreate(name);
      setDraftName("");
      setErr("");
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  }

  async function saveRename(id: number) {
    const name = renameDraft.trim();
    if (!name) return;
    try {
      await onRename(id, name);
      setRenamingId(null);
      setErr("");
    } catch (e) {
      reportError(e);
    }
  }

  async function remove(id: number) {
    setConfirmingId(null);
    try {
      await onRemove(id);
      setErr("");
    } catch {
      setErr(tr("err.deleteFailed"));
    }
  }

  if (!managing) {
    return (
      <div className="flex items-center gap-1.5 border-b border-line bg-surface px-3 py-2">
        <div
          role="group"
          aria-label={tr("todo.categoryFilterAria")}
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto"
        >
          <button onClick={() => onSelect(null)} className={chipClass(selected === null)}>
            {tr("todo.categoryAll")}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(selected === c.id ? null : c.id)}
              className={chipClass(selected === c.id)}
            >
              {c.name}
            </button>
          ))}
          {/* 未分类放在最后:分类多的时候它不该把用户自己建的分类挤出视野。 */}
          <button
            onClick={() => onSelect(selected === "none" ? null : "none")}
            className={chipClass(selected === "none")}
          >
            {tr("todo.categoryNone")}
          </button>
        </div>
        <button
          onClick={() => {
            setManaging(true);
            setErr("");
          }}
          aria-label={tr("todo.manageCategories")}
          title={tr("todo.manageCategories")}
          className={iconBtn}
        >
          <GearIcon />
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-line bg-surface px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-ink">{tr("todo.manageCategories")}</span>
        <button
          onClick={() => {
            setManaging(false);
            setRenamingId(null);
            setConfirmingId(null);
            setErr("");
          }}
          className="rounded-md px-1.5 py-0.5 text-xs text-accent transition hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          {tr("todo.doneManaging")}
        </button>
      </div>

      {err && <p className="mb-1.5 text-xs text-danger">{err}</p>}

      {categories.length === 0 ? (
        <p className="py-1 text-xs text-muted">{tr("todo.noCategories")}</p>
      ) : (
        <ul className="mb-1.5 max-h-40 overflow-y-auto">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-1 py-0.5">
              {renamingId === c.id ? (
                <>
                  <Input
                    autoFocus
                    value={renameDraft}
                    maxLength={MAX_CATEGORY_NAME}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveRename(c.id);
                      else if (e.key === "Escape") setRenamingId(null);
                    }}
                    className="min-w-0 flex-1 py-1 text-xs"
                    aria-label={tr("todo.renameCategoryAria", { name: c.name })}
                  />
                  <button onClick={() => void saveRename(c.id)} aria-label={tr("action.save")} className={iconBtnAccent}>
                    <CheckIcon />
                  </button>
                  <button onClick={() => setRenamingId(null)} aria-label={tr("action.cancel")} className={iconBtn}>
                    <XIcon />
                  </button>
                </>
              ) : confirmingId === c.id ? (
                <>
                  {/* 就地二次确认。面板里没有对话框组件,而删分类会让一批待办变成
                      未分类——不该是一下点掉的动作。 */}
                  <span className="min-w-0 flex-1 text-xs text-danger">
                    {tr("todo.deleteCategoryConfirm")}
                  </span>
                  <button onClick={() => void remove(c.id)} aria-label={tr("action.delete")} className={iconBtnDanger}>
                    <CheckIcon />
                  </button>
                  <button onClick={() => setConfirmingId(null)} aria-label={tr("action.cancel")} className={iconBtn}>
                    <XIcon />
                  </button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-xs text-ink">{c.name}</span>
                  <button
                    onClick={() => {
                      setRenamingId(c.id);
                      setRenameDraft(c.name);
                      setConfirmingId(null);
                    }}
                    aria-label={tr("todo.renameCategoryAria", { name: c.name })}
                    className={iconBtn}
                  >
                    <PencilIcon />
                  </button>
                  <button
                    onClick={() => setConfirmingId(c.id)}
                    aria-label={tr("todo.deleteCategoryAria", { name: c.name })}
                    className={iconBtnDanger}
                  >
                    <TrashIcon />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-1.5">
        <Input
          value={draftName}
          maxLength={MAX_CATEGORY_NAME}
          placeholder={tr("todo.newCategory")}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void create();
          }}
          className="min-w-0 flex-1 py-1 text-xs"
          aria-label={tr("todo.newCategory")}
        />
        <button
          onClick={() => void create()}
          disabled={busy || !draftName.trim()}
          className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white transition hover:bg-accent-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
        >
          {tr("todo.addCategory")}
        </button>
      </div>
    </div>
  );
}
