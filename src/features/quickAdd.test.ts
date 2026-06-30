import { describe, expect, it, vi } from "vitest";
import { routeQuickAdd } from "./quickAdd";

describe("routeQuickAdd", () => {
  it("routes each non-finance type to its create", async () => {
    const deps = {
      classify: vi.fn(async () => ({ types: ["reminder", "todo", "finance"] as const })),
      createReminder: vi.fn(async () => {}),
      createTimer: vi.fn(async () => {}),
      createTodo: vi.fn(async () => {}),
    };
    const handled = await routeQuickAdd("明天九点开会并买牛奶", deps as any);
    expect(deps.createReminder).toHaveBeenCalledWith("明天九点开会并买牛奶");
    expect(deps.createTodo).toHaveBeenCalledWith("明天九点开会并买牛奶");
    expect(deps.createTimer).not.toHaveBeenCalled();
    expect(handled).toEqual(["reminder", "todo"]);
  });

  it("returns empty when only finance", async () => {
    const deps = {
      classify: vi.fn(async () => ({ types: ["finance"] as const })),
      createReminder: vi.fn(),
      createTimer: vi.fn(),
      createTodo: vi.fn(),
    };
    expect(await routeQuickAdd("打车 30 元", deps as any)).toEqual([]);
  });
});
