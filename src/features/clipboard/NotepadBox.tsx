import { useCallback, useEffect, useRef, useState } from "react";
import { getNote, saveNote, NOTEPAD_KEY, NOTE_MAX_CHARS } from "../../shared/notepadStore";
import { addItem } from "../../shared/clipboardStore";
import { makeTextItem } from "../../shared/clipboardMessage";
import { useT } from "../../i18n/react";

type Mode = "collapsed" | "compact" | "expanded";

const iconBtn =
  "flex h-[24px] w-[24px] items-center justify-center rounded-md text-muted transition hover:bg-black/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

function fmtTime(ms: number): string {
  const d = new Date(ms);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

function NoteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
function ExpandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}
function ShrinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
    </svg>
  );
}
function ChevronIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}
function AddToClipboardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      <path d="M15 12v6M12 15h6" />
    </svg>
  );
}

export function NotepadBox({ onAdded }: { onAdded?: () => void }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>("compact");
  const [content, setContent] = useState("");
  const [savedAt, setSavedAt] = useState(0);
  const contentRef = useRef("");        // 镜像最新内容,供卸载时 flush
  const focusedRef = useRef(false);     // 是否正在输入,决定是否接受外部同步
  const pendingRef = useRef(false);     // 是否有未落盘改动
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 初始加载
  useEffect(() => {
    void getNote().then((n) => {
      setContent(n.content);
      contentRef.current = n.content;
      setSavedAt(n.updatedAt);
    }).catch(() => {});
  }, []);

  const flush = useCallback(async (text: string) => {
    try {
      const saved = await saveNote(text, Date.now());
      pendingRef.current = false;
      setSavedAt(saved.updatedAt);
    } catch {
      /* keep last-good savedAt; a later change will retry */
    }
  }, []);

  const onChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value.slice(0, NOTE_MAX_CHARS);
    setContent(next);
    contentRef.current = next;
    pendingRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void flush(next); }, 500);
  }, [flush]);

  const addToClipboard = useCallback(async () => {
    const current = contentRef.current;
    if (!current.trim()) return;
    try {
      await addItem(makeTextItem({ text: current, source: "manual", id: crypto.randomUUID(), createdAt: Date.now() }));
      // 清空记事本:先取消待写防抖,再落盘空串
      if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
      pendingRef.current = false;
      setContent("");
      contentRef.current = "";
      const saved = await saveNote("", Date.now());
      setSavedAt(saved.updatedAt);
      onAdded?.();
    } catch {
      /* 失败则保留内容,用户可重试 */
    }
  }, [onAdded]);

  // 卸载:清计时器;有未落盘改动则立即写一次
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (pendingRef.current) void saveNote(contentRef.current, Date.now()).catch(() => {});
    };
  }, []);

  // 跨窗口同步:未聚焦时才用外部新值刷新,避免打字被覆盖
  useEffect(() => {
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local" || !changes[NOTEPAD_KEY]) return;
      if (focusedRef.current) return;
      if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
      pendingRef.current = false;
      const v = changes[NOTEPAD_KEY].newValue as { content?: string; updatedAt?: number } | undefined;
      const c = typeof v?.content === "string" ? v.content : "";
      setContent(c);
      contentRef.current = c;
      setSavedAt(typeof v?.updatedAt === "number" ? v.updatedAt : 0);
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  // 放大时自动聚焦
  useEffect(() => {
    if (mode === "expanded") taRef.current?.focus();
  }, [mode]);

  const charCount = content.length;
  const savedLabel = savedAt ? `${t("notepad.saved")} · ${fmtTime(savedAt)}` : "";

  // 折叠态:仅一行标题,点开回到紧凑态
  if (mode === "collapsed") {
    return (
      <div className="border-b border-line bg-surface px-3 py-2">
        <button
          type="button"
          onClick={() => setMode("compact")}
          className="flex w-full items-center gap-2 text-xs font-semibold text-muted transition hover:text-ink"
        >
          <NoteIcon />
          <span>{t("notepad.title")}</span>
          <ChevronIcon className="ml-auto rotate-180" />
        </button>
      </div>
    );
  }

  const editor = (
    <>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-accent-ink">
          <NoteIcon />
          {t("notepad.title")}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => void addToClipboard()}
            disabled={!content.trim()}
            title={t("notepad.addToClipboard")}
            aria-label={t("notepad.addToClipboard")}
            className={`${iconBtn} disabled:opacity-40`}
          >
            <AddToClipboardIcon />
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "expanded" ? "compact" : "expanded")}
            title={mode === "expanded" ? t("notepad.collapse") : t("notepad.expand")}
            aria-label={mode === "expanded" ? t("notepad.collapse") : t("notepad.expand")}
            className={iconBtn}
          >
            {mode === "expanded" ? <ShrinkIcon /> : <ExpandIcon />}
          </button>
          {mode === "compact" && (
            <button
              type="button"
              onClick={() => setMode("collapsed")}
              title={t("notepad.toggle")}
              aria-label={t("notepad.toggle")}
              className={iconBtn}
            >
              <ChevronIcon />
            </button>
          )}
        </div>
      </div>
      <textarea
        ref={taRef}
        value={content}
        onChange={onChange}
        onFocus={() => { focusedRef.current = true; }}
        onBlur={() => { focusedRef.current = false; }}
        placeholder={t("notepad.placeholder")}
        className={`w-full resize-none bg-transparent text-sm leading-relaxed text-ink outline-none placeholder:text-muted ${
          mode === "expanded" ? "flex-1" : "h-[64px]"
        }`}
      />
      <div className="mt-1.5 flex items-center justify-between border-t border-line pt-1.5 text-[11px] text-muted">
        <span className="text-accent-ink">{savedLabel}</span>
        <span className="tabular-nums">{t("notepad.charCount", { n: charCount })}</span>
      </div>
    </>
  );

  // 放大态:绝对定位铺满整个剪贴板页
  if (mode === "expanded") {
    return (
      <div className="absolute inset-0 z-10 flex flex-col bg-ground p-3">
        <div className="flex flex-1 flex-col rounded-xl border border-line bg-surface p-3">
          {editor}
        </div>
      </div>
    );
  }

  // 紧凑态(默认)
  return (
    <div className="border-b border-line bg-surface px-3 py-2.5">
      <div className="rounded-xl border border-line bg-ground p-2.5">
        {editor}
      </div>
    </div>
  );
}
