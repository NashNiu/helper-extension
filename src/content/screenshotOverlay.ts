import { normalizeRect, isTooSmall, toBitmapRect, type Rect } from "../shared/capture/rect";
import { SHOW_OVERLAY, type ShowOverlayMsg } from "../shared/capture/messages";
import { translate, type Locale } from "../i18n/core";
import { currentLocale } from "../shared/locale";

export const OVERLAY_ID = "helper-shot-overlay";

/** 裁剪 + 写系统剪贴板。抽成参数是为了在测试里替换掉 canvas 与剪贴板这两个不可测的依赖。 */
export type CopyFn = (dataUrl: string, r: Rect) => Promise<void>;

interface Live {
  host: HTMLElement;
  prevOverflow: string;
  onKey: (e: KeyboardEvent) => void;
  onWindowMouseUp: (e: MouseEvent) => void;
}

let live: Live | null = null;

export function hideOverlay(): void {
  if (!live) return;
  document.removeEventListener("keydown", live.onKey, true);
  window.removeEventListener("mouseup", live.onWindowMouseUp);
  live.host.remove();
  document.documentElement.style.overflow = live.prevOverflow;
  live = null;
}

export const TOAST_ID = "helper-shot-toast";
const TOAST_MS = 2000;

let toastTimer: ReturnType<typeof setTimeout> | null = null;

/** 页内轻提示。同样用 Shadow DOM 隔离,并且始终只保留一个,避免连点叠成一摞。 */
export function showToast(text: string, ok: boolean): void {
  document.getElementById(TOAST_ID)?.remove();
  if (toastTimer) clearTimeout(toastTimer);

  const host = document.createElement("div");
  host.id = TOAST_ID;
  host.style.cssText =
    "all: initial; position: fixed; left: 0; right: 0; bottom: 32px; z-index: 2147483647; pointer-events: none;";
  const root = host.attachShadow({ mode: "open" });
  const bg = ok ? "rgba(20, 20, 20, 0.88)" : "rgba(178, 38, 38, 0.94)";
  root.innerHTML = `
    <div style="display:flex;justify-content:center;">
      <span style="padding:8px 14px;border-radius:999px;background:${bg};color:#fff;
                   font:13px system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,0.25);"></span>
    </div>
  `;
  // 用 textContent 而不是拼进模板串:文案来自 i18n,不该走 HTML 解析。
  root.querySelector("span")!.textContent = text;
  document.documentElement.appendChild(host);
  toastTimer = setTimeout(() => {
    document.getElementById(TOAST_ID)?.remove();
    toastTimer = null;
  }, TOAST_MS);
}

/**
 * 铺出冻结截图并进入框选。
 *
 * 底图是「已经截好的」可见区域,所以显示期间必须锁滚动:页面一滚,底图与真实内容
 * 就错位,用户框到的和看到的不是一块地方。
 *
 * 用 Shadow DOM 装内容:页面自身的 CSS(尤其是 * 选择器和对 img/div 的全局规则)
 * 会把覆盖层搅乱,shadow root 是唯一可靠的隔离手段。
 */
export function showOverlay(dataUrl: string, copy: CopyFn): void {
  hideOverlay(); // 重复触发时先拆旧的,保证任意时刻只有一个覆盖层

  const host = document.createElement("div");
  host.id = OVERLAY_ID;
  host.style.cssText = "all: initial; position: fixed; inset: 0; z-index: 2147483647;";
  const root = host.attachShadow({ mode: "open" });

  root.innerHTML = `
    <style>
      :host { all: initial; }
      .surface {
        position: fixed; inset: 0; cursor: crosshair; overflow: hidden;
        background-size: 100% 100%; background-repeat: no-repeat;
      }
      .mask { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.45); }
      .sel {
        position: absolute; display: none; box-sizing: border-box;
        border: 1px solid #fff; box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.45);
      }
      .size {
        position: absolute; display: none; padding: 2px 6px; border-radius: 4px;
        background: rgba(0, 0, 0, 0.75); color: #fff; font: 12px system-ui, sans-serif;
        white-space: nowrap; pointer-events: none;
      }
    </style>
    <div class="surface" data-shot-surface>
      <div class="mask" data-shot-mask></div>
      <div class="sel" data-shot-sel></div>
      <div class="size" data-shot-size></div>
    </div>
  `;

  const surface = root.querySelector<HTMLElement>("[data-shot-surface]")!;
  const mask = root.querySelector<HTMLElement>("[data-shot-mask]")!;
  const sel = root.querySelector<HTMLElement>("[data-shot-sel]")!;
  const size = root.querySelector<HTMLElement>("[data-shot-size]")!;
  // 用 style 赋值而不是写进 innerHTML:dataUrl 很长,拼进模板串既难读又容易被
  // 里面的引号打断。
  surface.style.backgroundImage = `url("${dataUrl}")`;

  let start: { x: number; y: number } | null = null;

  function paint(r: Rect): void {
    // 选区自己的 box-shadow 已经压暗四周了,两层遮罩叠加会过黑。
    mask.style.display = "none";
    sel.style.display = "block";
    sel.style.left = `${r.x}px`;
    sel.style.top = `${r.y}px`;
    sel.style.width = `${r.w}px`;
    sel.style.height = `${r.h}px`;
    size.style.display = "block";
    size.style.left = `${r.x}px`;
    size.style.top = `${Math.max(0, r.y - 22)}px`;
    size.textContent = `${r.w} × ${r.h}`;
  }

  // 结束拖拽的公共逻辑:既被 surface 自身的 mouseup 调用,也被下面 window 级的
  // 兜底监听调用。「先判空、再置空 start、才使用它」保证两边都收到同一次松开时
  // 不会被处理两次——第二次进来 start 已经是 null,直接短路。
  function endDrag(clientX: number, clientY: number): void {
    if (!start) return;
    const r = normalizeRect(start.x, start.y, clientX, clientY);
    start = null;
    if (isTooSmall(r)) {
      hideOverlay(); // 点一下不拖 = 想取消
      return;
    }
    // 记下发起这次拷贝时「当前」是哪个覆盖层:copy 是异步的,等它跑完时用户可能
    // 已经又触发了一次截图,live 换成了新的覆盖层。这里只能拆自己发起时的那个,
    // 不能无脑拆「此刻的」live,否则会把刚出现的新覆盖层拆掉。
    const mine = live;
    // 不在这里算缩放比:真正的比例要拿解码后的位图宽度才知道,由 copy 内部计算。
    void copy(dataUrl, r)
      .catch(() => {}) // 失败也要拆除;结果提示留给 Task 8,这里先吞掉避免出现未处理的 rejection
      .finally(() => {
        if (live === mine) hideOverlay();
      });
  }

  surface.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return; // 右键留给取消
    start = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  });

  surface.addEventListener("mousemove", (e) => {
    if (!start) return;
    paint(normalizeRect(start.x, start.y, e.clientX, e.clientY));
  });

  surface.addEventListener("mouseup", (e) => endDrag(e.clientX, e.clientY));

  // 松开鼠标时光标可能已经在浏览器窗口外(标签栏、系统菜单、另一块屏幕):那样
  // surface 收不到 mouseup,start 会一直挂着,鼠标回到页面内时选框会在没按键的
  // 情况下跟着光标继续漂移。用 window 兜底保证拖拽总有个终点。原生鼠标事件默认
  // composed,会从 surface 冒泡穿过 shadow 边界到 window,所以两边都能收到同一次
  // 松开——由 endDrag 的判空顺序保证不会被处理两次。
  const onWindowMouseUp = (e: MouseEvent) => endDrag(e.clientX, e.clientY);
  window.addEventListener("mouseup", onWindowMouseUp);

  surface.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    hideOverlay();
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      hideOverlay();
    }
  };
  // 捕获阶段绑在 document 上:页面自己可能在冒泡阶段吞掉 Esc。
  document.addEventListener("keydown", onKey, true);

  const prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";
  document.documentElement.appendChild(host);
  live = { host, prevOverflow, onKey, onWindowMouseUp };
}

/** 真实的裁剪 + 写剪贴板,并把结果(成功/失败)用 toast 告诉用户。 */
export async function copyRegion(dataUrl: string, r: Rect): Promise<void> {
  // 语言设置读取失败(最典型的是扩展重载/更新导致 context invalidated)不该拖累
  // 后面的提示——退回英文也远好过一声不吭,这个函数存在的意义就是让用户知道结果。
  let loc: Locale = "en";
  try {
    loc = await currentLocale();
  } catch {
    /* 忽略:上面已经决定了退回英文 */
  }
  try {
    const res = await fetch(dataUrl);
    const bmp = await createImageBitmap(await res.blob());
    try {
      // 实测比例:多屏/页面缩放/系统缩放下 devicePixelRatio 与真实截图尺寸对不上。
      const scale = window.innerWidth > 0 ? bmp.width / window.innerWidth : 1;
      const b = toBitmapRect(r, scale, bmp.width, bmp.height);
      if (b.w === 0 || b.h === 0) return; // 选区完全落在图外,当取消,不提示
      const canvas = document.createElement("canvas");
      canvas.width = b.w;
      canvas.height = b.h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("2d context unavailable");
      ctx.drawImage(bmp, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("toBlob returned null");
      // 只能写 image/png:Chrome 的 ClipboardItem 只稳定支持这一种图片类型。
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      showToast(translate(loc, "shot.copied"), true);
    } finally {
      bmp.close();
    }
  } catch (e) {
    // 最常见的原因是文档失焦——Clipboard API 要求文档处于聚焦态。
    console.error("copyRegion failed", e);
    showToast(translate(loc, "shot.copyFailed"), false);
  }
}

// 加载期只注册一个监听器,别的什么都不做——这个脚本跑在每一个页面上。
// 加 typeof 守卫是因为单测里会 import 这个模块,那里没有 chrome。
if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((msg: ShowOverlayMsg) => {
    if (msg && msg.kind === SHOW_OVERLAY) showOverlay(msg.dataUrl, copyRegion);
  });
}
