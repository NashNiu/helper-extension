import type { TodoCategory } from "../api/todoCategory";
import { readList, writeList, nextId } from "./store";
import { localTodos } from "./todos";

const KEY = "helper.local.todoCategories";

// 这两个符号定义在这里而不是 api/todoCategory.ts,再由那边重新导出——与
// MAX_TODO_IMAGES 定义在 images.ts 的理由完全一样:api/todoCategory.ts 以值的方式
// 导入 localTodoCategories,反过来在这里以值的方式导入它就会闭合出一个真实的运行时循环。
// (上面的 TodoCategory 是 import type,编译后会被抹掉,不构成循环。)

/** 分类名长度上限,与后端 @Column({ length: 50 }) 一致。 */
export const MAX_CATEGORY_NAME = 50;

/**
 * 分类重名。单独一个类型是为了让 UI 能把「撞名了」和「保存失败」分开说——
 * 后端那边同一件事是 409,两者由 api/todoCategory.ts 的 isNameTakenError 收敛。
 */
export class CategoryNameTakenError extends Error {
  constructor(readonly name_: string) {
    super(`分类「${name_}」已存在`);
    this.name = "CategoryNameTakenError";
  }
}

/**
 * 校验并归一化分类名。三条规则逐条对应 backend/src/todo-category/todo-category.service.ts:
 * 去首尾空白、非空、不超过 50 字符。未登录时这里就是后端,改一边必须改另一边。
 */
function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("分类名不能为空");
  if (trimmed.length > MAX_CATEGORY_NAME) {
    throw new Error(`分类名不能超过 ${MAX_CATEGORY_NAME} 个字符`);
  }
  return trimmed;
}

/**
 * 重名检查。对应后端的唯一索引 (user_id, name),同样是大小写敏感的精确比较——
 * 本地放宽的话,同一个用户登录前后会撞上不同的约束。
 * exceptId 用于 rename:改成自己原来的名字不算冲突。
 */
function assertNameFree(list: TodoCategory[], name: string, exceptId?: number): void {
  if (list.some((c) => c.name === name && c.id !== exceptId)) {
    throw new CategoryNameTakenError(name);
  }
}

export const localTodoCategories = {
  /** 与后端 findAll 一致:按创建顺序(本地即插入顺序)返回。 */
  async list(): Promise<TodoCategory[]> {
    return readList<TodoCategory>(KEY);
  },

  async create(name: string): Promise<TodoCategory> {
    const trimmed = normalizeName(name);
    const list = await readList<TodoCategory>(KEY);
    assertNameFree(list, trimmed);
    const cat: TodoCategory = { id: nextId(list), name: trimmed };
    await writeList(KEY, [...list, cat]);
    return cat;
  },

  async rename(id: number, name: string): Promise<TodoCategory> {
    const trimmed = normalizeName(name);
    const list = await readList<TodoCategory>(KEY);
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error(`local todo category ${id} not found`);
    assertNameFree(list, trimmed, id);
    list[idx] = { ...list[idx], name: trimmed };
    await writeList(KEY, list);
    return list[idx];
  },

  /**
   * 删除分类,并把引用它的待办置为未分类。
   *
   * 级联是正确性要求而不是清理:后端那边是 @ManyToOne(..., { onDelete: 'SET NULL' }),
   * 数据库替我们做了这件事;本地没有外键,漏掉就会留下指向已删除分类的待办——
   * UI 上表现为一枚查不到名字的幽灵标签,且再也筛不出来。
   */
  async remove(id: number): Promise<void> {
    const list = await readList<TodoCategory>(KEY);
    await writeList(KEY, list.filter((c) => c.id !== id));
    await localTodos.clearCategory(id);
  },
};
