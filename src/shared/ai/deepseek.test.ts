import { describe, expect, it } from "vitest";
import { analyzeWithDeepseek, validateKey, AiError } from "./deepseek";

// Thursday 2026-01-01 08:00 local — same fixed NOW as the parser tests.
const NOW = new Date(2026, 0, 1, 8, 0, 0);

function res(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}
function chat(contentObj: unknown, status = 200): Response {
  return res({ choices: [{ message: { content: JSON.stringify(contentObj) } }] }, status);
}
const fetchOk = (contentObj: unknown): typeof fetch =>
  (async () => chat(contentObj)) as unknown as typeof fetch;

describe("analyzeWithDeepseek", () => {
  it("parses a single reminder and normalizes trigger_at to UTC ISO", async () => {
    const items = await analyzeWithDeepseek(
      "交房租", NOW, "k",
      fetchOk({ items: [{ type: "reminder", message: "交房租", trigger_at: "2026-07-08T09:00:00+08:00" }] }),
    );
    expect(items).toEqual([{ type: "reminder", message: "交房租", trigger_at: "2026-07-08T01:00:00.000Z" }]);
  });

  it("parses multiple distinct intents", async () => {
    const items = await analyzeWithDeepseek(
      "提醒交房租，记个待办买菜", NOW, "k",
      fetchOk({ items: [
        { type: "reminder", message: "交房租", trigger_at: "2026-07-08T09:00:00+08:00" },
        { type: "todo", content: "买菜" },
      ] }),
    );
    expect(items.map((i) => i.type)).toEqual(["reminder", "todo"]);
  });

  it("keeps only the first item of a repeated type", async () => {
    const items = await analyzeWithDeepseek(
      "x", NOW, "k",
      fetchOk({ items: [{ type: "todo", content: "a" }, { type: "todo", content: "b" }] }),
    );
    expect(items).toEqual([{ type: "todo", content: "a" }]);
  });

  it("drops invalid items (past reminder, non-positive duration)", async () => {
    const items = await analyzeWithDeepseek(
      "x", NOW, "k",
      fetchOk({ items: [
        { type: "reminder", message: "past", trigger_at: "2020-01-01T00:00:00+08:00" },
        { type: "timer", name: "t", duration_seconds: 0 },
      ] }),
    );
    expect(items).toEqual([]);
  });

  it("returns [] for an empty items array (unrecognized, not an error)", async () => {
    const items = await analyzeWithDeepseek("hi", NOW, "k", fetchOk({ items: [] }));
    expect(items).toEqual([]);
  });

  it("maps 401 to AiError auth", async () => {
    const f = (async () => chat({}, 401)) as unknown as typeof fetch;
    await expect(analyzeWithDeepseek("x", NOW, "k", f)).rejects.toMatchObject({ kind: "auth" });
  });

  it("maps 429 to AiError rate", async () => {
    const f = (async () => chat({}, 429)) as unknown as typeof fetch;
    await expect(analyzeWithDeepseek("x", NOW, "k", f)).rejects.toMatchObject({ kind: "rate" });
  });

  it("maps a thrown fetch to AiError network", async () => {
    const f = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    await expect(analyzeWithDeepseek("x", NOW, "k", f)).rejects.toMatchObject({ kind: "network" });
  });

  it("maps non-JSON content to AiError bad_output", async () => {
    const f = (async () => res({ choices: [{ message: { content: "not json" } }] })) as unknown as typeof fetch;
    await expect(analyzeWithDeepseek("x", NOW, "k", f)).rejects.toMatchObject({ kind: "bad_output" });
  });

  it("is an AiError instance", async () => {
    const f = (async () => chat({}, 401)) as unknown as typeof fetch;
    await expect(analyzeWithDeepseek("x", NOW, "k", f)).rejects.toBeInstanceOf(AiError);
  });
});

describe("validateKey", () => {
  it("valid on 2xx", async () => {
    expect(await validateKey("k", (async () => res({}, 200)) as unknown as typeof fetch)).toBe("valid");
  });
  it("invalid on 401", async () => {
    expect(await validateKey("k", (async () => res({}, 401)) as unknown as typeof fetch)).toBe("invalid");
  });
  it("network_error on 429", async () => {
    expect(await validateKey("k", (async () => res({}, 429)) as unknown as typeof fetch)).toBe("network_error");
  });
  it("network_error on thrown fetch", async () => {
    expect(await validateKey("k", (async () => { throw new Error("x"); }) as unknown as typeof fetch)).toBe("network_error");
  });
});
