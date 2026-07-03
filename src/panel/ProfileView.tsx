import { useState } from "react";
import { todoApi, type Todo } from "../shared/api/todo";
import { reminderApi, type Reminder } from "../shared/api/reminder";
import { formatDateTime } from "../shared/datetime";
import { Button } from "../components/Button";
import { Loading } from "../components/Loading";
import { useInfiniteList } from "../shared/useInfiniteList";
import { useT, useLocale } from "../i18n/react";
import type { LocalePref } from "../i18n/core";

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
            <button onClick={() => void remove(t.id)} aria-label={tr("profile.deleteAria", { content: t.content })} title={tr("profile.restore")} className={doneIconBtnDanger}>
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

/** 已触发（历史）提醒列表（纯查看 + 触底分页）。 */
function TriggeredReminderList({ active }: { active: boolean }) {
  const t = useT();
  const { items, loading, loadingMore, hasMore, err, sentinelRef } = useInfiniteList<Reminder>(
    (offset, limit) => reminderApi.listTriggered(offset, limit),
    0,
    10,
    active,
  );
  if (!active) return null;
  if (loading) return <Loading />;
  if (err) return <p className="p-4 text-center text-sm text-danger">{err}</p>;
  if (items.length === 0) return <p className="p-8 text-center text-muted">{t("profile.noReminders")}</p>;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {items.map((r) => (
        <div key={r.id} className="flex items-start gap-3 border-b border-line px-3.5 py-3 last:border-b-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black/[0.05] text-muted">
            <BellIcon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm leading-snug text-ink/80">{r.message}</p>
            <p className="mt-0.5 tabular-nums text-xs text-muted">{formatDateTime(r.trigger_at)}</p>
          </div>
        </div>
      ))}
      {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-px" />}
      {loadingMore && <p className="py-3 text-center text-xs text-muted">{t("common.loading")}</p>}
    </div>
  );
}

export function ProfileView({
  loggedIn,
  userName,
  userEmail,
  onBack,
  onSignIn,
  onSignOut,
  onChanged,
}: {
  loggedIn: boolean;
  userName: string;
  userEmail: string;
  onBack: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onChanged: () => void;
}) {
  const [seg, setSeg] = useState<Seg>("todos");
  const t = useT();
  const { pref, setPref } = useLocale();

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
        {/* 账户卡片 */}
        {loggedIn ? (
          <>
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
              <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-accent text-lg font-bold text-white">
                {userName.slice(0, 1) || "我"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{userName}</p>
                {userEmail && <p className="mt-0.5 break-all text-xs text-muted">{userEmail}</p>}
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-ink">
                  <CheckIcon /> {t("profile.synced")}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={onSignOut}
              className="mt-3 w-full border border-line py-2.5"
            >
              {t("profile.signOut")}
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
              <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-muted">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{t("profile.localMode")}</p>
                <p className="mt-0.5 text-xs text-muted">{t("profile.notSignedIn")}</p>
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] font-semibold text-muted">
                  {t("profile.dataLocalOnly")}
                </span>
              </div>
            </div>
            <Button onClick={onSignIn} className="mt-3 w-full py-2.5">
              {t("profile.signInToSync")}
            </Button>
            <p className="mt-2.5 px-0.5 text-xs leading-relaxed text-muted">
              {t("profile.localHint")}
            </p>
          </>
        )}

        {/* 语言选择器 */}
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
          <span className="text-sm text-ink">{t("profile.language")}</span>
          <select
            value={pref}
            onChange={(e) => setPref(e.target.value as LocalePref)}
            className="rounded-lg border border-line bg-ground px-2 py-1 text-sm text-ink focus:border-accent focus:outline-none"
            aria-label={t("profile.language")}
          >
            <option value="system">{t("profile.langSystem")}</option>
            <option value="zh-Hans">简体中文</option>
            <option value="zh-Hant">繁體中文</option>
            <option value="en">English</option>
          </select>
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
