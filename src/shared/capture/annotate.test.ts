import { describe, expect, it } from "vitest";
import {
  emptyOps,
  pushOp,
  replaceOp,
  effectiveList,
  hasMosaic,
  nextOpId,
  bitmapScale,
  toBitmapPt,
  brushRadius,
  BRUSH_CSS_RADIUS,
  DEFAULT_BRUSH,
  canUndo,
  emptyHistory,
  record,
  rewind,
  type Op,
  type Ops,
} from "./annotate";

const M = (id: string): Op => ({ kind: "mosaic", id, points: [{ x: 1, y: 1 }], radius: 3 });
const R = (id: string): Op => ({ kind: "rect", id, r: { x: 0, y: 0, w: 10, h: 10 }, color: "red", width: 2 });
const T = (id: string, text: string): Op => ({ kind: "text", id, at: { x: 5, y: 5 }, text, color: "blue", fontPx: 20 });

describe("操作列表", () => {
  it("新建的操作列表是空的", () => {
    expect(emptyOps().list).toEqual([]);
  });

  it("pushOp 按顺序追加，且不修改原对象——渲染靠重放，就地改会让快照失去参照", () => {
    const a = emptyOps();
    const b = pushOp(a, M("op-1"));
    const c = pushOp(b, R("op-2"));
    expect(a.list).toEqual([]);
    expect(c.list.map((o) => o.id)).toEqual(["op-1", "op-2"]);
  });

  it("replaceOp 就地替换，位置不变——改完的文字必须留在原来的层叠位置", () => {
    const ops = { list: [M("op-1"), T("op-2", "旧"), R("op-3")] };
    const next = replaceOp(ops, "op-2", T("op-2", "新"));
    expect(next.list.map((o) => o.id)).toEqual(["op-1", "op-2", "op-3"]);
    expect((next.list[1] as { text: string }).text).toBe("新");
  });

  it("replaceOp 传 null 表示删除该项", () => {
    const ops = { list: [M("op-1"), T("op-2", "x")] };
    expect(replaceOp(ops, "op-2", null).list.map((o) => o.id)).toEqual(["op-1"]);
  });

  it("effectiveList 没有草稿时原样返回", () => {
    const ops = { list: [M("op-1")] };
    expect(effectiveList(ops)).toEqual(ops.list);
  });

  it("effectiveList 的 replacesId 为 null 时把草稿追加在末尾", () => {
    const ops = { list: [M("op-1")] };
    const got = effectiveList(ops, { op: R("op-9"), replacesId: null });
    expect(got.map((o) => o.id)).toEqual(["op-1", "op-9"]);
  });

  it("effectiveList 的 replacesId 命中时就地替换，不移到末尾——否则编辑中的文字会跳到最上层", () => {
    const ops = { list: [T("op-1", "甲"), R("op-2")] };
    const got = effectiveList(ops, { op: T("op-1", "乙"), replacesId: "op-1" });
    expect(got.map((o) => o.id)).toEqual(["op-1", "op-2"]);
    expect((got[0] as { text: string }).text).toBe("乙");
  });

  it("hasMosaic 只认 mosaic 类型——三个箭头不该触发像素化", () => {
    expect(hasMosaic([R("op-1"), T("op-2", "x")])).toBe(false);
    expect(hasMosaic([R("op-1"), M("op-2")])).toBe(true);
    expect(hasMosaic([])).toBe(false);
  });

  it("nextOpId 连续调用不重复", () => {
    expect(nextOpId()).not.toBe(nextOpId());
  });
});

describe("bitmapScale", () => {
  it("位图与视口同宽时是 1", () => {
    expect(bitmapScale(1000, 1000)).toBe(1);
  });

  it("二倍屏是 2", () => {
    expect(bitmapScale(2000, 1000)).toBe(2);
  });

  it("innerWidth 为 0 时退回 1，避免除出 Infinity 把后面的坐标全毁掉", () => {
    expect(bitmapScale(1000, 0)).toBe(1);
  });
});

describe("toBitmapPt", () => {
  it("按比例换算并取整", () => {
    expect(toBitmapPt({ x: 10, y: 20 }, 2)).toEqual({ x: 20, y: 40 });
  });

  it("非整数比例也取整，画布坐标不该出现小数", () => {
    expect(toBitmapPt({ x: 10, y: 20 }, 1.25)).toEqual({ x: 13, y: 25 });
  });
});

describe("brushRadius", () => {
  it("三档的 CSS 半径依次拉开", () => {
    expect(BRUSH_CSS_RADIUS.small).toBeLessThan(BRUSH_CSS_RADIUS.medium);
    expect(BRUSH_CSS_RADIUS.medium).toBeLessThan(BRUSH_CSS_RADIUS.large);
  });

  it("三档的 CSS 半径钉死在约定的具体数值上——只校验顺序和比例,一个打错的常量也能蒙混过关", () => {
    expect(BRUSH_CSS_RADIUS).toEqual({ small: 8, medium: 16, large: 28 });
  });

  it("默认档是中", () => {
    expect(DEFAULT_BRUSH).toBe("medium");
  });

  it("按比例换算到位图尺度", () => {
    expect(brushRadius("medium", 2)).toBe(BRUSH_CSS_RADIUS.medium * 2);
  });

  it("再小也至少 1 像素——半径 0 会画出什么都没有的笔迹", () => {
    expect(brushRadius("small", 0.01)).toBe(1);
  });
});

describe("撤销快照栈", () => {
  it("新建的历史不能撤销", () => {
    expect(canUndo(emptyHistory())).toBe(false);
    expect(rewind(emptyHistory())).toBeNull();
  });

  it("撤销一次追加，回到追加之前", () => {
    const a: Ops = { list: [M("op-1")] };
    const h = record(emptyHistory(), a);
    const back = rewind(h);
    expect(back!.ops.list.map((o) => o.id)).toEqual(["op-1"]);
    expect(canUndo(back!.history)).toBe(false);
  });

  it("撤销一次「修改」恢复的是旧内容，而不是把那条整个删掉——这正是 slice(0,-1) 做不到的", () => {
    const before: Ops = { list: [T("op-1", "旧")] };
    const after = replaceOp(before, "op-1", T("op-1", "新"));
    const h = record(emptyHistory(), before);

    const back = rewind(h)!;

    expect(back.ops.list).toHaveLength(1);
    expect((back.ops.list[0] as { text: string }).text).toBe("旧");
    // 对照:旧实现会得到一个空列表
    expect(after.list).toHaveLength(1);
  });

  it("撤销一次「删除」把那条放回来", () => {
    const before: Ops = { list: [M("op-1"), T("op-2", "x")] };
    const h = record(emptyHistory(), before);
    expect(rewind(h)!.ops.list.map((o) => o.id)).toEqual(["op-1", "op-2"]);
  });

  it("连续撤销按后进先出逐步回退", () => {
    let h = emptyHistory();
    const s0: Ops = { list: [] };
    const s1: Ops = { list: [M("op-1")] };
    h = record(h, s0);
    h = record(h, s1);
    const first = rewind(h)!;
    expect(first.ops.list.map((o) => o.id)).toEqual(["op-1"]);
    const second = rewind(first.history)!;
    expect(second.ops.list).toEqual([]);
    expect(canUndo(second.history)).toBe(false);
  });

  it("record 不修改传入的历史", () => {
    const h = emptyHistory();
    record(h, { list: [M("op-1")] });
    expect(canUndo(h)).toBe(false);
  });
});

