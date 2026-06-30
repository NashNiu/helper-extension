import { useEffect, useRef, useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { classifyApi } from "../shared/api/classify";
import { reminderApi } from "../shared/api/reminder";
import { timerApi } from "../shared/api/timer";
import { todoApi } from "../shared/api/todo";
import { ApiError } from "../shared/http";
import { routeQuickAdd } from "./quickAdd";

const LABELS: Record<string, string> = { reminder: "提醒", timer: "计时", todo: "待办" };

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
}: {
  onAdded: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const [hintKind, setHintKind] = useState<HintKind>("ok");
  const inputRef = useRef<HTMLInputElement>(null);
  const submittedRef = useRef(false);

  async function submit() {
    const input = text.trim();
    if (!input) return;
    submittedRef.current = true;
    setBusy(true);
    setHint("");
    try {
      const handled = await routeQuickAdd(input, {
        classify: classifyApi.classify,
        createReminder: reminderApi.create,
        createTimer: timerApi.createFromText,
        createTodo: todoApi.create,
      });
      if (handled.length === 0) {
        setHintKind("warn");
        setHint("未识别为提醒 / 计时 / 待办，换个说法试试");
      } else {
        setText("");
        setHintKind("ok");
        setHint(`已添加：${handled.map((h) => LABELS[h]).join("、")}`);
        onAdded();
      }
    } catch (e) {
      setHintKind("error");
      if (e instanceof ApiError && e.status === 0) {
        setHint("网络不给力，请检查连接后重试");
      } else {
        setHint("没能添加成功，请稍后再试");
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
          placeholder="一句话添加…"
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
              添加
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
