import { useEffect, useRef, useState } from "react";
import { todoApi, type Todo } from "../shared/api/todo";
import { reminderApi, type Reminder } from "../shared/api/reminder";
import { formatDateTime } from "../shared/datetime";
import { Loading } from "../components/Loading";
import { Button } from "../components/Button";
import { useInfiniteList } from "../shared/useInfiniteList";
import { useT, useLocale } from "../i18n/react";
import type { LocalePref } from "../i18n/core";
import type { MessageKey } from "../i18n/messages/en";
import { getKey, setKey, clearKey } from "../shared/ai/apiKey";
import { validateKey } from "../shared/ai/deepseek";
import { getSettings, setLimit, setAutoCapture, DEFAULT_LIMIT } from "../shared/clipboardStore";

type Seg = "todos" | "reminders";

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

const doneIconBtn =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-black/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
const doneIconBtnDanger =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

function RestoreIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7v6h6" />
      <path d="M3.51 13a9 9 0 1 0 2.13-9.36L3 7" />
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

/** 已完成待办列表（触底分页;可恢复为未完成、可删除）。 */
function DoneTodoList({ active, onChanged }: { active: boolean; onChanged: () => void }) {
  const tr = useT();
  const { items, setItems, loading, loadingMore, hasMore, err, setErr, sentinelRef } =
    useInfiniteList<Todo>((offset, limit) => todoApi.listDone(offset, limit), 0, 10, active);

  // 恢复为未完成:从「已完成」列表移除,并通知外层刷新「待办」列表。
  async function restore(id: number) {
    try {
      await todoApi.update(id, { is_done: false });
      setItems((xs) => xs.filter((x) => x.id !== id));
      setErr("");
      onChanged();
    } catch {
      setErr(tr("err.restoreFailed"));
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

  if (!active) return null;
  if (loading) return <Loading />;
  if (err) return <p className="p-4 text-center text-sm text-danger">{err}</p>;
  if (items.length === 0) return <p className="p-8 text-center text-muted">{tr("profile.noDoneTodos")}</p>;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {items.map((t) => (
        <div key={t.id} className="flex items-center gap-3 border-b border-line px-3.5 py-3 last:border-b-0">
          <span className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded bg-accent text-white">
            <CheckIcon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm leading-snug text-muted line-through decoration-line">
              {t.content}
            </p>
            {t.done_at && (
              <p className="mt-0.5 tabular-nums text-xs text-muted">{formatDateTime(t.done_at)}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={() => void restore(t.id)} aria-label={tr("profile.restoreAria", { content: t.content })} title={tr("profile.restore")} className={doneIconBtn}>
              <RestoreIcon />
            </button>
            <button onClick={() => void remove(t.id)} aria-label={tr("profile.deleteAria", { content: t.content })} title={tr("action.delete")} className={doneIconBtnDanger}>
              <TrashIcon />
            </button>
          </div>
        </div>
      ))}
      {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-px" />}
      {loadingMore && <p className="py-3 text-center text-xs text-muted">{tr("common.loading")}</p>}
    </div>
  );
}

/** 已触发（历史）提醒列表（可删除 + 触底分页）。 */
function TriggeredReminderList({ active }: { active: boolean }) {
  const t = useT();
  const { items, setItems, loading, loadingMore, hasMore, err, setErr, sentinelRef } =
    useInfiniteList<Reminder>((offset, limit) => reminderApi.listTriggered(offset, limit), 0, 10, active);

  async function remove(id: number) {
    try {
      await reminderApi.remove(id);
      setItems((xs) => xs.filter((x) => x.id !== id));
      setErr("");
    } catch {
      setErr(t("err.deleteFailed"));
    }
  }

  if (!active) return null;
  if (loading) return <Loading />;
  if (err) return <p className="p-4 text-center text-sm text-danger">{err}</p>;
  if (items.length === 0) return <p className="p-8 text-center text-muted">{t("profile.noReminders")}</p>;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {items.map((r) => (
        <div key={r.id} className="flex items-start gap-3 border-b border-line px-3.5 py-3 last:border-b-0">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black/[0.05] text-muted">
            <BellIcon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm leading-snug text-ink/80">{r.message}</p>
            <p className="mt-0.5 tabular-nums text-xs text-muted">{formatDateTime(r.trigger_at)}</p>
          </div>
          <button
            onClick={() => void remove(r.id)}
            aria-label={t("profile.deleteAria", { content: r.message })}
            title={t("action.delete")}
            className={`mt-0.5 ${doneIconBtnDanger}`}
          >
            <TrashIcon />
          </button>
        </div>
      ))}
      {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-px" />}
      {loadingMore && <p className="py-3 text-center text-xs text-muted">{t("common.loading")}</p>}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

const LANG_OPTIONS: { value: LocalePref; labelKey?: MessageKey; label?: string }[] = [
  { value: "system", labelKey: "profile.langSystem" },
  { value: "zh-Hans", label: "简体中文" },
  { value: "zh-Hant", label: "繁體中文" },
  { value: "en", label: "English" },
];

/** 自定义语言下拉:原生 select 的选项列表由系统渲染、无法配色,故换成可主题化的弹层。 */
function LanguageSelect() {
  const t = useT();
  const { pref, setPref } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const labelFor = (o: (typeof LANG_OPTIONS)[number]) => (o.labelKey ? t(o.labelKey) : o.label!);
  const current = LANG_OPTIONS.find((o) => o.value === pref) ?? LANG_OPTIONS[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("profile.language")}
        className="flex items-center gap-1.5 rounded-lg border border-line bg-ground px-2.5 py-1.5 text-sm text-ink transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        {labelFor(current)}
        <ChevronIcon open={open} />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full z-10 mt-1 min-w-[150px] overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lg"
        >
          {LANG_OPTIONS.map((o) => {
            const selected = o.value === pref;
            return (
              <li key={o.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    setPref(o.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-black/[0.04] ${
                    selected ? "font-semibold text-accent-ink" : "text-ink"
                  }`}
                >
                  <span>{labelFor(o)}</span>
                  {selected && <CheckIcon />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type AiStatusMsg = "" | "valid" | "invalid" | "network";

function AiKeyCard() {
  const t = useT();
  const [enabled, setEnabled] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<AiStatusMsg>("");

  useEffect(() => {
    void getKey().then((k) => setEnabled(k.length > 0));
  }, []);

  async function save() {
    const key = draft.trim();
    if (!key || saving) return;
    setSaving(true);
    setMsg("");
    const status = await validateKey(key);
    if (status === "valid") {
      await setKey(key);
      setEnabled(true);
      setDraft("");
      setMsg("valid");
    } else if (status === "invalid") {
      setMsg("invalid");
    } else {
      setMsg("network");
    }
    setSaving(false);
  }

  async function remove() {
    await clearKey();
    setEnabled(false);
    setMsg("");
  }

  const msgClass = msg === "valid" ? "text-accent-ink" : "text-danger";
  const msgText =
    msg === "valid" ? t("profile.aiValid")
    : msg === "invalid" ? t("profile.aiInvalid")
    : msg === "network" ? t("profile.aiNetworkErr")
    : "";

  return (
    <div className="mb-3 rounded-2xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">{t("profile.aiSection")}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            enabled ? "bg-accent-soft text-accent-ink" : "bg-black/[0.05] text-muted"
          }`}
        >
          {enabled ? t("profile.aiEnabled") : t("profile.aiNotSet")}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void save(); }}
          placeholder={t("profile.aiKeyPlaceholder")}
          aria-label={t("profile.aiSection")}
          className="min-w-0 flex-1 rounded-lg border border-line bg-ground px-2.5 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        />
        <Button onClick={() => void save()} disabled={saving || !draft.trim()} className="shrink-0 py-1.5">
          {saving ? t("profile.aiSaving") : t("profile.aiSave")}
        </Button>
        {enabled && (
          <Button variant="ghost" onClick={() => void remove()} className="shrink-0 border border-line py-1.5">
            {t("profile.aiClear")}
          </Button>
        )}
      </div>
      {msgText && <p className={`mt-2 text-xs font-medium ${msgClass}`}>{msgText}</p>}
      <p className="mt-2 text-xs leading-relaxed text-muted">{t("profile.aiHint")}</p>
    </div>
  );
}

function ClipboardSettingsCard() {
  const t = useT();
  const [limitDraft, setLimitDraft] = useState(String(DEFAULT_LIMIT));
  const [autoCapture, setAuto] = useState(true);

  useEffect(() => {
    void getSettings().then((s) => {
      setLimitDraft(String(s.limit));
      setAuto(s.autoCapture);
    });
  }, []);

  async function commitLimit() {
    const n = Math.max(1, Math.min(1000, Math.round(Number(limitDraft)) || DEFAULT_LIMIT));
    setLimitDraft(String(n));
    await setLimit(n);
  }

  async function toggle(next: boolean) {
    setAuto(next);
    await setAutoCapture(next);
  }

  return (
    <div className="mb-3 rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 text-sm font-semibold text-ink">{t("profile.clipboardSection")}</div>
      <label className="flex items-center justify-between gap-2 text-sm text-ink">
        <span>{t("clip.limitLabel")}</span>
        <span className="flex items-center gap-1.5 text-muted">
          <input
            type="number"
            min={1}
            max={1000}
            value={limitDraft}
            onChange={(e) => setLimitDraft(e.target.value)}
            onBlur={() => void commitLimit()}
            onKeyDown={(e) => { if (e.key === "Enter") void commitLimit(); }}
            className="w-16 rounded-md border border-line bg-ground px-1.5 py-1 text-center text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          />
          {t("clip.limitUnit")}
        </span>
      </label>
      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={autoCapture}
          onChange={(e) => void toggle(e.target.checked)}
          className="h-4 w-4 accent-accent"
        />
        {t("clip.autoCaptureLabel")}
      </label>
    </div>
  );
}

export function ProfileView({
  onBack,
  onChanged,
}: {
  onBack: () => void;
  onChanged: () => void;
}) {
  const [seg, setSeg] = useState<Seg>("todos");
  const t = useT();

  return (
    <div className="animate-slide-in-right absolute inset-0 z-20 flex h-full flex-col bg-ground">
      <div className="flex items-center gap-1 border-b border-line bg-surface px-2 py-1.5">
        <button
          onClick={onBack}
          aria-label={t("profile.backAria")}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <BackIcon />
        </button>
        <h2 className="text-[15px] font-semibold text-ink">{t("profile.title")}</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
        <AiKeyCard />
        <ClipboardSettingsCard />
        {/* 语言选择器 */}
        <div className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
          <span className="text-sm text-ink">{t("profile.language")}</span>
          <LanguageSelect />
        </div>

        {/* 分段：已完成待办 / 历史提醒 */}
        <div className="mt-4 flex gap-1 rounded-xl bg-black/[0.04] p-1">
          {(["todos", "reminders"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setSeg(k)}
              aria-selected={seg === k}
              className={`flex-1 rounded-lg py-2 text-[13px] font-semibold transition ${
                seg === k ? "bg-surface text-accent-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {k === "todos" ? t("profile.segTodos") : t("profile.segReminders")}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <DoneTodoList active={seg === "todos"} onChanged={onChanged} />
          <TriggeredReminderList active={seg === "reminders"} />
        </div>
      </div>
    </div>
  );
}
