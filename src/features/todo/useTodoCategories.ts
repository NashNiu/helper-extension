import { useCallback, useEffect, useState } from "react";
import { todoCategoryApi, type TodoCategory } from "../../shared/api/todoCategory";

/**
 * 待办分类列表 + 增删改。
 *
 * 状态放在 App 里(由这个 hook 持有),因为 QuickAddBar 与 TodoView 是兄弟节点:
 * 前者要拿当前选中的分类作为新建默认值,后者要拿分类名渲染标签。
 *
 * `refreshKey` 变化时重新拉取——登录态切换会把数据源从本地换成后端,分类列表也得跟着换。
 */
export function useTodoCategories(refreshKey: number) {
  const [categories, setCategories] = useState<TodoCategory[]>([]);

  const reload = useCallback(async () => {
    try {
      setCategories(await todoCategoryApi.list());
    } catch {
      // 分类拉不到不该让整个待办页变成错误态——待办本身还能用,
      // 只是筛选栏空着。真正的失败提示留给用户主动做的增删改。
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  const create = useCallback(async (name: string) => {
    const cat = await todoCategoryApi.create(name);
    setCategories((xs) => [...xs, cat]);
    return cat;
  }, []);

  const rename = useCallback(async (id: number, name: string) => {
    const cat = await todoCategoryApi.rename(id, name);
    setCategories((xs) => xs.map((c) => (c.id === id ? cat : c)));
    return cat;
  }, []);

  const remove = useCallback(async (id: number) => {
    await todoCategoryApi.remove(id);
    setCategories((xs) => xs.filter((c) => c.id !== id));
  }, []);

  return { categories, reload, create, rename, remove };
}
