import { beforeEach, describe, expect, it, vi } from "vitest";
import { showOverlay, hideOverlay, OVERLAY_ID } from "./screenshotOverlay";

const DATA_URL = "data:image/png;base64,AAAA";

function host(): HTMLElement | null {
  return document.getElementById(OVERLAY_ID);
}

function drag(from: [number, number], to: [number, number]) {
  const surface = host()!.shadowRoot!.querySelector("[data-shot-surface]")!;
  surface.dispatchEvent(new MouseEvent("mousedown", { clientX: from[0], clientY: from[1], button: 0, bubbles: true }));
  surface.dispatchEvent(new MouseEvent("mousemove", { clientX: to[0], clientY: to[1], bubbles: true }));
  surface.dispatchEvent(new MouseEvent("mouseup", { clientX: to[0], clientY: to[1], bubbles: true }));
}

describe("screenshotOverlay", () => {
  beforeEach(() => {
    // 先拆掉上一个用例可能留下的覆盖层,再重置 overflow——顺序反了会被 hideOverlay
    // 的「恢复上一次的值」覆盖掉。
    hideOverlay();
    document.documentElement.style.overflow = "";
  });

  it("显示后页面上出现覆盖层宿主节点", () => {
    showOverlay(DATA_URL, vi.fn(async () => {}));
    expect(host()).not.toBeNull();
  });

  it("覆盖层内容放在 shadow root 里，不受页面样式影响", () => {
    showOverlay(DATA_URL, vi.fn(async () => {}));
    expect(host()!.shadowRoot).not.toBeNull();
  });

  it("显示期间锁住页面滚动", () => {
    showOverlay(DATA_URL, vi.fn(async () => {}));
    expect(document.documentElement.style.overflow).toBe("hidden");
  });

  it("拆除后恢复原来的滚动设置", () => {
    document.documentElement.style.overflow = "scroll";
    showOverlay(DATA_URL, vi.fn(async () => {}));
    hideOverlay();
    expect(document.documentElement.style.overflow).toBe("scroll");
  });

  it("Esc 拆除覆盖层且不复制", () => {
    const copy = vi.fn(async () => {});
    showOverlay(DATA_URL, copy);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(host()).toBeNull();
    expect(copy).not.toHaveBeenCalled();
  });

  it("拖出有效选区后按归一化矩形调用 copy", () => {
    const copy = vi.fn(async () => {});
    showOverlay(DATA_URL, copy);
    drag([100, 200], [50, 80]);
    expect(copy).toHaveBeenCalledWith(DATA_URL, { x: 50, y: 80, w: 50, h: 120 });
  });

  it("选区太小视为误点：不复制，直接拆除", () => {
    const copy = vi.fn(async () => {});
    showOverlay(DATA_URL, copy);
    drag([100, 100], [102, 101]);
    expect(copy).not.toHaveBeenCalled();
    expect(host()).toBeNull();
  });

  it("重复显示时页面上始终只有一个覆盖层", () => {
    showOverlay(DATA_URL, vi.fn(async () => {}));
    showOverlay(DATA_URL, vi.fn(async () => {}));
    expect(document.querySelectorAll(`#${OVERLAY_ID}`).length).toBe(1);
  });

  it("hideOverlay 可以重复调用而不报错", () => {
    showOverlay(DATA_URL, vi.fn(async () => {}));
    hideOverlay();
    expect(() => hideOverlay()).not.toThrow();
  });

  it("拆除后 Esc 不再有反应——监听必须解绑", () => {
    showOverlay(DATA_URL, vi.fn(async () => {}));
    hideOverlay();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(host()).toBeNull();
  });
});
