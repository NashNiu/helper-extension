import { describe, expect, it, vi, beforeEach } from "vitest";
import { AiError } from "./deepseek";

const analyzeMock = vi.fn();
const createManual = vi.fn(async () => {});
const todoCreate = vi.fn(async () => {});

vi.mock("./deepseek", async () => {
  const actual = await vi.importActual<typeof import("./deepseek")>("./deepseek");
  return { ...actual, analyzeWithDeepseek: (...args: any[]) => (analyzeMock as any)(...args) };
});
vi.mock("../api/reminder", () => ({ reminderApi: { createManual: (...args: any[]) => (createManual as any)(...args) } }));
vi.mock("../api/todo", () => ({ todoApi: { create: (...args: any[]) => (todoCreate as any)(...args) } }));

import { makeByokQuickAddDeps } from "./byokQuickAdd";

const NOW = new Date(2026, 0, 1, 8, 0, 0);
const now = () => NOW;

describe("makeByokQuickAddDeps", () => {
  beforeEach(() => { analyzeMock.mockReset(); createManual.mockReset(); todoCreate.mockReset(); });

  it("calls the AI once per input and routes items to local writers", async () => {
    analyzeMock.mockResolvedValue([
      { type: "reminder", message: "交房租", trigger_at: "2026-07-08T01:00:00.000Z" },
      { type: "todo", content: "买菜" },
    ]);
    const deps = makeByokQuickAddDeps("k", now);
    const { types } = await deps.classify("提醒交房租，记个待办买菜");
    expect(types).toEqual(["reminder", "todo"]);
    await deps.createReminder("提醒交房租，记个待办买菜");
    await deps.createTodo("提醒交房租，记个待办买菜");
    expect(analyzeMock).toHaveBeenCalledTimes(1);
    expect(createManual).toHaveBeenCalledWith({ message: "交房租", trigger_at: "2026-07-08T01:00:00.000Z" });
    // 尾部两个 undefined 是 remind_at 与 category_id：没选分类时就是「不带」。
    expect(todoCreate).toHaveBeenCalledWith("买菜", undefined, undefined);
  });

  it("propagates AiError from classify", async () => {
    analyzeMock.mockRejectedValue(new AiError("auth"));
    const deps = makeByokQuickAddDeps("k", now);
    await expect(deps.classify("x")).rejects.toBeInstanceOf(AiError);
  });

  // 面板上选中某个分类时，AI 路径产出的待办也要落进那个分类——
  // 否则同一句话在配了 Key 和没配 Key 时会进不同的地方。
  it("createTodo 把选中的分类带上", async () => {
    analyzeMock.mockResolvedValue([{ type: "todo", content: "买菜" }]);
    const deps = makeByokQuickAddDeps("k", now, 7);
    await deps.createTodo("记个待办买菜");
    expect(todoCreate).toHaveBeenCalledWith("买菜", undefined, 7);
  });
});
