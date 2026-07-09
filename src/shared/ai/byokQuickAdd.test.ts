import { describe, expect, it, vi, beforeEach } from "vitest";
import { AiError } from "./deepseek";

const analyzeMock = vi.fn();
const createManual = vi.fn(async () => {});
const startTimer = vi.fn(async () => {});
const todoCreate = vi.fn(async () => {});

vi.mock("./deepseek", async () => {
  const actual = await vi.importActual<typeof import("./deepseek")>("./deepseek");
  return { ...actual, analyzeWithDeepseek: (...args: any[]) => (analyzeMock as any)(...args) };
});
vi.mock("../api/reminder", () => ({ reminderApi: { createManual: (...args: any[]) => (createManual as any)(...args) } }));
vi.mock("../timerControl", () => ({ startTimer: (...args: any[]) => (startTimer as any)(...args) }));
vi.mock("../api/todo", () => ({ todoApi: { create: (...args: any[]) => (todoCreate as any)(...args) } }));

import { makeByokQuickAddDeps } from "./byokQuickAdd";

const NOW = new Date(2026, 0, 1, 8, 0, 0);
const now = () => NOW;

describe("makeByokQuickAddDeps", () => {
  beforeEach(() => { analyzeMock.mockReset(); createManual.mockReset(); startTimer.mockReset(); todoCreate.mockReset(); });

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
    expect(todoCreate).toHaveBeenCalledWith("买菜");
  });

  it("routes a timer item to startTimer", async () => {
    analyzeMock.mockResolvedValue([{ type: "timer", name: "复习", duration_seconds: 1500 }]);
    const deps = makeByokQuickAddDeps("k", now);
    await deps.classify("复习计时25分钟");
    await deps.createTimer("复习计时25分钟");
    expect(startTimer).toHaveBeenCalledWith(0, "复习", 1500);
  });

  it("propagates AiError from classify", async () => {
    analyzeMock.mockRejectedValue(new AiError("auth"));
    const deps = makeByokQuickAddDeps("k", now);
    await expect(deps.classify("x")).rejects.toBeInstanceOf(AiError);
  });
});
