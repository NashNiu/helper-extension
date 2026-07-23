import type { QuickAddDeps } from "../../features/quickAdd";
import type { AssistantType } from "../api/classify";
import { analyzeWithDeepseek, type AnalyzedItem } from "./deepseek";
import { reminderApi } from "../api/reminder";
import { todoApi } from "../api/todo";

/**
 * BYOK(自带 Key)一句话添加依赖:一次 DeepSeek 调用得到全部意图并缓存,
 * 随后按 QuickAddDeps 契约(routeQuickAdd 先 classify 再对每个 type 调 createX,入参同一 input)
 * 复用免费档的本地写入器落库。任一 AI 失败抛 AiError,由上层回退本地解析。
 */
export function makeByokQuickAddDeps(
  key: string,
  now: () => Date = () => new Date(),
): QuickAddDeps {
  let cache: { input: string; items: AnalyzedItem[] } | null = null;
  async function ensure(input: string): Promise<AnalyzedItem[]> {
    if (cache && cache.input === input) return cache.items;
    const items = await analyzeWithDeepseek(input, now(), key);
    cache = { input, items };
    return items;
  }
  return {
    classify: async (input: string) => {
      const items = await ensure(input);
      return { types: items.map((it) => it.type) as AssistantType[] };
    },
    createReminder: async (input: string) => {
      const items = await ensure(input);
      const it = items.find((x) => x.type === "reminder");
      if (it && it.type === "reminder") {
        await reminderApi.createManual({ message: it.message, trigger_at: it.trigger_at });
      }
    },
    createTodo: async (input: string) => {
      const items = await ensure(input);
      const it = items.find((x) => x.type === "todo");
      await todoApi.create(it && it.type === "todo" ? it.content : input);
    },
  };
}
