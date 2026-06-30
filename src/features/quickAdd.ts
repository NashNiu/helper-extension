import type { AssistantType } from "../shared/api/classify";

export interface QuickAddDeps {
  classify: (input: string) => Promise<{ types: AssistantType[] }>;
  createReminder: (input: string) => Promise<unknown>;
  createTimer: (input: string) => Promise<unknown>;
  createTodo: (content: string) => Promise<unknown>;
}

export async function routeQuickAdd(
  input: string,
  deps: QuickAddDeps,
): Promise<AssistantType[]> {
  const { types } = await deps.classify(input);
  const handled: AssistantType[] = [];
  for (const t of types) {
    if (t === "reminder") {
      await deps.createReminder(input);
      handled.push(t);
    } else if (t === "timer") {
      await deps.createTimer(input);
      handled.push(t);
    } else if (t === "todo") {
      await deps.createTodo(input);
      handled.push(t);
    }
    // finance 忽略
  }
  return handled;
}
