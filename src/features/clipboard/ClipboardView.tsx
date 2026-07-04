import { useCallback, useEffect, useMemo, useState } from "react";
import { getItems, sortForDisplay, CLIP_ITEMS_KEY, type ClipItem } from "../../shared/clipboardStore";
import { Loading } from "../../components/Loading";
import { useT } from "../../i18n/react";
import type { MessageKey } from "../../i18n/messages/en";

type Filter = "all" | "text" | "image";

function fmtBytes(n?: number): string {
  if (!n) return "";
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

function PinFlagIcon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true">
      <path d="M16 9V4h1a1 1 0 0 0 0-2H7a1 1 0 0 0 0 2h1v5c0 1.66-1.34 3-3 3v2h5.97v6l1 1 1-1v-6H19v-2c-1.66 0-3-1.34-3-3z" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7V5h16v2M9 20h6M12 5v15" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

function Card({ it, t }: { it: ClipItem; t: (k: MessageKey, p?: Record<string, string | number>) => string }) {
  const srcLabel = it.source === "manual" || it.source === "" ? t("clip.sourceManual") : it.source;
  const srcClass = it.source === "manual" || it.source === "" ? "text-[#9a7d5c] font-semibold" : "text-accent-ink font-semibold";
  return (
    <div className="relative flex gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5">
      {it.pinned && (
        <span className="pointer-events-none absolute -top-2 -right-1.5 rotate-[38deg] text-accent" style={{ filter: "drop-shadow(1px 2px 1.5px rgba(40,50,60,.28))" }}>
          <PinFlagIcon />
        </span>
      )}
      <span className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg ${it.type === "image" ? "bg-[#f0ece6] text-[#9a7d5c]" : "bg-accent-soft text-accent-ink"}`}>
        {it.type === "image" ? <ImageIcon /> : <TextIcon />}
      </span>
      <div className="min-w-0 flex-1">
        {it.type === "image" ? (
          <img src={it.dataUrl} alt="" className="block max-h-[130px] w-full rounded-lg border border-line object-cover" />
        ) : (
          <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{it.text}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted">
          <span className={srcClass}>{srcLabel}</span>
          {it.type === "image" && it.w && it.h && (
            <>
              <span className="h-[3px] w-[3px] rounded-full bg-muted" />
              <span>{`${it.w}×${it.h} · ${fmtBytes(it.bytes)}`}</span>
            </>
          )}
          <span className="h-[3px] w-[3px] rounded-full bg-muted" />
          <span className="tabular-nums">{fmtTime(it.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

export function ClipboardView({ refreshKey }: { refreshKey: number }) {
  const t = useT();
  const [items, setItems] = useState<ClipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const reload = useCallback(async () => {
    setItems(await getItems());
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  // 后台捕获写入 storage 时,面板实时刷新。
  useEffect(() => {
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && changes[CLIP_ITEMS_KEY]) void reload();
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, [reload]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter(
      (it) =>
        (filter === "all" || it.type === filter) &&
        (!q || (it.type === "text" && (it.text ?? "").toLowerCase().includes(q)) || it.source.toLowerCase().includes(q)),
    );
    return sortForDisplay(filtered, Date.now());
  }, [items, query, filter]);

  const total = groups.pinned.length + groups.today.length + groups.earlier.length;
  const FILTERS: { key: Filter; label: MessageKey }[] = [
    { key: "all", label: "clip.filterAll" },
    { key: "text", label: "clip.filterText" },
    { key: "image", label: "clip.filterImage" },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b border-line bg-surface px-3 py-2.5">
        <div className="flex items-center gap-2 rounded-lg border border-line bg-ground px-2.5 py-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("clip.searchPlaceholder")}
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
          />
        </div>
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                filter === f.key ? "border-transparent bg-accent-soft text-accent-ink" : "border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              {t(f.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading ? (
          <Loading />
        ) : total === 0 ? (
          <p className="p-8 text-center text-muted">{items.length === 0 ? t("clip.empty") : t("clip.noMatch")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {([
              ["clip.groupPinned", groups.pinned],
              ["clip.groupToday", groups.today],
              ["clip.groupEarlier", groups.earlier],
            ] as [MessageKey, ClipItem[]][]).map(([label, arr]) =>
              arr.length === 0 ? null : (
                <div key={label} className="flex flex-col gap-2">
                  <p className="px-0.5 text-[11px] font-bold uppercase tracking-wide text-muted">{t(label)}</p>
                  {arr.map((it) => (
                    <Card key={it.id} it={it} t={t} />
                  ))}
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
