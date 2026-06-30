import { useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { classifyApi } from "../shared/api/classify";
import { reminderApi } from "../shared/api/reminder";
import { timerApi } from "../shared/api/timer";
import { todoApi } from "../shared/api/todo";
import { routeQuickAdd } from "./quickAdd";

const LABELS: Record<string, string> = { reminder: "提醒", timer: "计时", todo: "待办" };

export function QuickAddBar({
  onAdded,
}: {
  onAdded: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");

  async function submit() {
    const input = text.trim();
    if (!input) return;
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
        setHint("未识别为提醒/计时/待办");
      } else {
        setText("");
        setHint(`已添加：${handled.map((h) => LABELS[h]).join("、")}`);
        onAdded();
      }
    } catch {
      setHint("添加失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="border-b border-line bg-ground p-2">
      <div className="flex items-center gap-2">
        <Input
          placeholder="一句话添加…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          disabled={busy}
        />
        <Button onClick={submit} disabled={busy || !text.trim()}>
          {busy ? "…" : "添加"}
        </Button>
      </div>
      {hint && <p className="mt-1 px-1 text-xs text-muted">{hint}</p>}
    </header>
  );
}
