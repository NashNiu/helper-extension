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

  it("拆除后 keydown 监听确实被解绑——同一个函数引用、同一个捕获标志", () => {
    // 只看「Esc 后 host 还是不是 null」测不出问题:host 已经被 hideOverlay 移除了,
    // 就算监听没解绑或者捕获标志对不上导致 removeEventListener 没删掉它,再发一次
    // Esc 也只是对着 live === null 的 hideOverlay 空跑一次,断言照样通过。要证明
    // 监听真的解绑了,必须证明 addEventListener 和 removeEventListener 用的是同一个
    // 函数引用、同一个捕获标志(true)。
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");
    showOverlay(DATA_URL, vi.fn(async () => {}));
    const addCall = addSpy.mock.calls.find(([type]) => type === "keydown");
    expect(addCall).toBeDefined();
    const [, handler, options] = addCall!;
    hideOverlay();
    const removeCall = removeSpy.mock.calls.find(([type]) => type === "keydown");
    expect(removeCall).toBeDefined();
    expect(removeCall![1]).toBe(handler); // 必须是同一个函数引用,不是「另写一个逻辑相同的」
    expect(removeCall![2]).toBe(options); // 捕获标志必须和绑定时一致,否则删不掉真正那个监听
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("copy 成功后覆盖层会在微任务里被拆除", async () => {
    // void copy(...).finally(...) 里的 finally 是异步执行的:同步阶段 host 还在,
    // 得等一轮微任务才会消失。如果实现漏掉了 .finally(...)(只 void 了 copy 但
    // 不管后续),这里的 drag 测试(拖出有效选区后按归一化矩形调用 copy)一样会
    // 通过,因为它只断言 copy 被调用,不管调用之后覆盖层是否被拆掉。
    const copy = vi.fn(async () => {});
    showOverlay(DATA_URL, copy);
    drag([100, 200], [50, 80]);
    expect(host()).not.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(host()).toBeNull();
  });

  it("copy 失败后覆盖层也要被拆除——finally 在两条路径上都要跑", async () => {
    const copy = vi.fn(async () => {
      throw new Error("clipboard write failed");
    });
    showOverlay(DATA_URL, copy);
    drag([100, 200], [50, 80]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(host()).toBeNull();
  });

  it("copy 异步期间被新的截图请求打断:完成时不能拆掉后来的新覆盖层", async () => {
    // 覆盖层 #1 发起 copy 后进入 pending;在它完成之前,用户又触发了一次截图。
    // showOverlay 会同步拆掉 #1、装上 #2。#1 的 copy 随后完成时,如果不做身份
    // 校验就直接 hideOverlay(),拆掉的会是当前唯一存在的 #2,而不是早已经不在
    // 的 #1——覆盖层会在用户框选途中凭空消失。
    let resolveFirst!: () => void;
    const firstCopy = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    showOverlay(DATA_URL, firstCopy);
    drag([100, 200], [50, 80]); // 触发 firstCopy,promise 挂起未完成
    expect(firstCopy).toHaveBeenCalledTimes(1);

    const secondCopy = vi.fn(async () => {});
    showOverlay(DATA_URL, secondCopy); // 新一次截图请求,覆盖层 #2 顶替 #1
    expect(document.querySelectorAll(`#${OVERLAY_ID}`).length).toBe(1);

    resolveFirst(); // #1 的 copy 此刻才完成
    await new Promise((resolve) => setTimeout(resolve, 0));

    // #2 必须还在,而且始终只有一个覆盖层。
    expect(host()).not.toBeNull();
    expect(document.querySelectorAll(`#${OVERLAY_ID}`).length).toBe(1);
  });

  it("右键点击取消框选:拆除覆盖层且不调用 copy", () => {
    const copy = vi.fn(async () => {});
    showOverlay(DATA_URL, copy);
    const surface = host()!.shadowRoot!.querySelector("[data-shot-surface]")!;
    surface.dispatchEvent(new MouseEvent("mousedown", { clientX: 100, clientY: 100, button: 0, bubbles: true }));
    surface.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    expect(host()).toBeNull();
    expect(copy).not.toHaveBeenCalled();
  });

  it("鼠标在窗口外松开也能正常结束拖拽——window 级兜底监听生效", () => {
    // surface 铺满视口,但如果用户把鼠标拖到浏览器窗口外(标签栏、系统菜单、
    // 另一块屏幕)才松开,那次 mouseup 根本不会派发在 surface 上,只有 window
    // 能收到。这里直接把 mouseup 派发在 window 上模拟这种情况,不经过 shadow
    // root(合成事件默认不 composed,也刚好符合「不靠冒泡也要生效」的要求)。
    const copy = vi.fn(async () => {});
    showOverlay(DATA_URL, copy);
    const surface = host()!.shadowRoot!.querySelector("[data-shot-surface]")!;
    surface.dispatchEvent(new MouseEvent("mousedown", { clientX: 100, clientY: 200, button: 0, bubbles: true }));
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 50, clientY: 80 }));
    expect(copy).toHaveBeenCalledWith(DATA_URL, { x: 50, y: 80, w: 50, h: 120 });
    expect(copy).toHaveBeenCalledTimes(1);
    // 再补一次 window mouseup,确认不会被当成新的一次松开重复处理(此时 start
    // 已经是 null,应该被 endDrag 的判空短路掉)。
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 999, clientY: 999 }));
    expect(copy).toHaveBeenCalledTimes(1);
  });
});
