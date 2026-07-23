import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../api/reminder", () => ({ reminderApi: { createManual: vi.fn(async () => {}) } }));
vi.mock("../api/todo", () => ({ todoApi: { create: vi.fn(async () => {}) } }));

import { reminderApi } from "../api/reminder";
import { todoApi } from "../api/todo";
import { makeLocalQuickAddDeps } from "./localQuickAdd";

const NOW = new Date(2026, 0, 1, 8, 0, 0);
const deps = makeLocalQuickAddDeps(() => NOW);

beforeEach(() => vi.clearAllMocks());

describe("makeLocalQuickAddDeps", () => {
  it("classifies locally", async () => {
    expect(await deps.classify("明天九点开会")).toEqual({ types: ["reminder"] });
  });
  it("creates a local reminder with parsed time", async () => {
    await deps.createReminder("明天九点开会");
    expect(reminderApi.createManual).toHaveBeenCalledTimes(1);
    const arg = (reminderApi.createManual as any).mock.calls[0][0];
    expect(arg.message).toBe("开会");
    expect(new Date(arg.trigger_at).getHours()).toBe(9);
  });
  it("falls back unparseable reminder text to a todo", async () => {
    await deps.createReminder("买牛奶");
    expect(reminderApi.createManual).not.toHaveBeenCalled();
    expect(todoApi.create).toHaveBeenCalledWith("买牛奶");
  });
  it("creates a todo", async () => {
    await deps.createTodo("买牛奶");
    expect(todoApi.create).toHaveBeenCalledWith("买牛奶");
  });
});
