import { useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { ApiError } from "../shared/http";

const WEB_URL = "https://helper-frontend-production.up.railway.app/register";

export function LoginView({ onLogin }: { onLogin: (id: string, pw: string) => Promise<void> }) {
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
      setErr(e instanceof ApiError ? e.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col justify-center gap-3 bg-ground p-6">
      <h1 className="text-lg font-semibold text-ink">登录 Helper</h1>
      <Input placeholder="用户名或邮箱" value={id} onChange={(e) => setId(e.target.value)} />
      <Input
        type="password"
        placeholder="密码"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      {err && <p className="text-sm text-danger">{err}</p>}
      <Button onClick={submit} disabled={busy || !id || !pw} className="w-full">
        {busy ? "登录中…" : "登录"}
      </Button>
      <a
        href={WEB_URL}
        target="_blank"
        rel="noreferrer"
        className="text-center text-xs text-muted hover:text-accent-ink transition"
      >
        没有账号？去网页版注册
      </a>
    </div>
  );
}
