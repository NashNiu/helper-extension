import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// currentLocale() 内部走 chrome.storage.local.get,扩展重载/更新时会抛
// "Extension context invalidated"。mock 成始终拒绝,用来验证 copyRegion 在
// 这种情况下依然能弹出结果 toast,而不是把异常一路抛出、被调用方的
// .catch(() => {}) 悄悄吞掉。
vi.mock("../shared/locale", () => ({
  currentLocale: vi.fn(async () => {
    throw new Error("Extension context invalidated");
  }),
}));

import { showOverlay, hideOverlay, showToast, copyRegion, OVERLAY_ID, TOAST_ID } from "./screenshotOverlay";
import { emptyOps, type MosaicOp, type Ops, type Pt } from "../shared/capture/annotate";
import type { Rect } from "../shared/capture/rect";
import { translate } from "../i18n/core";

const DATA_URL = "data:image/png;base64,AAAA";

// happy-dom 没有 createImageBitmap。覆盖层现在会在显示时解码底图,所以这里给一个
// 假位图:测试只关心「解出来的东西被原样传给了 copy」,不关心像素。
const FAKE_BMP = { width: 2000, height: 1000, close: vi.fn() } as unknown as ImageBitmap;
vi.stubGlobal("fetch", vi.fn(async () => ({ blob: async () => new Blob() })));
vi.stubGlobal("createImageBitmap", vi.fn(async () => FAKE_BMP));

function host(): HTMLElement | null {
  return document.getElementById(OVERLAY_ID);
}

function drag(from: [number, number], to: [number, number]) {
  const surface = host()!.shadowRoot!.querySelector("[data-shot-surface]")!;
  surface.dispatchEvent(new MouseEvent("mousedown", { clientX: from[0], clientY: from[1], button: 0, bubbles: true }));
  surface.dispatchEvent(new MouseEvent("mousemove", { clientX: to[0], clientY: to[1], bubbles: true }));
  surface.dispatchEvent(new MouseEvent("mouseup", { clientX: to[0], clientY: to[1], bubbles: true }));
}

/** 待确认态的按钮条。拖出有效选区前它是隐藏的。 */
function actions(): HTMLElement | null {
  return host()?.shadowRoot?.querySelector<HTMLElement>("[data-shot-actions]") ?? null;
}

function actionsVisible(): boolean {
  const el = actions();
  return !!el && el.style.display !== "none";
}

function clickSave(): void {
  host()!.shadowRoot!.querySelector<HTMLElement>("[data-shot-save]")!.dispatchEvent(
    new MouseEvent("click", { bubbles: true }),
  );
}

function clickCancel(): void {
  host()!.shadowRoot!.querySelector<HTMLElement>("[data-shot-cancel]")!.dispatchEvent(
    new MouseEvent("click", { bubbles: true }),
  );
}

function clickTool(t: "select" | "mosaic") {
  host()!
    .shadowRoot!.querySelector<HTMLElement>(`[data-tool='${t}']`)!
    .dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function clickUndo() {
  host()!
    .shadowRoot!.querySelector<HTMLElement>("[data-undo]")!
    .dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

/** 先框好选区,切到指定工具,再在选区内拖一次,最后点保存。返回交给 copy 的操作列表。 */
async function drawThenSave(tool: string, from: [number, number], to: [number, number]): Promise<Ops> {
  const copy = vi.fn(async (_bmp: ImageBitmap, _r: Rect, _ops: Ops) => {});
  showOverlay(DATA_URL, copy);
  await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码——后面的形状拖拽要用到位图
  drag([10, 10], [400, 300]);
  (host()!.shadowRoot!.querySelector(`[data-tool="${tool}"]`) as HTMLButtonElement).click();
  drag(from, to);
  (host()!.shadowRoot!.querySelector("[data-shot-save]") as HTMLButtonElement).click();
  await Promise.resolve();
  await Promise.resolve();
  return copy.mock.calls[0][2] as Ops;
}

async function paintOne(copy: ReturnType<typeof vi.fn>) {
  showOverlay(DATA_URL, copy);
  await new Promise((resolve) => setTimeout(resolve, 0));
  drag([100, 200], [50, 80]);
  clickTool("mosaic");
  drag([60, 90], [70, 100]);
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

  it("拖出有效选区后不立刻复制，而是浮出保存/取消按钮", async () => {
    const copy = vi.fn(async () => {});
    showOverlay(DATA_URL, copy);
    expect(actionsVisible()).toBe(false); // 还没框选,按钮不该露面
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码
    drag([100, 200], [50, 80]);
    expect(copy).not.toHaveBeenCalled();
    expect(actionsVisible()).toBe(true);
  });

  it("保存/取消是图标按钮，但必须留下可访问名——纯图标没有文字,读屏和悬停提示只能靠它", () => {
    showOverlay(DATA_URL, vi.fn(async () => {}));
    const root = host()!.shadowRoot!;
    for (const sel of ["[data-shot-save]", "[data-shot-cancel]"]) {
      const btn = root.querySelector<HTMLElement>(sel)!;
      expect(btn.getAttribute("aria-label")).toBeTruthy();
      expect(btn.getAttribute("title")).toBeTruthy();
      // 画的是图标而不是文字:按钮里得有 svg。
      expect(btn.querySelector("svg")).not.toBeNull();
    }
  });

  it("点保存才按归一化矩形把选区写进剪贴板", async () => {
    const copy = vi.fn(async () => {});
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码
    drag([100, 200], [50, 80]);
    clickSave();
    // commit() 里的 bmpReady.then(...) 即使 bmpReady 早已 resolve,回调也总是排到
    // 微任务队列里,不会跟 clickSave() 同步执行——断言前得再放一轮微任务过去。
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(copy).toHaveBeenCalledWith(FAKE_BMP, { x: 50, y: 80, w: 50, h: 120 }, { list: [] });
  });

  it("保存时把解码后的位图和操作列表交给 copy——不再传 dataUrl", async () => {
    const copy = vi.fn(async () => {});
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码
    drag([100, 200], [50, 80]);
    clickSave();
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等 commit() 里的 bmpReady.then(...) 回调跑完
    expect(copy).toHaveBeenCalledWith(FAKE_BMP, { x: 50, y: 80, w: 50, h: 120 }, { list: [] });
  });

  it("覆盖层拆除时释放位图——位图现在归覆盖层持有，不释放就是泄漏", async () => {
    (FAKE_BMP.close as ReturnType<typeof vi.fn>).mockClear();
    showOverlay(DATA_URL, vi.fn(async () => {}));
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码
    hideOverlay();
    expect(FAKE_BMP.close).toHaveBeenCalled();
  });

  it("点取消不复制，直接拆除覆盖层", async () => {
    const copy = vi.fn(async () => {});
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码
    drag([100, 200], [50, 80]);
    clickCancel();
    expect(copy).not.toHaveBeenCalled();
    expect(host()).toBeNull();
  });

  it("待确认时再拖一次可以重选，保存用的是新选区", async () => {
    const copy = vi.fn(async () => {});
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码
    drag([100, 200], [50, 80]);
    drag([10, 10], [30, 40]); // 不满意,重新拉一个
    clickSave();
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等 commit() 里的 bmpReady.then(...) 回调跑完
    expect(copy).toHaveBeenCalledTimes(1);
    expect(copy).toHaveBeenCalledWith(FAKE_BMP, { x: 10, y: 10, w: 20, h: 30 }, { list: [] });
  });

  it("重新开始拖拽时按钮先收起来，免得它悬在半空挡着新选区", async () => {
    const copy = vi.fn(async () => {});
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码
    drag([100, 200], [50, 80]);
    expect(actionsVisible()).toBe(true);
    const surface = host()!.shadowRoot!.querySelector("[data-shot-surface]")!;
    surface.dispatchEvent(new MouseEvent("mousedown", { clientX: 10, clientY: 10, button: 0, bubbles: true }));
    expect(actionsVisible()).toBe(false);
  });

  it("按在保存按钮上不会被当成开始一次新框选", async () => {
    // 按钮浮在 surface 上方,mousedown 会冒泡到 surface 的监听器。若不拦住,
    // 点保存的那一下会先把选区清成一个 0×0 的新起点,保存下去的就不是用户框的东西。
    const copy = vi.fn(async () => {});
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码
    drag([100, 200], [50, 80]);
    host()!
      .shadowRoot!.querySelector<HTMLElement>("[data-shot-save]")!
      .dispatchEvent(new MouseEvent("mousedown", { clientX: 105, clientY: 205, button: 0, bubbles: true }));
    clickSave();
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等 commit() 里的 bmpReady.then(...) 回调跑完
    expect(copy).toHaveBeenCalledWith(FAKE_BMP, { x: 50, y: 80, w: 50, h: 120 }, { list: [] });
  });

  it("待确认时按 Enter 等同于点保存", async () => {
    const copy = vi.fn(async () => {});
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码
    drag([100, 200], [50, 80]);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等 commit() 里的 bmpReady.then(...) 回调跑完
    expect(copy).toHaveBeenCalledWith(FAKE_BMP, { x: 50, y: 80, w: 50, h: 120 }, { list: [] });
  });

  it("还没框选时按 Enter 什么也不做", () => {
    const copy = vi.fn(async () => {});
    showOverlay(DATA_URL, copy);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(copy).not.toHaveBeenCalled();
    expect(host()).not.toBeNull();
  });

  it("待确认时按 Esc 取消，不复制", async () => {
    const copy = vi.fn(async () => {});
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码
    drag([100, 200], [50, 80]);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(copy).not.toHaveBeenCalled();
    expect(host()).toBeNull();
  });

  it("选区太小视为误点：不复制，直接拆除", async () => {
    const copy = vi.fn(async () => {});
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码
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
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码
    drag([100, 200], [50, 80]);
    clickSave();
    expect(host()).not.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(host()).toBeNull();
  });

  it("copy 失败后覆盖层也要被拆除——finally 在两条路径上都要跑", async () => {
    const copy = vi.fn(async () => {
      throw new Error("clipboard write failed");
    });
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码
    drag([100, 200], [50, 80]);
    clickSave();
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
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码
    drag([100, 200], [50, 80]);
    clickSave(); // 触发 firstCopy,promise 挂起未完成
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等 commit() 里的 bmpReady.then(...) 回调跑完
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

  it("解码失败:弹出复制失败提示并拆除覆盖层", async () => {
    // 与其它用例共用 createImageBitmap 的全局 stub,这里临时换成会拒绝的版本,
    // 用完照旧还原——不然后面的用例全都会跟着解码失败。
    document.getElementById(TOAST_ID)?.remove();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("decode failed");
      }),
    );
    showOverlay(DATA_URL, vi.fn(async () => {}));
    // 解码失败这条路径比其它用例多绕了几层 promise(currentLocale().catch().then(showToast)),
    // 但都只是微任务链,一次宏任务边界(setTimeout(0))就足够把它们全部冲刷完。
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(host()).toBeNull(); // 覆盖层被拆除,而不是留着一个存不下去的空壳
    expect(document.getElementById(TOAST_ID)).not.toBeNull(); // 用户必须被告知结果
    expect(document.getElementById(TOAST_ID)!.shadowRoot!.textContent).toContain("Could not copy");

    vi.stubGlobal("createImageBitmap", vi.fn(async () => FAKE_BMP)); // 还原,不影响后面的用例
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

  it("鼠标在窗口外松开也能正常结束拖拽——window 级兜底监听生效", async () => {
    // surface 铺满视口,但如果用户把鼠标拖到浏览器窗口外(标签栏、系统菜单、
    // 另一块屏幕)才松开,那次 mouseup 根本不会派发在 surface 上,只有 window
    // 能收到。这里直接把 mouseup 派发在 window 上模拟这种情况,不经过 shadow
    // root(合成事件默认不 composed,也刚好符合「不靠冒泡也要生效」的要求)。
    const copy = vi.fn(async () => {});
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码
    const surface = host()!.shadowRoot!.querySelector("[data-shot-surface]")!;
    surface.dispatchEvent(new MouseEvent("mousedown", { clientX: 100, clientY: 200, button: 0, bubbles: true }));
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 50, clientY: 80 }));
    // 拖拽确实结束了:进入待确认态,按钮浮出来。
    expect(actionsVisible()).toBe(true);
    // 再补一次 window mouseup,确认不会被当成新的一次松开重复处理(此时 start
    // 已经是 null,应该被 endDrag 的判空短路掉),选区不会被改写。
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 999, clientY: 999 }));
    clickSave();
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等 commit() 里的 bmpReady.then(...) 回调跑完
    expect(copy).toHaveBeenCalledTimes(1);
    expect(copy).toHaveBeenCalledWith(FAKE_BMP, { x: 50, y: 80, w: 50, h: 120 }, { list: [] });
  });

  it("保存进行中被拆除覆盖层不能提前关闭位图——位图归 commit 所有，copy 结束才关且只关一次", async () => {
    // FAKE_BMP 是模块级单例,它的 close 是所有用例共用的同一个 mock,测不出
    // 「关早了」还是「关了几次」。这里造一个只属于这个用例的假位图,断言才有意义。
    const localBmp = { width: 2000, height: 1000, close: vi.fn() } as unknown as ImageBitmap;
    vi.stubGlobal("createImageBitmap", vi.fn(async () => localBmp));

    // copy 故意挂起不结束,模拟「点了保存,clipboard 还没写完」那一小段窗口期。
    let resolveCopy!: () => void;
    const copy = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCopy = resolve;
        }),
    );
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码
    drag([100, 200], [50, 80]);
    clickSave();
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等 commit() 把位图交给 copy
    expect(copy).toHaveBeenCalledWith(localBmp, { x: 50, y: 80, w: 50, h: 120 }, { list: [] });

    // copy 还没 settle 时拆除覆盖层(用户按 Esc,或立刻又触发一次截图):这不该
    // 关掉 copy 正在用的这份位图,否则它内部的 renderAnnotated 会因为位图已经
    // detach 而抛错,保存就悄悄退化成一句「复制失败」。
    hideOverlay();
    expect(localBmp.close).not.toHaveBeenCalled();

    // copy 结束之后,commit 自己的 finally 才把位图关掉——而且只关这一次,
    // 不会因为上面那次 hideOverlay 已经关过而在这里又关一遍(反过来也一样:
    // 不会因为这里关了,hideOverlay 那边又去关一次)。
    resolveCopy();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(localBmp.close).toHaveBeenCalledTimes(1);

    vi.stubGlobal("createImageBitmap", vi.fn(async () => FAKE_BMP)); // 还原,不影响后面的用例
  });

  it("马赛克工具下拖动是涂抹,不再改变选区", async () => {
    const copy = vi.fn(async (_bmp: ImageBitmap, _r: Rect, _ops: Ops) => {});
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0));
    drag([100, 200], [50, 80]); // 先框一个选区
    clickTool("mosaic");
    drag([60, 90], [70, 100]); // 这一拖是涂抹
    clickSave();
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等 commit() 里的 bmpReady.then(...) 回调跑完
    const [, rect, ops] = copy.mock.calls[0];
    expect(rect).toEqual({ x: 50, y: 80, w: 50, h: 120 }); // 选区没被改
    expect(ops.list).toHaveLength(1); // 多了一条操作
  });

  it("涂抹的笔迹存的是位图坐标,不是屏幕坐标", async () => {
    const copy = vi.fn(async (_bmp: ImageBitmap, _r: Rect, _ops: Ops) => {});
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0));
    drag([100, 200], [50, 80]);
    clickTool("mosaic");
    drag([60, 90], [60, 90]);
    clickSave();
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等 commit() 里的 bmpReady.then(...) 回调跑完
    const ops = copy.mock.calls[0][2];
    // FAKE_BMP 宽 2000,happy-dom 视口宽 1024 → scale 约 1.95,位图坐标必然大于屏幕坐标
    expect((ops.list[0] as MosaicOp).points[0].x).toBeGreaterThan(60);
  });

  it("切回选区工具后拖动又能重新框选", async () => {
    const copy = vi.fn(async (_bmp: ImageBitmap, _r: Rect, _ops: Ops) => {});
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0));
    drag([100, 200], [50, 80]);
    clickTool("mosaic");
    clickTool("select");
    drag([10, 10], [40, 50]);
    clickSave();
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等 commit() 里的 bmpReady.then(...) 回调跑完
    expect(copy.mock.calls[0][1]).toEqual({ x: 10, y: 10, w: 30, h: 40 });
  });

  it("重新框选不清空已有笔迹——笔迹画在整张截图上,框选只是取景", async () => {
    const copy = vi.fn(async (_bmp: ImageBitmap, _r: Rect, _ops: Ops) => {});
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0));
    drag([100, 200], [50, 80]);
    clickTool("mosaic");
    drag([60, 90], [70, 100]);
    clickTool("select");
    drag([10, 10], [40, 50]);
    clickSave();
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等 commit() 里的 bmpReady.then(...) 回调跑完
    expect(copy.mock.calls[0][2].list).toHaveLength(1);
  });

  it("框出选区后（不必等切到马赛克工具）就挂上按位图分辨率开的预览画布", async () => {
    // 预览是否显示只取决于「有没有待定选区和底图」,不再看当前工具——选区工具下
    // 也要看到马赛克(笔迹按位图坐标存,跟取景框无关),否则用户会在切回选区工具时
    // 看不到已经画好的马赛克,存下去的图却带着它。所以这里断言的是「框完就有」,
    // 不是原来那句「切到马赛克工具才有」。
    //
    // happy-dom 原生拿不到 2d 上下文,渲染会走进 catch 把刚挂上的画布又摘掉——
    // 这里假造一个能用的上下文,让渲染走完整条成功路径,才测得出「挂载成功后
    // 确实留在 DOM 里」,而不是巧合地留下一个渲染失败的画布(那是下一个用例
    // 要测的场景)。
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    try {
      showOverlay(DATA_URL, vi.fn(async () => {}));
      await new Promise((resolve) => setTimeout(resolve, 0));
      drag([100, 200], [50, 80]);
      let cv = host()!.shadowRoot!.querySelector<HTMLCanvasElement>("[data-shot-preview]");
      expect(cv).not.toBeNull();
      // CSS 尺寸按选区(屏幕像素),后备存储按位图分辨率——预览才既清晰又与输出同源
      expect(cv!.style.width).toBe("50px");
      expect(cv!.style.height).toBe("120px");
      // 切到马赛克工具不改变这一点——预览本来就已经在了,不是切工具才生效。
      clickTool("mosaic");
      cv = host()!.shadowRoot!.querySelector<HTMLCanvasElement>("[data-shot-preview]");
      expect(cv).not.toBeNull();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("预览渲染抛错不会连累覆盖层——happy-dom 拿不到 2d 上下文，正好当这个场景", async () => {
    showOverlay(DATA_URL, vi.fn(async () => {}));
    await new Promise((resolve) => setTimeout(resolve, 0));
    drag([100, 200], [50, 80]);
    expect(() => clickTool("mosaic")).not.toThrow();
    expect(host()).not.toBeNull();
  });

  it("撤销让笔迹数减一", async () => {
    const copy = vi.fn(async (_bmp: ImageBitmap, _r: Rect, _ops: Ops) => {});
    await paintOne(copy);
    drag([61, 91], [71, 101]); // 第二笔
    clickUndo();
    clickSave();
    // 同上面其它保存路径的用例:commit() 里的 bmpReady.then(...) 总是排到微任务
    // 队列里,不会跟 clickSave() 同步执行——断言前得再放一轮微任务过去。
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(copy.mock.calls[0][2].list).toHaveLength(1);
  });

  it("Ctrl+Z 与点撤销等价", async () => {
    const copy = vi.fn(async (_bmp: ImageBitmap, _r: Rect, _ops: Ops) => {});
    await paintOne(copy);
    // 大写 "Z" 加 shiftKey——真实的 Ctrl+Shift+Z/大写锁定场景下 e.key 就是这样,
    // 逼着实现真的走一遍 .toLowerCase() 才能匹配上。之前这里直接派发已经是
    // 小写的 "z",不管有没有 .toLowerCase() 都能通过,测不出归一化到底生效没生效。
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Z", ctrlKey: true, shiftKey: true, bubbles: true }));
    clickSave();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(copy.mock.calls[0][2].list).toHaveLength(0);
  });

  it("撤销按钮在没有笔迹时禁用，涂一笔后可用", async () => {
    const copy = vi.fn(async () => {});
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const undoBtn = () => host()!.shadowRoot!.querySelector<HTMLButtonElement>("[data-undo]")!;
    expect(undoBtn().disabled).toBe(true);
    drag([100, 200], [50, 80]);
    clickTool("mosaic");
    drag([60, 90], [70, 100]);
    expect(undoBtn().disabled).toBe(false);
  });

  it("撤销到空之后再撤销、再按 Ctrl+Z：不抛错，覆盖层不消失", async () => {
    // 注意这个名字刻意没提「空列表」守卫:slice(0,-1) 在空数组上本来就还是
    // 空数组，就算 doUndo() 里去掉 ops.list.length === 0 的判断，这里断言的
    // 「不抛错」照样成立——这个用例锁定的只是「重复撤销不炸」这个可观察行为，
    // 不是守卫本身的必要性。
    const copy = vi.fn(async () => {});
    await paintOne(copy);
    clickUndo();
    expect(() => clickUndo()).not.toThrow();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
    expect(host()).not.toBeNull();
  });
});

describe("矩形框工具", () => {
  it("拖一次生成一个 rect op，带当前颜色与线宽", async () => {
    const ops = await drawThenSave("rect", [50, 50], [150, 120]);
    const op = ops.list.find((o) => o.kind === "rect");
    expect(op).toBeDefined();
    expect((op as { color: string }).color).toBe("red");
    expect((op as { width: number }).width).toBeGreaterThan(0);
  });

  it("矩形坐标是位图坐标，不是 CSS 坐标——底图宽 2000、视口宽 1024 时要放大", async () => {
    const ops = await drawThenSave("rect", [50, 50], [150, 120]);
    const op = ops.list.find((o) => o.kind === "rect") as { r: Rect };
    // FAKE_BMP.width = 2000,happy-dom 的 window.innerWidth = 1024,scale ≈ 1.95
    expect(op.r.x).toBeGreaterThan(50);
  });

  it("点一下不拖不生成矩形——误点不该留下一个看不见的框", async () => {
    const ops = await drawThenSave("rect", [50, 50], [52, 51]);
    expect(ops.list.some((o) => o.kind === "rect")).toBe(false);
  });

  it("矩形工具下拖拽不重新取景——要改取景得先切回选区工具", async () => {
    const copy = vi.fn(async (_bmp: ImageBitmap, _r: Rect, _ops: Ops) => {});
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码——后面的形状拖拽要用到位图
    drag([10, 10], [400, 300]);
    (host()!.shadowRoot!.querySelector('[data-tool="rect"]') as HTMLButtonElement).click();
    drag([50, 50], [150, 120]);
    (host()!.shadowRoot!.querySelector("[data-shot-save]") as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();
    const r = copy.mock.calls[0][1] as Rect;
    expect(r).toEqual({ x: 10, y: 10, w: 390, h: 290 });
  });

  it("画完矩形后撤销按钮可用，撤销后列表里没有矩形了", async () => {
    const copy = vi.fn(async () => {});
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码——形状拖拽要用到位图
    drag([10, 10], [400, 300]);
    (host()!.shadowRoot!.querySelector('[data-tool="rect"]') as HTMLButtonElement).click();
    drag([50, 50], [150, 120]);
    const undoBtn = host()!.shadowRoot!.querySelector("[data-undo]") as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(false);
    undoBtn.click();
    expect(undoBtn.disabled).toBe(true);
  });
});

describe("箭头工具", () => {
  it("拖一次生成一个 arrow op，起终点都是位图坐标", async () => {
    const ops = await drawThenSave("arrow", [50, 50], [200, 160]);
    const op = ops.list.find((o) => o.kind === "arrow") as { from: Pt; to: Pt } | undefined;
    expect(op).toBeDefined();
    expect(op!.from.x).toBeGreaterThan(50); // scale ≈ 1.95
    expect(op!.to.x).toBeGreaterThan(op!.from.x);
  });

  it("点一下不拖不生成箭头", async () => {
    const ops = await drawThenSave("arrow", [50, 50], [50, 50]);
    expect(ops.list.some((o) => o.kind === "arrow")).toBe(false);
  });

  it("矩形和箭头能共存，且按绘制先后排列", async () => {
    const copy = vi.fn(async (_bmp: ImageBitmap, _r: Rect, _ops: Ops) => {});
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码——后面的形状拖拽要用到位图
    drag([10, 10], [400, 300]);
    (host()!.shadowRoot!.querySelector('[data-tool="rect"]') as HTMLButtonElement).click();
    drag([50, 50], [150, 120]);
    (host()!.shadowRoot!.querySelector('[data-tool="arrow"]') as HTMLButtonElement).click();
    drag([60, 60], [200, 160]);
    (host()!.shadowRoot!.querySelector("[data-shot-save]") as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();
    const ops = copy.mock.calls[0][2] as Ops;
    expect(ops.list.map((o) => o.kind)).toEqual(["rect", "arrow"]);
  });
});

describe("showToast", () => {
  beforeEach(() => {
    document.getElementById(TOAST_ID)?.remove();
  });

  it("显示后页面上出现 toast 节点", () => {
    showToast("已复制", true);
    expect(document.getElementById(TOAST_ID)).not.toBeNull();
  });

  it("连续两次只留一个，不会叠成一摞", () => {
    showToast("已复制", true);
    showToast("复制失败", false);
    expect(document.querySelectorAll(`#${TOAST_ID}`).length).toBe(1);
  });

  it("文案写进节点里", () => {
    showToast("复制失败", false);
    expect(document.getElementById(TOAST_ID)!.shadowRoot!.textContent).toContain("复制失败");
  });
});

describe("copyRegion 在 currentLocale 失败时仍要给出结果提示", () => {
  beforeEach(() => {
    document.getElementById(TOAST_ID)?.remove();
  });

  it("扩展 context invalidated(currentLocale 拒绝)不应吞掉复制结果——退回英文文案也要弹出 toast", async () => {
    // 逐个假造 copyRegion 真实实现要用到的浏览器 API:这个测试只关心
    // 「currentLocale 拒绝之后,后续流程是否还能跑完并弹出 toast」,所以每个
    // 依赖都给最简单的可用实现,不追求还原真实的图像处理细节。位图现在由调用方
    // (覆盖层)解码并传入,copyRegion 自己不再 fetch/decode,所以这里直接给一个
    // 假位图,不用再假造 fetch/createImageBitmap。
    const fakeBlob = new Blob(["x"]);
    const fakeBitmap = { width: 100, height: 100, close: vi.fn() } as unknown as ImageBitmap;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb: BlobCallback) => cb(fakeBlob));
    Object.defineProperty(navigator, "clipboard", {
      value: { write: vi.fn(async () => {}) },
      configurable: true,
    });

    await copyRegion(fakeBitmap, { x: 0, y: 0, w: 50, h: 50 }, emptyOps());

    // 重点断言:即使 currentLocale() 抛了异常,copyRegion 也没有在到达任何一个
    // showToast(...) 调用之前就整体 reject——toast 节点必须出现。
    expect(document.getElementById(TOAST_ID)).not.toBeNull();
    // 位图现在归覆盖层持有,copyRegion 不再负责关闭它——关了的话覆盖层后续
    // 想用这份位图重画(比如预览)就会拿到一块空白画布。
    expect(fakeBitmap.close).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});

// http:// 页面上 navigator.clipboard 与 ClipboardItem 都不存在——它们是
// [SecureContext] 接口。这一组盯着那条兜底路径:execCommand("copy") 不受安全
// 上下文限制,靠的是 manifest 里的 clipboardWrite 权限。
describe("copyRegion 在非安全上下文(http 页面)下的兜底", () => {
  const ORIGINAL_CLIPBOARD_ITEM = (globalThis as unknown as { ClipboardItem?: unknown }).ClipboardItem;
  let execCommand: ReturnType<typeof vi.fn>;

  /** happy-dom 缺的那几个图像 API,给最简单的可用实现:这里不关心像素。 */
  function fakeImaging() {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb: BlobCallback) => cb(new Blob(["x"])));
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(DATA_URL);
    (HTMLImageElement.prototype as unknown as { decode: () => Promise<void> }).decode = vi.fn(async () => {});
  }

  function fakeBmp(): ImageBitmap {
    return { width: 100, height: 100, close: vi.fn() } as unknown as ImageBitmap;
  }

  function toastText(): string {
    return document.getElementById(TOAST_ID)!.shadowRoot!.textContent ?? "";
  }

  beforeEach(() => {
    document.getElementById(TOAST_ID)?.remove();
    fakeImaging();
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    vi.stubGlobal("ClipboardItem", undefined);
    execCommand = vi.fn(() => true);
    (document as unknown as { execCommand: unknown }).execCommand = execCommand;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("ClipboardItem", ORIGINAL_CLIPBOARD_ITEM);
  });

  it("navigator.clipboard 不存在时改用 execCommand 复制,并报成功", async () => {
    await copyRegion(fakeBmp(), { x: 0, y: 0, w: 50, h: 50 }, emptyOps());

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(toastText()).toContain(translate("en", "shot.copied"));
  });

  it("兜底用的临时节点复制完就摘掉,不留在页面里", async () => {
    await copyRegion(fakeBmp(), { x: 0, y: 0, w: 50, h: 50 }, emptyOps());

    expect(document.body.querySelector("img")).toBeNull();
    expect(document.body.querySelector("[contenteditable]")).toBeNull();
  });

  it("execCommand 也失败时给出单独的文案,不再说「点一下页面再试」", async () => {
    execCommand.mockReturnValue(false);

    await copyRegion(fakeBmp(), { x: 0, y: 0, w: 50, h: 50 }, emptyOps());

    expect(toastText()).toContain(translate("en", "shot.copyUnavailable"));
    expect(toastText()).not.toContain(translate("en", "shot.copyFailed"));
  });

  it("安全上下文下仍走 ClipboardItem,不碰 execCommand", async () => {
    const write = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { write }, configurable: true });
    vi.stubGlobal(
      "ClipboardItem",
      class {
        constructor(public items: Record<string, Blob>) {}
      },
    );

    await copyRegion(fakeBmp(), { x: 0, y: 0, w: 50, h: 50 }, emptyOps());

    expect(write).toHaveBeenCalled();
    expect(execCommand).not.toHaveBeenCalled();
    expect(toastText()).toContain(translate("en", "shot.copied"));
  });
});

describe("文字工具", () => {
  function textInput(): HTMLInputElement {
    return host()!.shadowRoot!.querySelector("[data-shot-text-input]") as HTMLInputElement;
  }
  function pickTool(t: string): void {
    (host()!.shadowRoot!.querySelector(`[data-tool="${t}"]`) as HTMLButtonElement).click();
  }
  function clickSurface(x: number, y: number): void {
    const surface = host()!.shadowRoot!.querySelector("[data-shot-surface]")!;
    surface.dispatchEvent(new MouseEvent("mousedown", { clientX: x, clientY: y, button: 0, bubbles: true }));
    surface.dispatchEvent(new MouseEvent("mouseup", { clientX: x, clientY: y, bubbles: true }));
  }

  it("在选区里点一下就能打字，定稿后成为一条 text op", async () => {
    const copy = vi.fn(async (_bmp: ImageBitmap, _r: Rect, _ops: Ops) => {});
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码——文字定位要用到位图换算
    drag([10, 10], [400, 300]);
    pickTool("text");
    clickSurface(100, 100);
    textInput().value = "注意这里";
    textInput().dispatchEvent(new Event("input"));
    textInput().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true }));
    (host()!.shadowRoot!.querySelector("[data-shot-save]") as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();
    const ops = copy.mock.calls[0][2] as Ops;
    const op = ops.list.find((o) => o.kind === "text") as { text: string; color: string };
    expect(op.text).toBe("注意这里");
    expect(op.color).toBe("red");
  });

  it("什么都没打就定稿，不会留下一条空文字", async () => {
    const copy = vi.fn(async (_bmp: ImageBitmap, _r: Rect, _ops: Ops) => {});
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码
    drag([10, 10], [400, 300]);
    pickTool("text");
    clickSurface(100, 100);
    textInput().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true }));
    (host()!.shadowRoot!.querySelector("[data-shot-save]") as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();
    expect((copy.mock.calls[0][2] as Ops).list.some((o) => o.kind === "text")).toBe(false);
  });

  it("编辑期间按 Esc 只定稿，不关闭覆盖层——再按一次才关", async () => {
    showOverlay(DATA_URL, vi.fn(async () => {}));
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码
    drag([10, 10], [400, 300]);
    pickTool("text");
    clickSurface(100, 100);
    textInput().value = "x";
    textInput().dispatchEvent(new Event("input"));
    textInput().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
    expect(host()).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(host()).toBeNull();
  });

  it("编辑期间按 Enter 不触发保存——那次回车是给文字的", async () => {
    const copy = vi.fn(async () => {});
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码
    drag([10, 10], [400, 300]);
    pickTool("text");
    clickSurface(100, 100);
    textInput().value = "x";
    textInput().dispatchEvent(new Event("input"));
    textInput().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true }));
    await Promise.resolve();
    expect(copy).not.toHaveBeenCalled();
    expect(host()).not.toBeNull();
  });

  it("点回已有文字能改内容，改完仍在列表原位置——层叠顺序不能变", async () => {
    const copy = vi.fn(async (_bmp: ImageBitmap, _r: Rect, _ops: Ops) => {});
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码
    drag([10, 10], [400, 300]);
    pickTool("text");
    clickSurface(100, 100);
    textInput().value = "甲";
    textInput().dispatchEvent(new Event("input"));
    textInput().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true }));
    pickTool("rect");
    drag([200, 200], [300, 260]);
    pickTool("text");
    clickSurface(102, 105); // 点回那条文字
    textInput().value = "乙";
    textInput().dispatchEvent(new Event("input"));
    textInput().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true }));
    (host()!.shadowRoot!.querySelector("[data-shot-save]") as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();
    const ops = copy.mock.calls[0][2] as Ops;
    expect(ops.list.map((o) => o.kind)).toEqual(["text", "rect"]);
    expect((ops.list[0] as { text: string }).text).toBe("乙");
  });

  it("改完文字后撤销，恢复的是上一版内容，而不是把整条删掉", async () => {
    const copy = vi.fn(async (_bmp: ImageBitmap, _r: Rect, _ops: Ops) => {});
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码
    drag([10, 10], [400, 300]);
    pickTool("text");
    clickSurface(100, 100);
    textInput().value = "甲";
    textInput().dispatchEvent(new Event("input"));
    textInput().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true }));
    clickSurface(102, 105);
    textInput().value = "乙";
    textInput().dispatchEvent(new Event("input"));
    textInput().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true }));
    (host()!.shadowRoot!.querySelector("[data-undo]") as HTMLButtonElement).click();
    (host()!.shadowRoot!.querySelector("[data-shot-save]") as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();
    const ops = copy.mock.calls[0][2] as Ops;
    expect(ops.list).toHaveLength(1);
    expect((ops.list[0] as { text: string }).text).toBe("甲");
  });

  it("把已有文字清空再定稿，那条就被删掉", async () => {
    const copy = vi.fn(async (_bmp: ImageBitmap, _r: Rect, _ops: Ops) => {});
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码
    drag([10, 10], [400, 300]);
    pickTool("text");
    clickSurface(100, 100);
    textInput().value = "甲";
    textInput().dispatchEvent(new Event("input"));
    textInput().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true }));
    clickSurface(102, 105);
    textInput().value = "";
    textInput().dispatchEvent(new Event("input"));
    textInput().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true }));
    (host()!.shadowRoot!.querySelector("[data-shot-save]") as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();
    expect((copy.mock.calls[0][2] as Ops).list).toHaveLength(0);
  });

  it("点保存时还在输入中，那条文字也要一起存进去", async () => {
    const copy = vi.fn(async (_bmp: ImageBitmap, _r: Rect, _ops: Ops) => {});
    showOverlay(DATA_URL, copy);
    await new Promise((resolve) => setTimeout(resolve, 0)); // 等解码
    drag([10, 10], [400, 300]);
    pickTool("text");
    clickSurface(100, 100);
    textInput().value = "还没按回车";
    textInput().dispatchEvent(new Event("input"));
    (host()!.shadowRoot!.querySelector("[data-shot-save]") as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();
    const op = (copy.mock.calls[0][2] as Ops).list.find((o) => o.kind === "text") as { text: string };
    expect(op.text).toBe("还没按回车");
  });
});
