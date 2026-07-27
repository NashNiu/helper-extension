import { useState } from "react";
import { localCustomTimers } from "../../shared/local/customTimers";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { useT } from "../../i18n/react";

export function CustomTimerForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const t = useT();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"countdown" | "focus">("countdown");
  const [workMin, setWorkMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [cycles, setCycles] = useState(4);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const nm = name.trim();
    const valid =
      !!nm &&
      workMin >= 1 &&
      (kind === "countdown" || (breakMin >= 1 && cycles >= 1 && cycles <= 8));
    if (!valid) {
      setErr(t("timer.invalidInput"));
      return;
    }
    setBusy(true);
    try {
      await localCustomTimers.create({
        name: nm,
        kind,
        workSeconds: Math.round(workMin) * 60,
        breakSeconds: kind === "focus" ? Math.round(breakMin) * 60 : 0,
        defaultCycles: kind === "focus" ? Math.round(cycles) : 1,
      });
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  const seg = (active: boolean) =>
    `flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
      active ? "bg-accent text-white" : "bg-black/[0.04] text-muted hover:bg-black/[0.08]"
    }`;

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <h2 className="text-lg font-semibold text-ink">{t("timer.newTimer")}</h2>

      <label className="block">
        <span className="mb-1 block text-xs text-muted">{t("timer.nameLabel")}</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("timer.namePlaceholder")} />
      </label>

      <div className="flex gap-2">
        <button type="button" className={seg(kind === "countdown")} onClick={() => setKind("countdown")}>
          {t("timer.kindCountdown")}
        </button>
        <button type="button" className={seg(kind === "focus")} onClick={() => setKind("focus")}>
          {t("timer.kindFocus")}
        </button>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs text-muted">
          {kind === "focus" ? t("timer.workLabel") : t("timer.durationLabel")}
        </span>
        <Input type="number" min={1} value={workMin} onChange={(e) => setWorkMin(Number(e.target.value))} />
      </label>

      {kind === "focus" && (
        <>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">{t("timer.breakLabel")}</span>
            <Input type="number" min={1} value={breakMin} onChange={(e) => setBreakMin(Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">{t("timer.cyclesLabel")}</span>
            <Input type="number" min={1} max={8} value={cycles} onChange={(e) => setCycles(Number(e.target.value))} />
          </label>
        </>
      )}

      {err && <p className="text-sm text-danger">{err}</p>}

      <div className="mt-auto flex gap-2">
        <Button className="flex-1" onClick={save} disabled={busy}>
          {t("action.save")}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          {t("action.cancel")}
        </Button>
      </div>
    </div>
  );
}
