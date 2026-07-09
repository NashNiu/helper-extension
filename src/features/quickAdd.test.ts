import { describe, expect, it } from "vitest";
import { routeQuickAddWithFallback, type QuickAddDeps } from "./quickAdd";
import { AiError } from "../shared/ai/deepseek";

function deps(over: Partial<QuickAddDeps>): QuickAddDeps {
  return {
    classify: async () => ({ types: [] }),
    createReminder: async () => {},
    createTimer: async () => {},
    createTodo: async () => {},
    ...over,
  };
}

describe("routeQuickAddWithFallback", () => {
  it("uses AI result when AI succeeds", async () => {
    const ai = deps({ classify: async () => ({ types: ["todo"] }) });
    const local = deps({ classify: async () => ({ types: ["reminder"] }) });
    const r = await routeQuickAddWithFallback("x", ai, local);
    expect(r).toEqual({ handled: ["todo"], usedFallback: false });
  });

  it("falls back to local when AI throws AiError", async () => {
    const ai = deps({ classify: async () => { throw new AiError("network"); } });
    const local = deps({ classify: async () => ({ types: ["todo"] }) });
    const r = await routeQuickAddWithFallback("x", ai, local);
    expect(r).toEqual({ handled: ["todo"], usedFallback: true });
  });

  it("rethrows non-AiError errors", async () => {
    const ai = deps({ classify: async () => { throw new Error("boom"); } });
    const local = deps({});
    await expect(routeQuickAddWithFallback("x", ai, local)).rejects.toThrow("boom");
  });
});
