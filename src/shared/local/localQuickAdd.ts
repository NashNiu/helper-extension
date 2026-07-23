import { classify, parseReminder } from "./parse";
import { reminderApi } from "../api/reminder";
import { todoApi } from "../api/todo";

/**
 * 未登录(免费)态的一句话添加依赖:纯本地规则解析,零后端 AI 调用。
 * 结构与 features/quickAdd.ts 的 QuickAddDeps 兼容。一句话只产生提醒或待办。
 */
export function makeLocalQuickAddDeps(now: () => Date = () => new Date()) {
  return {
    classify: async (input: string) => classify(input, now()),
    createReminder: async (input: string) => {
      const parsed = parseReminder(input, now());
      if (parsed) await reminderApi.createManual(parsed);
      else await todoApi.create(input); // 兜底:解析不出时间就当待办,永不报错
    },
    createTodo: async (content: string) => {
      await todoApi.create(content);
    },
  };
}
