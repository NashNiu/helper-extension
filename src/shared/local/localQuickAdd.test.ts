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
    // 尾部两个 undefined 是 remind_at 与 category_id：没选分类时就是「不带」。
    expect(todoApi.create).toHaveBeenCalledWith("买牛奶", undefined, undefined);
  });
  it("creates a todo", async () => {
    await deps.createTodo("买牛奶");
    expect(todoApi.create).toHaveBeenCalledWith("买牛奶", undefined, undefined);
  });
});

describe("makeLocalQuickAddDeps 带分类", () => {
  // 面板上选中某个分类时，一句话添加出来的待办应该落进那个分类里。
  it("createTodo 把选中的分类带上", async () => {
    const d = makeLocalQuickAddDeps(() => NOW, 7);
    await d.createTodo("买牛奶");
    expect(todoApi.create).toHaveBeenCalledWith("买牛奶", undefined, 7);
  });

  // 解析不出时间的「提醒」会兜底成待办，这条兜底路径也该进同一个分类。
  it("提醒兜底成待办时同样带分类", async () => {
    const d = makeLocalQuickAddDeps(() => NOW, 7);
    await d.createReminder("买牛奶");
    expect(todoApi.create).toHaveBeenCalledWith("买牛奶", undefined, 7);
  });

  // 提醒本身没有分类概念，不该因为面板上选了分类就改变解析结果。
  it("分类不影响能解析出时间的提醒", async () => {
    const d = makeLocalQuickAddDeps(() => NOW, 7);
    await d.createReminder("明天九点开会");
    expect(reminderApi.createManual).toHaveBeenCalledTimes(1);
    expect(todoApi.create).not.toHaveBeenCalled();
  });
});
