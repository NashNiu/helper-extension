import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { useT } from "../i18n/react";
import type { MessageKey } from "../i18n/messages/en";
import { classifyApi } from "../shared/api/classify";
import { publicAiApi } from "../shared/api/publicAi";
import { reminderApi } from "../shared/api/reminder";
import { timerApi } from "../shared/api/timer";
import { todoApi } from "../shared/api/todo";
import { startTimer } from "../shared/timerControl";
import { ApiError } from "../shared/http";
import { routeQuickAdd, type QuickAddDeps } from "./quickAdd";

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

export function QuickAddBar({
  onAdded,
  loggedIn,
}: {
  onAdded: () => void;
  loggedIn: boolean;
}) {
  const t = useT();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const [hintKind, setHintKind] = useState<HintKind>("ok");
  const inputRef = useRef<HTMLInputElement>(null);
  const submittedRef = useRef(false);

  // 登录:后端 AI 解析并落库。未登录:公开 AI 接口只解析,结果写本地。
  const deps = useMemo<QuickAddDeps>(
    () =>
      loggedIn
        ? {
            classify: classifyApi.classify,
            createReminder: reminderApi.create,
            createTimer: timerApi.createFromText,
            createTodo: todoApi.create,
          }
        : {
            classify: publicAiApi.classify,
            createReminder: async (input) => {
              const p = await publicAiApi.parseReminder(input);
              await reminderApi.createManual(p);
            },
            createTimer: async (input) => {
              const p = await publicAiApi.parseTimer(input);
              await startTimer(0, p.name, p.duration_seconds);
            },
            createTodo: todoApi.create,
          },
    [loggedIn],
  );

  async function submit() {
    const input = text.trim();
    if (!input) return;
    submittedRef.current = true;
    setBusy(true);
    setHint("");
    try {
      const handled = await routeQuickAdd(input, deps);
      if (handled.length === 0) {
        setHintKind("warn");
        setHint(t("quickAdd.unrecognized"));
      } else {
        setText("");
        setHintKind("ok");
        const items = handled.map((h) => t(("tab." + h) as MessageKey)).join(t("common.listSep"));
        setHint(t("quickAdd.added", { items }));
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

  // 提示自动消失：成功/未识别 3s，错误留长一点 6s。
  useEffect(() => {
    if (!hint) return;
    const ms = hintKind === "error" ? 6000 : 3000;
    const id = window.setTimeout(() => setHint(""), ms);
    return () => clearTimeout(id);
  }, [hint, hintKind]);

  // 一次提交结束后（busy 落回 false），把焦点送回输入框，便于连续录入。
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
