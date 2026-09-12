import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTextEditor, type TextEditorCallbacks } from "./textEditor";
import type { TextOp } from "../../shared/capture/annotate";

const OP: TextOp = { kind: "text", id: "op-1", at: { x: 10, y: 20 }, text: "", color: "red", fontPx: 20 };

function setup(): { root: ShadowRoot; cb: TextEditorCallbacks & { onChange: ReturnType<typeof vi.fn>; onCommit: ReturnType<typeof vi.fn> } } {
  const host = document.createElement("div");
  document.body.append(host);
  const root = host.attachShadow({ mode: "open" });
  const cb = { onChange: vi.fn(), onCommit: vi.fn() };
  return { root, cb };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("文字编辑器", () => {
  it("begin 之后处于编辑态，input 拿到焦点", () => {
    const { root, cb } = setup();
    const ed = createTextEditor(root, cb, (p) => p);
    expect(ed.begin(OP, null)).toBe(true);
    expect(ed.isEditing()).toBe(true);
    expect(root.activeElement).toBe(ed.el);
  });

  it("begin 之前不是编辑态，草稿为 null", () => {
    const { root, cb } = setup();
    const ed = createTextEditor(root, cb, (p) => p);
    expect(ed.isEditing()).toBe(false);
    expect(ed.draft()).toBeNull();
  });

  it("输入触发 onChange，草稿内容跟着变——预览要靠它逐字重画", () => {
    const { root, cb } = setup();
    const ed = createTextEditor(root, cb, (p) => p);
    ed.begin(OP, null);
    ed.el.value = "你好";
    ed.el.dispatchEvent(new Event("input"));
    expect(cb.onChange).toHaveBeenCalled();
    expect((ed.draft()!.op as TextOp).text).toBe("你好");
  });

  it("草稿带上光标位置，供画布画光标", () => {
    const { root, cb } = setup();
    const ed = createTextEditor(root, cb, (p) => p);
    ed.begin(OP, null);
    ed.el.value = "abcd";
    ed.el.setSelectionRange(2, 2);
    ed.el.dispatchEvent(new Event("input"));
    expect(ed.draft()!.caret).toBe(2);
  });

  it("载入既有文字时草稿的 replacesId 是它的 id——定稿要就地替换,不能跳到最上层", () => {
    const { root, cb } = setup();
    const ed = createTextEditor(root, cb, (p) => p);
    ed.begin({ ...OP, text: "旧" }, "op-1");
    expect(ed.el.value).toBe("旧");
    expect(ed.draft()!.replacesId).toBe("op-1");
  });

  it("Enter 定稿，且不再处于编辑态", () => {
    const { root, cb } = setup();
    const ed = createTextEditor(root, cb, (p) => p);
    ed.begin(OP, null);
    ed.el.value = "x";
    ed.el.dispatchEvent(new Event("input"));
    ed.el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(cb.onCommit).toHaveBeenCalledTimes(1);
    expect(ed.isEditing()).toBe(false);
  });

  it("Esc 定稿，不是丢弃——用户打了半天字按 Esc 想收工，不该白打", () => {
    const { root, cb } = setup();
    const ed = createTextEditor(root, cb, (p) => p);
    ed.begin(OP, null);
    ed.el.value = "x";
    ed.el.dispatchEvent(new Event("input"));
    ed.el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect((cb.onCommit.mock.calls[0][0].op as TextOp).text).toBe("x");
  });

  it("输入法组字期间按 Enter 不定稿——那次回车是在选候选字", () => {
    const { root, cb } = setup();
    const ed = createTextEditor(root, cb, (p) => p);
    ed.begin(OP, null);
    ed.el.dispatchEvent(new CompositionEvent("compositionstart"));
    ed.el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(cb.onCommit).not.toHaveBeenCalled();
    ed.el.dispatchEvent(new CompositionEvent("compositionend"));
    ed.el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(cb.onCommit).toHaveBeenCalledTimes(1);
  });

  it("空内容也照常回调 onCommit，由调用方决定删掉——编辑器不替它做删除决定", () => {
    const { root, cb } = setup();
    const ed = createTextEditor(root, cb, (p) => p);
    ed.begin({ ...OP, text: "旧" }, "op-1");
    ed.el.value = "";
    ed.el.dispatchEvent(new Event("input"));
    ed.commit();
    expect((cb.onCommit.mock.calls[0][0].op as TextOp).text).toBe("");
  });

  it("没在编辑时 commit 是无操作", () => {
    const { root, cb } = setup();
    const ed = createTextEditor(root, cb, (p) => p);
    ed.commit();
    expect(cb.onCommit).not.toHaveBeenCalled();
  });

  it("moveTo 改草稿位置并触发重画——拖动文字时要跟手", () => {
    const { root, cb } = setup();
    const ed = createTextEditor(root, cb, (p) => p);
    ed.begin(OP, null);
    ed.moveTo({ x: 99, y: 88 });
    expect((ed.draft()!.op as TextOp).at).toEqual({ x: 99, y: 88 });
    expect(cb.onChange).toHaveBeenCalled();
  });

  describe("失焦即定稿", () => {
    // 真实浏览器里,点工具栏按钮、点画布别处都会把焦点从这个 input 移走,
    // 触发一次原生 blur——这是浏览器的保证,不用在测试里造。这里只测「我们的
    // 处理器对 blur 的反应」:直接在 input 上派发 blur 事件,断言草稿被提交。
    it("编辑中派发 blur → onCommit 被调用一次，内容正确，isEditing() 变 false", () => {
      const { root, cb } = setup();
      const ed = createTextEditor(root, cb, (p) => p);
      ed.begin(OP, null);
      ed.el.value = "失焦定稿";
      ed.el.dispatchEvent(new Event("input"));
      ed.el.dispatchEvent(new Event("blur"));
      expect(cb.onCommit).toHaveBeenCalledTimes(1);
      expect((cb.onCommit.mock.calls[0][0].op as TextOp).text).toBe("失焦定稿");
      expect(ed.isEditing()).toBe(false);
    });

    it("commit() 自身调用 el.blur() 触发的那次 blur 是无操作，不会让 onCommit 被调两次", () => {
      const { root, cb } = setup();
      const ed = createTextEditor(root, cb, (p) => p);
      ed.begin(OP, null);
      ed.el.value = "只提交一次";
      ed.el.dispatchEvent(new Event("input"));
      // commit() 内部会调 el.blur(),happy-dom 里这会同步派发一次真正的 blur 事件——
      // 此时 current 已经在 commit() 里被置空,blur 监听器再次调用 commit() 时
      // 必须短路成无操作,而不是把同一条草稿又回调一遍。
      ed.commit();
      expect(cb.onCommit).toHaveBeenCalledTimes(1);
    });

    it("没在编辑时派发 blur 是无操作", () => {
      const { root, cb } = setup();
      const ed = createTextEditor(root, cb, (p) => p);
      ed.el.dispatchEvent(new Event("blur"));
      expect(cb.onCommit).not.toHaveBeenCalled();
    });
  });
});
