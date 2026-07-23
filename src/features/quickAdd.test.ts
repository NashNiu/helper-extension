import { describe, expect, it, vi } from "vitest";
import { routeQuickAdd, routeQuickAddWithFallback, type QuickAddDeps } from "./quickAdd";
import { AiError } from "../shared/ai/deepseek";

function deps(over: Partial<QuickAddDeps>): QuickAddDeps {
  return {
    classify: async () => ({ types: [] }),
    createReminder: async () => {},
    createTodo: async () => {},
    ...over,
  };
}

describe("routeQuickAdd", () => {
  it("routes reminder and todo to their create", async () => {
    const deps = {
      classify: vi.fn(async () => ({ types: ["reminder", "todo"] as const })),
      createReminder: vi.fn(async () => {}),
      createTodo: vi.fn(async () => {}),
    };
    const handled = await routeQuickAdd("明天九点开会并买牛奶", deps as any);
    expect(deps.createReminder).toHaveBeenCalledWith("明天九点开会并买牛奶");
    expect(deps.createTodo).toHaveBeenCalledWith("明天九点开会并买牛奶");
    expect(handled).toEqual(["reminder", "todo"]);
  });

  it("ignores timer and finance types (quick-add never creates a timer)", async () => {
    const deps = {
      classify: vi.fn(async () => ({ types: ["timer", "finance"] as const })),
      createReminder: vi.fn(),
      createTodo: vi.fn(),
    };
    expect(await routeQuickAdd("复习计时25分钟", deps as any)).toEqual([]);
    expect(deps.createReminder).not.toHaveBeenCalled();
    expect(deps.createTodo).not.toHaveBeenCalled();
  });
});

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
