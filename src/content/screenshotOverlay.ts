import { normalizeRect, isTooSmall, toBitmapRect, type Rect } from "../shared/capture/rect";
import { SHOW_OVERLAY, type ShowOverlayMsg } from "../shared/capture/messages";
import { translate, type Locale } from "../i18n/core";
import { currentLocale } from "../shared/locale";

export const OVERLAY_ID = "helper-shot-overlay";

/** 按钮条的高度与它离选区的间距,只用于判断选区下方放不放得下。 */
const ACTIONS_H = 30;
const ACTIONS_GAP = 8;

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
      .actions { position: absolute; display: none; gap: 8px; }
      .actions button {
        all: unset; box-sizing: border-box; cursor: pointer;
        width: 28px; height: 28px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        color: #fff; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
        transition: transform 0.08s ease;
      }
      .actions button:hover { transform: scale(1.08); }
      .actions button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
      /* 取消用红、保存用扩展主题色(src/index.css 的 --color-accent: #2e7d72)。
         内容脚本跑在 shadow DOM 里,拿不到面板那套 CSS 变量,只能写死值——
         哪天改主题色,这里得跟着改。红色沿用 showToast 报错的同一族色,
         免得同一个覆盖层里冒出两种不一样的红。 */
      .actions .cancel { background: rgba(178, 38, 38, 0.94); }
      .actions .cancel:hover { background: rgba(198, 52, 52, 0.96); }
      .actions .save { background: #2e7d72; }
      .actions .save:hover { background: #35908a; }
    </style>
    <div class="surface" data-shot-surface>
      <div class="mask" data-shot-mask></div>
      <div class="sel" data-shot-sel></div>
      <div class="size" data-shot-size></div>
      <div class="actions" data-shot-actions>
        <button type="button" class="cancel" data-shot-cancel>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <button type="button" class="save" data-shot-save>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 12.5l5.5 5.5L20 7" />
          </svg>
        </button>
      </div>
    </div>
  `;

  const surface = root.querySelector<HTMLElement>("[data-shot-surface]")!;
  const mask = root.querySelector<HTMLElement>("[data-shot-mask]")!;
  const sel = root.querySelector<HTMLElement>("[data-shot-sel]")!;
  const size = root.querySelector<HTMLElement>("[data-shot-size]")!;
  const actions = root.querySelector<HTMLElement>("[data-shot-actions]")!;
  const saveBtn = root.querySelector<HTMLElement>("[data-shot-save]")!;
  const cancelBtn = root.querySelector<HTMLElement>("[data-shot-cancel]")!;

  // showOverlay 必须同步(它跑在消息回调里,晚一拍遮罩就慢一拍),而读语言是异步的。
  // 所以先按英文渲染,拿到设置后再回填:按钮真正露面要等用户拖完选区,那时候这次
  // storage 读取早就回来了,不会看到文案跳变。读失败就一直是英文——有按钮可点,
  // 远好过为了等文案把整个覆盖层卡住。
  let loc: Locale = "en";
  // 按钮里只有图标没有文字,所以文案得挂在 aria-label(读屏的可访问名)和 title
  // (鼠标悬停提示)上。两者缺一:少了 aria-label 读屏只会念出「按钮」,少了 title
  // 用户就得靠猜图标含义。svg 上标了 aria-hidden,免得它把可访问名搅乱。
  function paintLabels(): void {
    for (const [btn, key] of [
      [saveBtn, "action.save"],
      [cancelBtn, "action.cancel"],
    ] as const) {
      const text = translate(loc, key);
      btn.setAttribute("aria-label", text);
      btn.setAttribute("title", text);
    }
  }
  paintLabels();
  void currentLocale()
    .then((l) => {
      loc = l;
      paintLabels();
    })
    .catch(() => {});
  // 用 style 赋值而不是写进 innerHTML:dataUrl 很长,拼进模板串既难读又容易被
  // 里面的引号打断。
  surface.style.backgroundImage = `url("${dataUrl}")`;

  let start: { x: number; y: number } | null = null;
  // 已框好、等用户点保存的选区。null 表示还没框(或刚被取消/重新开拖)。
  let pending: Rect | null = null;

  /** 把按钮条贴到选区右下角外侧;下方放不下就收进选区内部,免得按钮跑到视口外点不到。 */
  function placeActions(r: Rect): void {
    actions.style.display = "flex";
    const below = r.y + r.h + ACTIONS_GAP;
    const fitsBelow = below + ACTIONS_H <= window.innerHeight;
    actions.style.top = `${fitsBelow ? below : Math.max(0, r.y + r.h - ACTIONS_H - ACTIONS_GAP)}px`;
    // 右对齐到选区右边缘:用 right 而不是 left,按钮条不用知道自己有多宽。
    actions.style.left = "auto";
    actions.style.right = `${Math.max(0, window.innerWidth - (r.x + r.w))}px`;
  }

  function clearPending(): void {
    pending = null;
    actions.style.display = "none";
  }
  // 立刻把隐藏写成内联样式。样式表里那条 display:none 只负责「JS 还没跑到时别闪一下」,
  // 之后按钮的显隐一律由内联样式说了算——两个地方各管一半,迟早对不上。
  clearPending();

  /** 用户确认保存:把待定选区交给 copy,拷完拆除覆盖层。 */
  function commit(): void {
    if (!pending) return;
    const r = pending;
    clearPending();
    // 记下发起这次拷贝时「当前」是哪个覆盖层:copy 是异步的,等它跑完时用户可能
    // 已经又触发了一次截图,live 换成了新的覆盖层。这里只能拆自己发起时的那个,
    // 不能无脑拆「此刻的」live,否则会把刚出现的新覆盖层拆掉。
    const mine = live;
    // 不在这里算缩放比:真正的比例要拿解码后的位图宽度才知道,由 copy 内部计算。
    void copy(dataUrl, r)
      .catch(() => {}) // 失败的提示由 copy 自己弹 toast;这里吞掉避免未处理的 rejection
      .finally(() => {
        if (live === mine) hideOverlay();
      });
  }

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
    // 松手不再直接写剪贴板,而是把选区停在这里等用户确认。写入改到「点保存」那一刻,
    // 对剪贴板反而更稳:按钮点击本身就是一次全新的用户手势,而且此刻页面必然聚焦
    // (用户刚点了页面里的按钮),Clipboard API 的两个前提都自然满足。
    pending = r;
    placeActions(r);
  }

  surface.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return; // 右键留给取消
    // 重新开拖 = 对上一个选区不满意。先把按钮收起来,否则它会悬在半空挡着新选区。
    clearPending();
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

  // 按钮浮在 surface 上方,mousedown 会冒泡到上面那个「开始框选」的监听器。不拦住的话,
  // 点保存的那一下会先把选区重置成一个 0×0 的新起点,保存下去的就不是用户框的东西了。
  actions.addEventListener("mousedown", (e) => e.stopPropagation());
  saveBtn.addEventListener("click", () => commit());
  cancelBtn.addEventListener("click", () => hideOverlay());

  surface.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    hideOverlay();
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      hideOverlay();
      return;
    }
    // Enter 等同于点保存,但只在已经框好、正等确认时才算数——没有选区时按回车
    // 应该什么都不发生,而不是拆掉覆盖层或存一张空图。
    if (e.key === "Enter" && pending) {
      e.stopPropagation();
      commit();
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
