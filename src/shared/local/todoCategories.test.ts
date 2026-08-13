import { beforeEach, describe, expect, it, vi } from "vitest";
import { localTodoCategories } from "./todoCategories";
import { localTodos } from "./todos";

function mockChrome() {
  const data: Record<string, unknown> = {};
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: vi.fn(async (keyOrKeys: string | string[]) => {
          const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
          const out: Record<string, unknown> = {};
          for (const k of keys) out[k] = data[k];
          return out;
        }),
        set: vi.fn(async (obj: Record<string, unknown>) => {
          Object.assign(data, obj);
        }),
        remove: vi.fn(async (key: string) => {
          delete data[key];
        }),
      },
    },
  };
  return data;
}

describe("localTodoCategories", () => {
  beforeEach(() => {
    mockChrome();
  });

  it("初始没有分类", async () => {
    expect(await localTodoCategories.list()).toEqual([]);
  });

  it("create 后能列出，按创建顺序", async () => {
    await localTodoCategories.create("工作");
    await localTodoCategories.create("生活");
    expect((await localTodoCategories.list()).map((c) => c.name)).toEqual([
      "工作",
      "生活",
    ]);
  });

  it("create 去掉首尾空白", async () => {
    const cat = await localTodoCategories.create("  工作  ");
    expect(cat.name).toBe("工作");
  });

  // 后端有 (user_id, name) 唯一索引，本地必须给出同样的拒绝，
  // 否则同一个用户登录前后会看到不同的约束。
  it("重名的分类被拒绝", async () => {
    await localTodoCategories.create("工作");
    await expect(localTodoCategories.create("工作")).rejects.toThrow();
  });

  // 后端 create 里 `if (!trimmed) throw new BadRequestException`,
  // 以及 DTO 上的 @MaxLength(50);本地要给出同一套拒绝。
  it("空名字被拒绝", async () => {
    await expect(localTodoCategories.create("   ")).rejects.toThrow();
  });

  it("超长名字被拒绝", async () => {
    await expect(localTodoCategories.create("x".repeat(51))).rejects.toThrow();
  });

  it("rename 改掉名字", async () => {
    const cat = await localTodoCategories.create("工作");
    const renamed = await localTodoCategories.rename(cat.id, "工作事项");
    expect(renamed.name).toBe("工作事项");
    expect((await localTodoCategories.list())[0].name).toBe("工作事项");
  });

  it("rename 成另一个已存在的名字被拒绝", async () => {
    await localTodoCategories.create("工作");
    const life = await localTodoCategories.create("生活");
    await expect(localTodoCategories.rename(life.id, "工作")).rejects.toThrow();
  });

  it("rename 成自己原来的名字不算重名", async () => {
    const cat = await localTodoCategories.create("工作");
    const renamed = await localTodoCategories.rename(cat.id, "工作");
    expect(renamed.name).toBe("工作");
  });

  it("remove 删掉分类", async () => {
    const cat = await localTodoCategories.create("工作");
    await localTodoCategories.remove(cat.id);
    expect(await localTodoCategories.list()).toEqual([]);
  });

  // 与后端 @ManyToOne(..., { onDelete: 'SET NULL' }) 同语义：
  // 删分类不能删待办，只把待办上的引用置空。漏了这一步，待办会指向
  // 一个不存在的分类 id，UI 上就是一枚查不到名字的幽灵标签。
  it("remove 把引用它的待办的 category_id 置空，且不删待办", async () => {
    const cat = await localTodoCategories.create("工作");
    const t = await localTodos.create("写周报", undefined, cat.id);
    const other = await localTodos.create("买牛奶");

    await localTodoCategories.remove(cat.id);

    const list = await localTodos.listActive();
    expect(list).toHaveLength(2);
    expect(list.find((x) => x.id === t.id)!.category_id).toBeNull();
    expect(list.find((x) => x.id === other.id)!.category_id).toBeNull();
  });
});
