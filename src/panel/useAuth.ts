import { useCallback, useEffect, useState } from "react";
import { getCurrentUser, login, logout, type AuthUser } from "../shared/auth";
import { UNAUTHORIZED_EVENT } from "../shared/http";

type Status = "loading" | "in" | "out";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u);
      setStatus(u ? "in" : "out");
    });
    const onUnauth = () => {
      setUser(null);
      setStatus("out");
    };
    self.addEventListener(UNAUTHORIZED_EVENT, onUnauth);
    return () => self.removeEventListener(UNAUTHORIZED_EVENT, onUnauth);
  }, []);

  const signIn = useCallback(async (id: string, pw: string) => {
    const u = await login(id, pw);
    setUser(u);
    setStatus("in");
  }, []);

  const signOut = useCallback(async () => {
    await logout();
    setUser(null);
    setStatus("out");
  }, []);

  return { user, status, signIn, signOut };
}
