import { useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { ApiError } from "../shared/http";
import { useT } from "../i18n/react";

const WEB_URL = "https://helper-blond.vercel.app/register";

export function LoginView({
  onLogin,
  onCancel,
}: {
  onLogin: (id: string, pw: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const t = useT();
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr("");
    setBusy(true);
    try {
      await onLogin(id.trim(), pw);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("login.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col justify-center gap-3 bg-ground p-6">
      <h1 className="text-lg font-semibold text-ink">{t("login.title")}</h1>
      <p className="-mt-1 text-xs text-muted">{t("login.subtitle")}</p>
      <Input placeholder={t("login.idPlaceholder")} value={id} onChange={(e) => setId(e.target.value)} />
      <Input
        type="password"
        placeholder={t("login.pwPlaceholder")}
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      {err && <p className="text-sm text-danger">{err}</p>}
      <Button onClick={submit} disabled={busy || !id || !pw} className="w-full">
        {busy ? t("login.submitting") : t("login.submit")}
      </Button>
      {onCancel && (
        <Button variant="ghost" onClick={onCancel} disabled={busy} className="w-full">
          {t("login.useLocal")}
        </Button>
      )}
      <a
        href={WEB_URL}
        target="_blank"
        rel="noreferrer"
        className="text-center text-xs text-muted hover:text-accent-ink transition"
      >
        {t("login.register")}
      </a>
    </div>
  );
}
