import { API_BASE, TOKEN_KEY } from "./config";
import { storageGet, storageRemove } from "./storage";

export const UNAUTHORIZED_EVENT = "helper:auth:unauthorized";

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function extractMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const m = (data as { message?: unknown }).message;
    if (Array.isArray(m)) return m.filter((x) => typeof x === "string").join("；") || fallback;
    if (typeof m === "string" && m.trim()) return m;
  }
  return fallback;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const token = await storageGet<string>(TOKEN_KEY);
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;

  let body = init.body;
  if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers, body });
  } catch {
    throw new ApiError("网络请求失败，请检查连接后重试", 0);
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* 无 body（如 204）*/
  }

  if (!res.ok) {
    if (res.status === 401) {
      await storageRemove(TOKEN_KEY);
      try {
        (self as unknown as EventTarget).dispatchEvent(new Event(UNAUTHORIZED_EVENT));
      } catch {
        /* SW 中无 dispatchEvent 时忽略 */
      }
    }
    const fallback = res.status >= 500 ? "服务器开了个小差，请稍后再试" : "请求失败";
    throw new ApiError(extractMessage(data, fallback), res.status);
  }

  return data as T;
}
