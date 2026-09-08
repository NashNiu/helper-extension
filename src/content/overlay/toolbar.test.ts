import { describe, expect, it, vi } from "vitest";
import { createToolbar, type ToolbarCallbacks } from "./toolbar";

function make(overrides: Partial<ToolbarCallbacks> = {}) {
  const cb: ToolbarCallbacks = {
    onTool: vi.fn(),
    onBrush: vi.fn(),
    onUndo: vi.fn(),
    onCancel: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  };
  return { cb, bar: createToolbar(cb) };
}

function click(el: HTMLElement, sel: string) {
  el.querySelector<HTMLElement>(sel)!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("createToolbar", () => {
  it("默认工具是选区，默认笔刷是中", () => {
    const { bar } = make();
    expect(bar.el.querySelector("[data-tool='select']")!.getAttribute("aria-pressed")).toBe("true");
    expect(bar.el.querySelector("[data-brush='medium']")!.getAttribute("aria-pressed")).toBe("true");
  });

  it("每个按钮都带非空的 aria-label 和 title——全是图标，没有可见文字", () => {
    const { bar } = make();
    const buttons = bar.el.querySelectorAll<HTMLElement>("button");
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) {
      expect(b.getAttribute("aria-label")).toBeTruthy();
      expect(b.getAttribute("title")).toBeTruthy();
    }
  });

  it("点马赛克回调工具切换", () => {
    const { cb, bar } = make();
    click(bar.el, "[data-tool='mosaic']");
    expect(cb.onTool).toHaveBeenCalledWith("mosaic");
  });

  it("setTool 更新按下态——状态由外部驱动，工具栏不自作主张", () => {
    const { bar } = make();
    bar.setTool("mosaic");
    expect(bar.el.querySelector("[data-tool='mosaic']")!.getAttribute("aria-pressed")).toBe("true");
    expect(bar.el.querySelector("[data-tool='select']")!.getAttribute("aria-pressed")).toBe("false");
  });

  it("笔刷档位只在马赛克工具下露面", () => {
    const { bar } = make();
    const brushes = bar.el.querySelector<HTMLElement>("[data-brushes]")!;
    expect(brushes.style.display).toBe("none");
    bar.setTool("mosaic");
    expect(brushes.style.display).not.toBe("none");
    bar.setTool("select");
    expect(brushes.style.display).toBe("none");
  });

  it("点笔刷档位回调粗细", () => {
    const { cb, bar } = make();
    click(bar.el, "[data-brush='large']");
    expect(cb.onBrush).toHaveBeenCalledWith("large");
  });

  it("撤销默认禁用，setUndoEnabled 打开后才可点", () => {
    const { cb, bar } = make();
    const undo = bar.el.querySelector<HTMLButtonElement>("[data-undo]")!;
    expect(undo.disabled).toBe(true);
    bar.setUndoEnabled(true);
    expect(undo.disabled).toBe(false);
    click(bar.el, "[data-undo]");
    expect(cb.onUndo).toHaveBeenCalled();
  });

  it("取消和保存各自回调", () => {
    const { cb, bar } = make();
    click(bar.el, "[data-shot-cancel]");
    click(bar.el, "[data-shot-save]");
    expect(cb.onCancel).toHaveBeenCalled();
    expect(cb.onSave).toHaveBeenCalled();
  });

  it("setLocale 换掉所有文案", () => {
    const { bar } = make();
    bar.setLocale("zh-Hans");
    expect(bar.el.querySelector("[data-tool='mosaic']")!.getAttribute("title")).toBe("马赛克");
  });
});
