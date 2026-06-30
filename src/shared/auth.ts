import { apiFetch } from "./http";
import { TOKEN_KEY } from "./config";
import { storageGet, storageRemove, storageSet } from "./storage";

export interface AuthUser {
  id: number;
  username: string;
  email: string;
}

interface LoginResult {
  access_token: string;
  user: AuthUser;
}

export async function login(identifier: string, password: string): Promise<AuthUser> {
  const res = await apiFetch<LoginResult>("/api/auth/login", {
    method: "POST",
    json: { identifier, password },
  });
  await storageSet(TOKEN_KEY, res.access_token);
  return res.user;
}

export async function logout(): Promise<void> {
  await storageRemove(TOKEN_KEY);
}

export async function hasToken(): Promise<boolean> {
  return (await storageGet<string>(TOKEN_KEY)) !== null;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!(await hasToken())) return null;
  try {
    return await apiFetch<AuthUser>("/api/auth/me");
  } catch {
    return null;
  }
}
