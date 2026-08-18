import { classify, parseReminder } from "./parse";
import { reminderApi } from "../api/reminder";
import { todoApi } from "../api/todo";

/**
 * 未登录(免费)态的一句话添加依赖:纯本地规则解析,零后端 AI 调用。
 * 结构与 features/quickAdd.ts 的 QuickAddDeps 兼容。一句话只产生提醒或待办。
 *
 * categoryId 是面板上当前选中的待办分类:产出待办时带上,提醒不受影响
 * (提醒没有分类概念)。
 */
export function makeLocalQuickAddDeps(
  now: () => Date = () => new Date(),
  categoryId?: number | null,
) {
  return {
    classify: async (input: string) => classify(input, now()),
    createReminder: async (input: string) => {
      const parsed = parseReminder(input, now());
      if (parsed) await reminderApi.createManual(parsed);
      // 兜底:解析不出时间就当待办,永不报错。这条路径产出的也是待办,同样进选中分类。
      else await todoApi.create(input, undefined, categoryId);
    },
    createTodo: async (content: string) => {
      await todoApi.create(content, undefined, categoryId);
    },
  };
}
