import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  dedupe,
  cull,
  sortForDisplay,
  applyPin,
  applyUnpin,
  applyRemove,
  addItem,
  getSettings,
  setLimit,
  getItems,
  pinItem,
  unpinItem,
  removeItem,
  DEFAULT_LIMIT,
  type ClipItem,
} from "./clipboardStore";

function txt(id: string, text: string, createdAt: number, pinned = false, pinnedAt?: number): ClipItem {
  return { id, type: "text", text, source: "manual", createdAt, pinned, pinnedAt };
}
function img(id: string, createdAt: number, pinned = false): ClipItem {
  return { id, type: "image", dataUrl: "data:image/png;base64,AAAA", w: 10, h: 10, bytes: 4, source: "image", createdAt, pinned };
}

function mockChrome() {
  const data: Record<string, unknown> = {};
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: data[key] })),
        set: vi.fn(async (obj: Record<string, unknown>) => { Object.assign(data, obj); }),
        remove: vi.fn(async (key: string) => { delete data[key]; }),
      },
    },
  };
  return data;
}

describe("dedupe", () => {
  it("bumps newest identical text to front instead of adding", () => {
    const items = [txt("a", "hi", 200), txt("b", "yo", 100)];
    const out = dedupe(items, txt("c", "hi", 300));
    expect(out.map((i) => i.id)).toEqual(["a", "b"]);
    expect(out[0].createdAt).toBe(300);
  });
  it("prepends when text differs", () => {
    const items = [txt("a", "hi", 200)];
    const out = dedupe(items, txt("c", "new", 300));
    expect(out.map((i) => i.id)).toEqual(["c", "a"]);
  });
  it("never dedupes images", () => {
    const items = [img("a", 200)];
    const out = dedupe(items, img("c", 300));
    expect(out.map((i) => i.id)).toEqual(["c", "a"]);
  });
  it("does not dedupe when incoming matches a non-newest text item", () => {
    const items = [txt("a", "hi", 300), txt("b", "hello", 200)];
    const out = dedupe(items, txt("c", "hello", 400));
    expect(out.map((i) => i.id)).toEqual(["c", "a", "b"]);
  });
});

describe("cull", () => {
  it("keeps pinned and drops oldest non-pinned beyond limit", () => {
    const items = [txt("a", "1", 400), txt("b", "2", 300, true), txt("c", "3", 200), txt("d", "4", 100)];
    const out = cull(items, 2);
    expect(out.map((i) => i.id)).toEqual(["a", "b", "c"]); // d culled (oldest non-pinned over limit 2)
  });
  it("no-op when within limit", () => {
    const items = [txt("a", "1", 200), txt("b", "2", 100)];
    expect(cull(items, 5).map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("sortForDisplay", () => {
  const now = Date.parse("2026-07-04T12:00:00Z");
  const startOfToday = (() => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  it("groups pinned (by pinnedAt desc), today, earlier", () => {
    const items = [
      txt("p1", "x", 10, true, 100),
      txt("p2", "y", 20, true, 200),
      txt("t1", "a", startOfToday + 5000),
      txt("e1", "b", startOfToday - 5000),
    ];
    const g = sortForDisplay(items, now);
    expect(g.pinned.map((i) => i.id)).toEqual(["p2", "p1"]);
    expect(g.today.map((i) => i.id)).toEqual(["t1"]);
    expect(g.earlier.map((i) => i.id)).toEqual(["e1"]);
  });
  it("orders items within today and earlier groups by createdAt desc", () => {
    const items = [
      txt("t1", "a", startOfToday + 1000),
      txt("t2", "b", startOfToday + 3000),
      txt("e1", "c", startOfToday - 1000),
      txt("e2", "d", startOfToday - 3000),
    ];
    const g = sortForDisplay(items, now);
    expect(g.today.map((i) => i.id)).toEqual(["t2", "t1"]);
    expect(g.earlier.map((i) => i.id)).toEqual(["e1", "e2"]);
  });
});

describe("applyPin/applyUnpin/applyRemove", () => {
  it("pin sets pinned + pinnedAt", () => {
    const out = applyPin([txt("a", "x", 100)], "a", 999);
    expect(out[0].pinned).toBe(true);
    expect(out[0].pinnedAt).toBe(999);
  });
  it("unpin clears pinned + pinnedAt", () => {
    const out = applyUnpin([txt("a", "x", 100, true, 999)], "a");
    expect(out[0].pinned).toBe(false);
    expect(out[0].pinnedAt).toBeUndefined();
  });
  it("remove drops by id", () => {
    expect(applyRemove([txt("a", "x", 1), txt("b", "y", 2)], "a").map((i) => i.id)).toEqual(["b"]);
  });
});

describe("async wrappers", () => {
  beforeEach(() => mockChrome());
  it("getSettings returns default limit when unset", async () => {
    expect(await getSettings()).toEqual({ limit: DEFAULT_LIMIT });
  });
  it("addItem dedupes and culls, persisting newest-first", async () => {
    await setLimit(2);
    await addItem(txt("a", "one", 100));
    await addItem(txt("b", "two", 200));
    await addItem(txt("c", "three", 300));
    const items = await getItems();
    expect(items.map((i) => i.id)).toEqual(["c", "b"]); // a culled at limit 2
  });
  it("setLimit re-culls existing items", async () => {
    await addItem(txt("a", "1", 100));
    await addItem(txt("b", "2", 200));
    await addItem(txt("c", "3", 300));
    await setLimit(1);
    expect((await getItems()).map((i) => i.id)).toEqual(["c"]);
  });
  it("pinItem/unpinItem persist pinned state", async () => {
    await addItem(txt("a", "x", 100));
    let items = await pinItem("a");
    expect(items[0].pinned).toBe(true);
    expect(typeof items[0].pinnedAt).toBe("number");
    items = await unpinItem("a");
    expect(items[0].pinned).toBe(false);
    expect(items[0].pinnedAt).toBeUndefined();
    expect(await getItems()).toEqual(items); // persisted
  });
  it("removeItem persists deletion", async () => {
    await addItem(txt("a", "x", 100));
    await addItem(txt("b", "y", 200));
    const items = await removeItem("a");
    expect(items.map((i) => i.id)).toEqual(["b"]);
    expect((await getItems()).map((i) => i.id)).toEqual(["b"]);
  });
});
