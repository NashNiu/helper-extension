import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("removeImage 删掉最后一张图片后,连 todoImg 键本身都不留下", async () => {
    const t = await localTodos.create("修 bug");
    const [only] = await localTodos.addImages(t.id, ["data:a"]);
    expect(Object.keys(data).some((k) => k.includes("todoImg"))).toBe(true);
    const left = await localTodos.removeImage(t.id, only.id);
    expect(left).toEqual([]);
    expect(Object.keys(data).some((k) => k.includes("todoImg"))).toBe(false);
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

  it("累计超过 9 张时 addImages 拒绝,且不改动已存的图片", async () => {
    const t = await localTodos.create("图多");
    const seven = Array.from({ length: 7 }, (_, i) => `data:${i}`);
    const before = await localTodos.addImages(t.id, seven);
    expect(before).toHaveLength(7);

    const three = ["data:x", "data:y", "data:z"];
    await expect(localTodos.addImages(t.id, three)).rejects.toThrow();

    const [after] = await localTodos.listActive();
    expect(after.images).toHaveLength(7);
    expect(after.images.map((i) => i.url)).toEqual(seven);
  });

  it("累计恰好等于 9 张时 addImages 成功", async () => {
    const t = await localTodos.create("图多");
    const seven = Array.from({ length: 7 }, (_, i) => `data:${i}`);
    await localTodos.addImages(t.id, seven);

    const two = ["data:x", "data:y"];
    const after = await localTodos.addImages(t.id, two);
    expect(after).toHaveLength(9);
  });
});

describe("localTodos — 提醒", () => {
  const FUTURE = new Date(Date.now() + 3600_000).toISOString();
  const PAST = new Date(Date.now() - 3600_000).toISOString();

  // 复用文件顶部已有的 mockChrome()。每个用例一份全新存储,否则下面
  // listRemindPending 的条数断言会被上一个用例留下的待办污染。
  // 这个 mock 没有 chrome.alarms,而 scheduleAlarm/clearAlarm 都做了存在性判断,
  // 所以本地存储层的用例不会因为闹钟缺席而炸。
  beforeEach(() => {
    mockChrome();
  });

  it("创建时可以带提醒时间", async () => {
    const t = await localTodos.create("写周报", FUTURE);
    expect(t.remind_at).toBe(FUTURE);
    expect(t.remind_triggered).toBe(false);
  });

  it("创建时不带提醒则为 null", async () => {
    const t = await localTodos.create("写周报");
    expect(t.remind_at).toBeNull();
    expect(t.remind_triggered).toBe(false);
  });

  it("改提醒时间会把 remind_triggered 置回 false", async () => {
    const t = await localTodos.create("写周报", PAST);
    await localTodos.markRemindTriggered(t.id);
    const out = await localTodos.update(t.id, { remind_at: FUTURE });
    expect(out.remind_at).toBe(FUTURE);
    expect(out.remind_triggered).toBe(false);
  });

  it("清空提醒时间", async () => {
    const t = await localTodos.create("写周报", FUTURE);
    const out = await localTodos.update(t.id, { remind_at: null });
    expect(out.remind_at).toBeNull();
    expect(out.remind_triggered).toBe(false);
  });

  it("勾选完成会把 remind_triggered 置为 true", async () => {
    const t = await localTodos.create("写周报", FUTURE);
    const out = await localTodos.update(t.id, { is_done: true });
    expect(out.remind_triggered).toBe(true);
  });

  it("取消完成时未来的提醒恢复，过去的不恢复", async () => {
    const future = await localTodos.create("未来", FUTURE);
    await localTodos.update(future.id, { is_done: true });
    expect((await localTodos.update(future.id, { is_done: false })).remind_triggered).toBe(false);

    const past = await localTodos.create("过去", PAST);
    await localTodos.update(past.id, { is_done: true });
    expect((await localTodos.update(past.id, { is_done: false })).remind_triggered).toBe(true);
  });

  it("listRemindPending 只返回未完成、设了提醒、未触发的，按时间正序", async () => {
    const later = new Date(Date.now() + 7200_000).toISOString();
    await localTodos.create("没提醒");
    const a = await localTodos.create("晚的", later);
    const b = await localTodos.create("早的", FUTURE);
    const done = await localTodos.create("已完成", FUTURE);
    await localTodos.update(done.id, { is_done: true });
    const fired = await localTodos.create("已弹过", FUTURE);
    await localTodos.markRemindTriggered(fired.id);

    const out = await localTodos.listRemindPending();
    expect(out.map((t) => t.id)).toEqual([b.id, a.id]);
  });

  it("listRemindPending 不读取图片键", async () => {
    const t = await localTodos.create("带图", FUTURE);
    await localTodos.addImages(t.id, ["data:image/png;base64,AAAA"]);
    const out = await localTodos.listRemindPending();
    // 调度不需要图片：这个查询每分钟被心跳调一次，读 base64 是纯浪费
    expect(out[0].images).toEqual([]);
  });

  it("同一次调用里既设提醒又勾完成，以完成为准", async () => {
    const t = await localTodos.create("写周报");
    const out = await localTodos.update(t.id, { remind_at: FUTURE, is_done: true });
    expect(out.remind_triggered).toBe(true);
  });

  it("同一次调用里既设提醒又取消完成，以取消完成后的复活判断为准", async () => {
    const t = await localTodos.create("写周报");
    await localTodos.update(t.id, { is_done: true });
    const out = await localTodos.update(t.id, { remind_at: FUTURE, is_done: false });
    expect(out.remind_triggered).toBe(false);
  });
});

describe("localTodos — 分类", () => {
  beforeEach(() => {
    mockChrome();
  });

  it("创建时不带分类则为 null", async () => {
    const t = await localTodos.create("写周报");
    expect(t.category_id).toBeNull();
  });

  it("创建时可以带分类", async () => {
    const t = await localTodos.create("写周报", undefined, 3);
    expect(t.category_id).toBe(3);
  });

  it("update 可以给待办改分类", async () => {
    const t = await localTodos.create("写周报");
    const out = await localTodos.update(t.id, { category_id: 5 });
    expect(out.category_id).toBe(5);
  });

  it("update 传 null 清空分类", async () => {
    const t = await localTodos.create("写周报", undefined, 5);
    const out = await localTodos.update(t.id, { category_id: null });
    expect(out.category_id).toBeNull();
  });

  // 与 remind_at 同样的三态语义：缺省 = 不变，别把它当成「清空」。
  it("update 不传 category_id 时分类保持不变", async () => {
    const t = await localTodos.create("写周报", undefined, 5);
    const out = await localTodos.update(t.id, { content: "写月报" });
    expect(out.category_id).toBe(5);
  });

  it("listActive 按分类过滤", async () => {
    await localTodos.create("写周报", undefined, 1);
    await localTodos.create("写月报", undefined, 1);
    await localTodos.create("买牛奶", undefined, 2);

    const got = await localTodos.listActive(0, 10, 1);
    expect(got.map((t) => t.content)).toEqual(["写月报", "写周报"]);
  });

  it("listActive 的 'none' 只返回未分类的待办", async () => {
    await localTodos.create("写周报", undefined, 1);
    await localTodos.create("买牛奶");

    const got = await localTodos.listActive(0, 10, "none");
    expect(got.map((t) => t.content)).toEqual(["买牛奶"]);
  });

  // 本次改动之前存下的待办没有 category_id 字段，读出来是 undefined。
  // 归一成 null 之后才能被「未分类」筛选命中，否则老数据会从列表里凭空消失。
  it("旧数据缺 category_id 字段时按未分类处理", async () => {
    await chrome.storage.local.set({
      "helper.local.todos": [
        { id: 1, content: "老待办", is_done: false, created_at: new Date().toISOString(), done_at: null, images: [] },
      ],
    });

    const got = await localTodos.listActive(0, 10, "none");
    expect(got.map((t) => t.content)).toEqual(["老待办"]);
    expect(got[0].category_id).toBeNull();
  });

  it("分页在过滤之后生效", async () => {
    await localTodos.create("a", undefined, 1);
    await localTodos.create("b", undefined, 2);
    await localTodos.create("c", undefined, 1);

    const got = await localTodos.listActive(0, 1, 1);
    expect(got.map((t) => t.content)).toEqual(["c"]);
  });
});
