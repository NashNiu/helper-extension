import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { useT } from "../i18n/react";
import type { MessageKey } from "../i18n/messages/en";
import { ApiError } from "../shared/http";
import { makeLocalQuickAddDeps } from "../shared/local/localQuickAdd";
import { makeByokQuickAddDeps } from "../shared/ai/byokQuickAdd";
import { getKey, DEEPSEEK_KEY_STORAGE_KEY } from "../shared/ai/apiKey";
import { routeQuickAdd, routeQuickAddWithFallback, type QuickAddDeps } from "./quickAdd";
import { parseDailyReminder } from "../shared/local/parse";
import { localDailyReminders } from "../shared/local/dailyReminders";

type HintKind = "ok" | "warn" | "error";

const HINT_STYLES: Record<HintKind, string> = {
  ok: "bg-accent-soft text-accent-ink",
  warn: "bg-black/[0.04] text-muted",
  error: "bg-danger/10 text-danger font-medium",
};

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16.5v.01" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M5 12.5l4.5 4.5L19 6.5" />
    </svg>
  );
}

export function QuickAddBar({ onAdded }: { onAdded: () => void }) {
  const t = useT();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const [hintKind, setHintKind] = useState<HintKind>("ok");
  const [key, setKeyState] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const submittedRef = useRef(false);

  // 读取 DeepSeek Key,并在设置页保存/清除时(storage 变更)自动刷新。
  useEffect(() => {
    let alive = true;
    void getKey().then((k) => { if (alive) setKeyState(k); });
    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === "local" && changes[DEEPSEEK_KEY_STORAGE_KEY]) {
        setKeyState((changes[DEEPSEEK_KEY_STORAGE_KEY].newValue as string | undefined) ?? "");
      }
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => { alive = false; chrome.storage.onChanged.removeListener(onChanged); };
  }, []);

  const localDeps = useMemo<QuickAddDeps>(() => makeLocalQuickAddDeps(), []);
  const aiDeps = useMemo<QuickAddDeps | null>(
    () => (key ? makeByokQuickAddDeps(key) : null),
    [key],
  );

  async function submit() {
    const input = text.trim();
    if (!input) return;
    submittedRef.current = true;
    setBusy(true);
    setHint("");
    try {
      // 「每天/每晚/每日 + 时刻」是确定性规则,前置识别,BYOK/本地一致,且无需 AI。
      const daily = parseDailyReminder(input);
      if (daily) {
        await localDailyReminders.create(daily);
        setText("");
        setHintKind("ok");
        setHint(t("quickAdd.addedDaily"));
        onAdded();
        return;
      }

      const { handled, usedFallback } = aiDeps
        ? await routeQuickAddWithFallback(input, aiDeps, localDeps)
        : { handled: await routeQuickAdd(input, localDeps), usedFallback: false };
      if (handled.length === 0) {
        setHintKind("warn");
        setHint(t("quickAdd.unrecognized"));
      } else {
        setText("");
        if (usedFallback) {
          setHintKind("warn");
          setHint(t("quickAdd.aiFallback"));
        } else {
          setHintKind("ok");
          const items = handled.map((h) => t(("tab." + h) as MessageKey)).join(t("common.listSep"));
          setHint(t("quickAdd.added", { items }));
        }
        onAdded();
      }
    } catch (e) {
      setHintKind("error");
      if (e instanceof ApiError && e.status === 0) {
        setHint(t("quickAdd.errNetwork"));
      } else if (e instanceof ApiError && e.status === 429) {
        setHint(t("quickAdd.errRateLimited"));
      } else {
        setHint(t("quickAdd.errGeneric"));
      }
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!hint) return;
    const ms = hintKind === "error" ? 6000 : 3000;
    const id = window.setTimeout(() => setHint(""), ms);
    return () => clearTimeout(id);
  }, [hint, hintKind]);

  useEffect(() => {
    if (!busy && submittedRef.current) {
      submittedRef.current = false;
      inputRef.current?.focus();
    }
  }, [busy]);

  return (
    <header className="border-b border-line bg-ground p-2">
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          className="min-w-0"
          placeholder={t("quickAdd.placeholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          disabled={busy}
        />
        <Button
          onClick={submit}
          disabled={busy || !text.trim()}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap"
        >
          {busy ? "…" : (
            <>
              <PlusIcon />
              {t("quickAdd.add")}
            </>
          )}
        </Button>
      </div>
      {hint && (
        <p
          role={hintKind === "error" ? "alert" : "status"}
          className={`mt-1.5 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs ${HINT_STYLES[hintKind]}`}
        >
          {hintKind === "error" && <AlertIcon />}
          {hintKind === "ok" && <CheckIcon />}
          <span className="min-w-0">{hint}</span>
        </p>
      )}
    </header>
  );
}
