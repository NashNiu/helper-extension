import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError } from "./http";

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

function mockFetch(status: number, body: unknown) {
  (globalThis as any).fetch = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
}

describe("apiFetch", () => {
  it("attaches Bearer token when present", async () => {
    store["helper.auth.token"] = "tok123";
    mockFetch(200, { id: 1 });
    await apiFetch("/api/x");
    const init = (globalThis as any).fetch.mock.calls[0][1];
    expect(init.headers.Authorization).toBe("Bearer tok123");
  });

  it("sends json body with content-type", async () => {
    mockFetch(200, {});
    await apiFetch("/api/x", { method: "POST", json: { a: 1 } });
    const init = (globalThis as any).fetch.mock.calls[0][1];
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("throws ApiError with backend message on 4xx", async () => {
    mockFetch(400, { message: "参数错误", statusCode: 400 });
    await expect(apiFetch("/api/x")).rejects.toMatchObject({
      status: 400,
      message: "参数错误",
    });
  });

  it("clears token on 401", async () => {
    store["helper.auth.token"] = "tok";
    mockFetch(401, { message: "unauthorized" });
    await expect(apiFetch("/api/x")).rejects.toBeInstanceOf(ApiError);
    expect(store["helper.auth.token"]).toBeUndefined();
  });
});
