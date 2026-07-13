import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getItems,
  sortForDisplay,
  pinItem,
  unpinItem,
  removeItem,
  addItem,
  CLIP_ITEMS_KEY,
  MAX_IMAGE_BYTES,
  type ClipItem,
} from "../../shared/clipboardStore";
import { makeImageItem, makeTextItem } from "../../shared/clipboardMessage";
import { Loading } from "../../components/Loading";
import { useT } from "../../i18n/react";
import type { MessageKey } from "../../i18n/messages/en";
import { NotepadBox } from "./NotepadBox";

type Filter = "all" | "text" | "image";

// Module-scope: avoids reallocation each render
const FILTERS: { key: Filter; label: MessageKey }[] = [
  { key: "all", label: "clip.filterAll" },
  { key: "text", label: "clip.filterText" },
  { key: "image", label: "clip.filterImage" },
];

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

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
function PinOutlineIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 17v5" />
      <path d="M9 10.76V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6.76a2 2 0 0 0 .59 1.42L18 14H6l2.41-1.82A2 2 0 0 0 9 10.76Z" />
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

const iconBtn = "flex h-[26px] w-[26px] items-center justify-center rounded-md text-muted transition hover:bg-black/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
const iconBtnDanger = "flex h-[26px] w-[26px] items-center justify-center rounded-md text-muted transition hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

function Card({
  it,
  t,
  onCopy,
  onPin,
  onDelete,
}: {
  it: ClipItem;
  t: (k: MessageKey, p?: Record<string, string | number>) => string;
  onCopy: (it: ClipItem) => void;
  onPin: (it: ClipItem) => void;
  onDelete: (it: ClipItem) => void;
}) {
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
      <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 self-center">
        <button type="button" onClick={() => onCopy(it)} title={t("clip.copyTitle")} aria-label={t("clip.copyTitle")} className={iconBtn}>
          <CopyIcon />
        </button>
        <button type="button" onClick={() => onPin(it)} title={it.pinned ? t("clip.unpinTitle") : t("clip.pinTitle")} aria-label={it.pinned ? t("clip.unpinTitle") : t("clip.pinTitle")} className={`${iconBtn} ${it.pinned ? "text-accent" : ""}`}>
          <PinOutlineIcon />
        </button>
        <button type="button" onClick={() => onDelete(it)} title={t("clip.deleteTitle")} aria-label={t("clip.deleteTitle")} className={iconBtnDanger}>
          <TrashIcon />
        </button>
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
  const [toast, setToast] = useState("");

  const reload = useCallback(async () => {
    setItems(await getItems());
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  // Live refresh when background captures write to storage
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

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(""), 1400);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const onCopy = useCallback(
    async (it: ClipItem) => {
      try {
        if (it.type === "image" && it.dataUrl) {
          const blob = await (await fetch(it.dataUrl)).blob();
          await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
          flash(t("clip.copiedImage"));
        } else {
          await navigator.clipboard.writeText(it.text ?? "");
          flash(t("clip.copied"));
        }
      } catch {
        flash(t("clip.copyFailed"));
      }
    },
    [flash, t],
  );

  const onPin = useCallback(async (it: ClipItem) => {
    try {
      setItems(it.pinned ? await unpinItem(it.id) : await pinItem(it.id));
    } catch {
      flash(t("clip.actionFailed"));
    }
  }, [flash, t]);

  const onDelete = useCallback(async (it: ClipItem) => {
    try {
      setItems(await removeItem(it.id));
    } catch {
      flash(t("clip.actionFailed"));
    }
  }, [flash, t]);

  // Paste zone: prefer navigator.clipboard.read (needs clipboardRead perm + focus); fallback to error toast.
  const onPasteZone = useCallback(async () => {
    try {
      const clipItems = await navigator.clipboard.read();
      let saved = false;
      for (const ci of clipItems) {
        const imgType = ci.types.find((ty) => ty.startsWith("image/"));
        if (imgType) {
          const blob = await ci.getType(imgType);
          if (blob.size > MAX_IMAGE_BYTES) {
            flash(t("clip.imageTooLarge"));
            return;
          }
          const dataUrl = await new Promise<string>((res, rej) => {
            const fr = new FileReader();
            fr.onload = () => res(fr.result as string);
            fr.onerror = rej;
            fr.readAsDataURL(blob);
          });
          const dims = await new Promise<{ w: number; h: number }>((res) => {
            const im = new Image();
            im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
            im.onerror = () => res({ w: 0, h: 0 });
            im.src = dataUrl;
          });
          setItems(await addItem(makeImageItem({ dataUrl, bytes: blob.size, w: dims.w, h: dims.h, source: "manual", id: crypto.randomUUID(), createdAt: Date.now() })));
          flash(t("clip.saved"));
          saved = true;
          break;
        }
        if (ci.types.includes("text/plain")) {
          const blob = await ci.getType("text/plain");
          const text = (await blob.text()).trim();
          if (text) {
            setItems(await addItem(makeTextItem({ text, source: "manual", id: crypto.randomUUID(), createdAt: Date.now() })));
            flash(t("clip.saved"));
            saved = true;
          }
          break;
        }
      }
      if (!saved) flash(t("clip.readFailed"));
    } catch {
      flash(t("clip.readFailed"));
    }
  }, [flash, t]);

  return (
    <div className="relative flex h-full flex-col">
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
            aria-label={t("clip.searchPlaceholder")}
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
          />
        </div>
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              type="button"
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

      <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2">
        <button
          type="button"
          onClick={onPasteZone}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-line py-2 text-xs text-muted transition hover:border-accent hover:text-accent-ink"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="8" y="2" width="8" height="4" rx="1" />
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <path d="M12 11v6M9 14h6" />
          </svg>
          {t("clip.addFromClipboard")}
        </button>
      </div>

      <NotepadBox />

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
                    <Card key={it.id} it={it} t={t} onCopy={onCopy} onPin={onPin} onDelete={onDelete} />
                  ))}
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {toast && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
