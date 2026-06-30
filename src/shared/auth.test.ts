import { beforeEach, expect, it, vi } from "vitest";
import { login, logout, hasToken } from "./auth";

const store: Record<string, unknown> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: store[key] })),
        set: vi.fn(async (o: any) => Object.assign(store, o)),
        remove: vi.fn(async (key: string) => {
          delete store[key];
        }),
      },
    },
  };
});

it("login stores token and returns user", async () => {
  (globalThis as any).fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ access_token: "T", user: { id: 1, username: "u", email: "e" } }),
  }));
  const user = await login("u", "p");
  expect(user.username).toBe("u");
  expect(store["helper.auth.token"]).toBe("T");
  expect(await hasToken()).toBe(true);
});

it("logout clears token", async () => {
  store["helper.auth.token"] = "T";
  await logout();
  expect(await hasToken()).toBe(false);
});
