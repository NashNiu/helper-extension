import { beforeEach, describe, expect, it, vi } from "vitest";
import { localTodos } from "./todos";

function mockChrome() {
  const data: Record<string, unknown> = {};
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: data[key] })),
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

describe("localTodos 图片", () => {
  let data: Record<string, unknown>;
  beforeEach(() => {
    data = mockChrome();
  });

  it("没有图片键时 images 缺省为空数组", async () => {
    await localTodos.create("写文档");
    const [t] = await localTodos.listActive();
    expect(t.images).toEqual([]);
  });

  it("addImages 写入后能被 listActive hydrate 出来", async () => {
    const t = await localTodos.create("修 bug");
    await localTodos.addImages(t.id, ["data:image/webp;base64,AAA"]);
    const [got] = await localTodos.listActive();
    expect(got.images).toHaveLength(1);
    expect(got.images[0].url).toBe("data:image/webp;base64,AAA");
  });

  it("addImages 的 id 与 sort_order 递增", async () => {
    const t = await localTodos.create("修 bug");
    await localTodos.addImages(t.id, ["data:a"]);
    const after = await localTodos.addImages(t.id, ["data:b", "data:c"]);
    expect(after.map((i) => i.id)).toEqual([1, 2, 3]);
    expect(after.map((i) => i.sort_order)).toEqual([0, 1, 2]);
  });

  it("removeImage 只删掉指定那一张", async () => {
    const t = await localTodos.create("修 bug");
    const three = await localTodos.addImages(t.id, ["data:a", "data:b", "data:c"]);
    const left = await localTodos.removeImage(t.id, three[1].id);
    expect(left.map((i) => i.url)).toEqual(["data:a", "data:c"]);
  });

  it("已完成列表同样 hydrate 图片", async () => {
    const t = await localTodos.create("买菜");
    await localTodos.addImages(t.id, ["data:a"]);
    await localTodos.update(t.id, { is_done: true });
    const [done] = await localTodos.listDone();
    expect(done.images).toHaveLength(1);
  });

  it("删除待办时级联删掉它的图片键", async () => {
    const t = await localTodos.create("修 bug");
    await localTodos.addImages(t.id, ["data:a"]);
    expect(Object.keys(data).some((k) => k.includes("todoImg"))).toBe(true);
    await localTodos.remove(t.id);
    expect(Object.keys(data).some((k) => k.includes("todoImg"))).toBe(false);
  });

  // 这一条是级联删除真正要防的事故:本地 id 会被复用。
  it("删掉 id 最大的待办后,新建的待办不会捡到它的图片", async () => {
    await localTodos.create("a");
    await localTodos.create("b");
    const last = await localTodos.create("c");
    await localTodos.addImages(last.id, ["data:stale"]);
    await localTodos.remove(last.id);

    const fresh = await localTodos.create("d");
    // nextId 是「当前最大 + 1」,所以新待办拿到的正是刚删掉那条的 id
    expect(fresh.id).toBe(last.id);
    const list = await localTodos.listActive();
    const got = list.find((x) => x.id === fresh.id)!;
    expect(got.images).toEqual([]);
  });

  it("update 不会碰掉已有的图片", async () => {
    const t = await localTodos.create("旧标题");
    await localTodos.addImages(t.id, ["data:a"]);
    await localTodos.update(t.id, { content: "新标题" });
    const [got] = await localTodos.listActive();
    expect(got.content).toBe("新标题");
    expect(got.images).toHaveLength(1);
  });

  it("update 的返回值本身要带上真实图片,不是创建时的占位空数组", async () => {
    const t = await localTodos.create("旧标题");
    await localTodos.addImages(t.id, ["data:a", "data:b"]);
    const updated = await localTodos.update(t.id, { content: "新标题" });
    expect(updated.images).toHaveLength(2);
    expect(updated.images.map((i) => i.url)).toEqual(["data:a", "data:b"]);
  });
});
