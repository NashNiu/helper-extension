import { classify, parseReminder, parseTimer } from "./parse";
import { reminderApi } from "../api/reminder";
import { startTimer } from "../timerControl";
import { todoApi } from "../api/todo";

/**
 * 未登录(免费)态的一句话添加依赖:纯本地规则解析,零后端 AI 调用。
 * 结构与 features/quickAdd.ts 的 QuickAddDeps 兼容。
 */
export function makeLocalQuickAddDeps(now: () => Date = () => new Date()) {
  return {
    classify: async (input: string) => classify(input, now()),
    createReminder: async (input: string) => {
      const parsed = parseReminder(input, now());
      if (parsed) await reminderApi.createManual(parsed);
      else await todoApi.create(input); // 兜底:解析不出时间就当待办,永不报错
    },
    createTimer: async (input: string) => {
      const parsed = parseTimer(input);
      if (parsed) await startTimer(0, parsed.name, parsed.duration_seconds);
      else await todoApi.create(input);
    },
    createTodo: async (content: string) => {
      await todoApi.create(content);
    },
  };
}
