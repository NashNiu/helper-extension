import { useCallback } from "react";
import { reminderApi, type Reminder } from "../../shared/api/reminder";
import { formatDateTime } from "../../shared/datetime";
import { Button } from "../../components/Button";
import { Loading } from "../../components/Loading";
import { useInfiniteList } from "../../shared/useInfiniteList";
import { useT } from "../../i18n/react";

function BellIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
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
      {loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <p className="p-4 text-center text-muted">{t("reminder.empty")}</p>
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
                <Button variant="danger" onClick={() => remove(r.id)} className="shrink-0">
                  {t("action.delete")}
                </Button>
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
