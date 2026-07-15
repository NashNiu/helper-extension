import { useCallback, useEffect, useState } from "react";
import { reminderApi, type Reminder } from "../../shared/api/reminder";
import { formatDateTime } from "../../shared/datetime";
import { Loading } from "../../components/Loading";
import { useInfiniteList } from "../../shared/useInfiniteList";
import { useT } from "../../i18n/react";
import { localDailyReminders, type DailyReminder } from "../../shared/local/dailyReminders";
import { formatHourMinute } from "../../shared/datetime";

const iconBtnDanger =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

function BellIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
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

function RepeatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

export function ReminderView({ refreshKey }: { refreshKey: number }) {
  const t = useT();
  const fetchPage = useCallback(
    (offset: number, limit: number) => reminderApi.listPending(offset, limit),
    [],
  );
  const { items, setItems, loading, loadingMore, hasMore, err, setErr, sentinelRef } =
    useInfiniteList<Reminder>(fetchPage, refreshKey);

  const [daily, setDaily] = useState<DailyReminder[]>([]);
  useEffect(() => {
    let alive = true;
    void localDailyReminders.list().then((d) => { if (alive) setDaily(d); });
    return () => { alive = false; };
  }, [refreshKey]);

  async function removeDaily(id: number) {
    try {
      await localDailyReminders.remove(id);
      setDaily((xs) => xs.filter((x) => x.id !== id));
    } catch {
      setErr(t("err.deleteFailed"));
    }
  }

  async function remove(id: number) {
    try {
      await reminderApi.remove(id);
      setItems((xs) => xs.filter((x) => x.id !== id));
    } catch {
      setErr(t("err.deleteFailed"));
    }
  }

  return (
    <>
      {err && (
        <div className="border-b border-line bg-danger/5 px-4 py-2 text-sm text-danger">
          {err}
        </div>
      )}
      {daily.length > 0 && (
        <>
          <p className="px-4 pt-3 pb-1 text-xs text-muted">{t("reminder.dailyHeader")}</p>
          <ul>
            {daily.map((r) => (
              <li key={`daily-${r.id}`} className="flex items-start gap-3 border-b border-line px-4 py-3">
                <span className="mt-0.5 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-ink">
                  <RepeatIcon />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm leading-relaxed text-ink">{r.message}</p>
                  <p className="tabular-nums text-xs text-muted">
                    {t("reminder.dailyAt", { time: formatHourMinute(r.hour, r.minute) })}
                  </p>
                </div>
                <button
                  onClick={() => removeDaily(r.id)}
                  aria-label={t("action.delete")}
                  title={t("action.delete")}
                  className={`mt-0.5 ${iconBtnDanger}`}
                >
                  <TrashIcon />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {loading ? (
        <Loading />
      ) : items.length === 0 ? (
        daily.length === 0 ? <p className="p-4 text-center text-muted">{t("reminder.empty")}</p> : null
      ) : (
        <>
          <p className="px-4 pt-3 pb-1 text-xs text-muted">{t("reminder.pendingHeader")}</p>
          <ul>
            {items.map((r) => (
              <li key={r.id} className="flex items-start gap-3 border-b border-line px-4 py-3">
                <span className="mt-0.5 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-ink">
                  <BellIcon />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm leading-relaxed text-ink">{r.message}</p>
                  <p className="tabular-nums text-xs text-muted">{formatDateTime(r.trigger_at)}</p>
                </div>
                <button
                  onClick={() => remove(r.id)}
                  aria-label={t("action.delete")}
                  title={t("action.delete")}
                  className={`mt-0.5 ${iconBtnDanger}`}
                >
                  <TrashIcon />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-px" />}
      {loadingMore && <p className="py-3 text-center text-xs text-muted">{t("common.loading")}</p>}
    </>
  );
}
