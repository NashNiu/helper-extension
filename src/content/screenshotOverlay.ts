import { normalizeRect, isTooSmall, toBitmapRect, type Rect } from "../shared/capture/rect";
import {
  bitmapScale,
  brushRadius,
  DEFAULT_BRUSH,
  DEFAULT_COLOR,
  effectiveList,
  emptyHistory,
  emptyOps,
  fontSize,
  hasMosaic,
  hitTest,
  lineWidth,
  nextOpId,
  pushOp,
  record,
  replaceOp,
  rewind,
  canUndo,
  toBitmapPt,
  type BrushSize,
  type Draft,
  type History,
  type MosaicOp,
  type Op,
  type OpColor,
  type Ops,
  type Pt,
  type TextOp,
} from "../shared/capture/annotate";
import { measureText, pixelateCrop, renderAnnotated } from "../shared/capture/render";
import { SHOW_OVERLAY, type ShowOverlayMsg } from "../shared/capture/messages";
import { translate, type Locale } from "../i18n/core";
import { currentLocale } from "../shared/locale";
import { createToolbar, type Tool } from "./overlay/toolbar";
import { createTextEditor } from "./overlay/textEditor";

export const OVERLAY_ID = "helper-shot-overlay";

/** 按钮条的高度与它离选区的间距,只用于判断选区下方放不放得下。
 * 5px 内边距 × 2 + 26px 按钮 = 36,和 .toolbar 的实际渲染高度对齐——量小了会导致
 * 「贴下方」判定得过晚,按钮条在不该露出来的地方戳出视口。 */
const ACTIONS_H = 36;
const ACTIONS_GAP = 8;

/**
 * 裁剪 + 合成标注 + 写系统剪贴板。抽成参数是为了在测试里替换掉 canvas 与剪贴板
 * 这两个不可测的依赖。位图由覆盖层解码并持有,这里只用不放。
 */
export type CopyFn = (bmp: ImageBitmap, r: Rect, ops: Ops) => Promise<void>;

interface Live {
  host: HTMLElement;
  prevOverflow: string;
  onKey: (e: KeyboardEvent) => void;
  onWindowMouseUp: (e: MouseEvent) => void;
  /** 已解码的底图。预览与保存共用同一份,避免出现两个像素来源。 */
  bmp: ImageBitmap | null;
}

let live: Live | null = null;

export function hideOverlay(): void {
  if (!live) return;
  document.removeEventListener("keydown", live.onKey, true);
  window.removeEventListener("mouseup", live.onWindowMouseUp);
  live.bmp?.close();
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
      .toolbar {
        position: absolute; display: none; gap: 6px; align-items: center;
        padding: 5px 7px; border-radius: 8px;
        background: rgba(28, 28, 30, 0.92); box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
      }
      .toolbar .group { display: flex; gap: 4px; }
      .toolbar button {
        all: unset; box-sizing: border-box; cursor: pointer;
        width: 26px; height: 26px; border-radius: 5px;
        display: flex; align-items: center; justify-content: center; color: #fff;
      }
      .toolbar button:hover { background: rgba(255, 255, 255, 0.14); }
      .toolbar button[aria-pressed="true"] { background: rgba(255, 255, 255, 0.22); }
      .toolbar button:disabled { opacity: 0.35; cursor: default; }
      .toolbar button:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }
      /* 取消用红、保存用扩展主题色(src/index.css 的 --color-accent: #2e7d72)。
         这两个色值是上一次改动刚定下来的,不要换回蓝色——内容脚本在 shadow DOM 里
         拿不到面板的 CSS 变量,只能写死,改主题色时这里要跟着改。 */
      .toolbar .cancel { background: rgba(178, 38, 38, 0.94); }
      .toolbar .cancel:hover { background: rgba(198, 52, 52, 0.96); }
      .toolbar .save { background: #2e7d72; }
      .toolbar .save:hover { background: #35908a; }
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

  let tool: Tool = "select";
  let brush: BrushSize = DEFAULT_BRUSH;
  // 当前选中的颜色。矩形/箭头/文字构造 RectOp/ArrowOp/TextOp 时读取它。
  let color: OpColor = DEFAULT_COLOR;

  const toolbar = createToolbar({
    onTool: (t) => {
      tool = t;
      toolbar.setTool(t);
      refreshPreview();
    },
    onBrush: (b) => {
      brush = b;
      toolbar.setBrush(b);
    },
    onColor: (c) => {
      color = c;
      toolbar.setColor(c);
    },
    onUndo: () => doUndo(),
    onCancel: () => hideOverlay(),
    onSave: () => commit(),
  });
  const actions = toolbar.el;
  surface.append(actions);

  // 预览画布。只在马赛克工具下、且有待定选区时挂在 surface 上——选区工具下
  // 或者还没框选时,它整个不在 DOM 里,而不只是 display:none:那时用户看的
  // 就该是原始底图,连一个隐藏的画布痕迹都不该留。
  const preview = document.createElement("canvas");
  preview.setAttribute("data-shot-preview", "");
  preview.style.cssText = "position:absolute;display:none;pointer-events:none;";

  /** 没有可预览的东西:把画布从 DOM 里摘掉。remove() 对未挂载的节点是安全的空操作。 */
  function hidePreview(): void {
    preview.remove();
  }

  // 像素化版本只依赖底图与裁剪矩形,所以按选区缓存;涂抹时只重画蒙版,不重算它。
  let pixCache: { key: string; canvas: HTMLCanvasElement } | null = null;

  function cropRect(r: Rect): Rect | null {
    const bmp = live?.bmp;
    if (!bmp) return null;
    const b = toBitmapRect(r, bitmapScale(bmp.width, window.innerWidth), bmp.width, bmp.height);
    return b.w === 0 || b.h === 0 ? null : b;
  }

  /**
   * 重画预览。渲染失败(取不到 2d 上下文等)只隐藏预览,绝不把覆盖层带崩。
   *
   * 只看「有没有待定选区和底图」,不看当前工具——选区工具下也必须画,因为笔迹是
   * 按位图坐标存的,切回选区工具只是换个取景框,已经画的马赛克并不会消失,
   * 保存时还是会连它一起存下来。预览要是被工具切换隐藏,用户就会在看不见马赛克
   * 的情况下把带马赛克的图存下去——这正是这套架构要杜绝的「所见非所得」。
   *
   * draft:正在拖拽、还没落进 ops 里的那一笔(见下面 mousemove 的实时重画),
   * 只用于渲染,不写回 ops——手一松才由 endDrag 正式 pushOp。
   */
  function refreshPreview(draft?: Draft): void {
    const bmp = live?.bmp;
    if (!pending || !bmp) {
      hidePreview();
      return;
    }
    const b = cropRect(pending);
    if (!b) {
      hidePreview();
      return;
    }
    // 画布的挂载与尺寸只取决于选区,跟下面的渲染成败无关——先摆好,再去尝试画,
    // 这样即使画布是空的(比如 happy-dom 测试环境根本拿不到 2d 上下文),
    // 挂载状态和尺寸计算依然是正确、可验证的。
    // 插在 .sel 前面而不是 append 到最后:DOM 序决定层叠顺序,预览要是叠在
    // .sel/.size/工具栏上面,选区的白边框、尺寸标签和按钮条就都被它盖住了——
    // 插在最前面,让 .sel 的边框、.size 的标签和工具栏都保持在预览之上。
    surface.insertBefore(preview, sel);
    // CSS 尺寸贴合选区(屏幕像素),后备存储是位图分辨率(见下面 preview.width/height)——
    // 这就是预览既清晰又与输出同源的原因。
    preview.style.left = `${pending.x}px`;
    preview.style.top = `${pending.y}px`;
    preview.style.width = `${pending.w}px`;
    preview.style.height = `${pending.h}px`;
    try {
      const list = effectiveList(ops, draft);
      const key = `${b.x},${b.y},${b.w},${b.h}`;
      if (hasMosaic(list)) {
        if (pixCache?.key !== key) pixCache = { key, canvas: pixelateCrop(bmp, b) };
      }
      // 与保存路径同一个 renderAnnotated——预览就是最终图像本身,只是缩小显示,
      // 不是另起一套近似绘制,这样用户看到的和存下来的才不会走样。
      const out = renderAnnotated(bmp, b, ops, pixCache?.canvas ?? document.createElement("canvas"), draft);
      const ctx = preview.getContext("2d");
      if (!ctx) throw new Error("2d context unavailable");
      preview.width = out.width;
      preview.height = out.height;
      ctx.drawImage(out, 0, 0);
      preview.style.display = "block";
    } catch (e) {
      console.error("preview render failed", e);
      // 渲染失败时也要走 hidePreview(),而不是只改 display:none——不然预览画布
      // 会作为一个隐藏节点留在 DOM 里,违背「没得可预览就整个摘掉」的约定。
      hidePreview();
    }
  }

  /** 所有对 ops 的变更都必须走这里,否则那一步就撤销不回来。 */
  function mutate(next: Ops): void {
    history = record(history, ops);
    ops = next;
    afterOpsChanged();
  }

  /** 操作列表变了就同步撤销按钮——按钮亮着却没东西可撤,比禁用更让人困惑。 */
  function afterOpsChanged(): void {
    toolbar.setUndoEnabled(canUndo(history));
    refreshPreview();
  }

  function doUndo(): void {
    const back = rewind(history);
    if (!back) return; // 空历史上撤销是无操作,不该有任何副作用
    history = back.history;
    ops = back.ops;
    afterOpsChanged();
  }

  // 语言只需要交给工具栏自己重绘一次,这里不必再留一份 loc——copyRegion 保存时
  // 会自己另外读一次 currentLocale(),两边互不依赖。
  void currentLocale()
    .then((l) => {
      toolbar.setLocale(l);
    })
    .catch(() => {});
  // 用 style 赋值而不是写进 innerHTML:dataUrl 很长,拼进模板串既难读又容易被
  // 里面的引号打断。
  surface.style.backgroundImage = `url("${dataUrl}")`;

  // 是否已经进入「点了保存,正在拷贝」的阶段。一旦为 true,位图的所有权就从
  // 覆盖层转到这次 commit 手里:live.bmp 会被同步清空,hideOverlay 摸不到它,
  // 解码回填也不会再把它塞回去——不然 copy 还在用位图画布时,一次 Esc 或者
  // 又一次截图触发的 hideOverlay 会把它关掉,copy 里的 drawImage 就会因为
  // 位图已 detach 而抛错,保存悄悄退化成一句「复制失败」。
  let committing = false;

  // showOverlay 必须同步(遮罩要立刻出现),但解码是异步的。先把覆盖层挂出去,
  // 位图解好再回填。保存路径会 await 这个 promise,所以不存在「还没解完就保存」。
  const bmpReady = fetch(dataUrl)
    .then((res) => res.blob())
    .then((blob) => createImageBitmap(blob))
    .then((decoded) => {
      // 解码期间用户可能已经取消并重新截图了,那时 live 已经换人,这份要就地丢掉。
      if (live?.host !== host) {
        decoded.close();
        return null;
      }
      // 已经在保存路径上:位图归 commit 所有,这里不能再把它挂回 live.bmp,
      // 否则一次晚到的 hideOverlay 会把 copy 正用着的位图关掉。
      if (!committing) {
        live.bmp = decoded;
        // 解码是异步的,用户完全可能在它落地前就已经框好选区、切到马赛克工具——
        // 那时 refreshPreview 已经因为 bmp 还是 null 而跑过一次并隐藏了预览,
        // 之后没有别的东西会再触发它。这里晚到的一次赋值必须自己顺手补一次重画,
        // 否则预览会一直空着、涂抹也会因为拿不到 bmp 而静默丢笔迹,直到用户
        // 恰好再切一次工具才碰巧刷新。
        refreshPreview();
      }
      return decoded;
    })
    .catch((e) => {
      // 位图现在是保存路径的前提,解不出来连原图都存不了。与其让用户对着一个
      // 点保存没反应的覆盖层发愣,不如立刻说明并收场。
      console.error("decode screenshot failed", e);
      if (live?.host === host) {
        void currentLocale()
          .catch(() => "en" as Locale)
          .then((l) => showToast(translate(l, "shot.copyFailed"), false));
        hideOverlay();
      }
      return null;
    });

  let start: { x: number; y: number } | null = null;
  // 正在涂抹的这一笔。与 start 分开:选区拖动只需要起点,涂抹要留住整条轨迹。
  let painting: Pt[] | null = null;
  // 正在拖的矩形/箭头的起点(CSS 坐标)。与 start 分开:start 是取景,这个是画标注。
  let shapeStart: { x: number; y: number } | null = null;
  // 已框好、等用户点保存的选区。null 表示还没框(或刚被取消/重新开拖)。
  let pending: Rect | null = null;
  // 标注操作列表。Task 4 起才会被写入,现在恒为空——但保存路径已经把它传下去了。
  let ops: Ops = emptyOps();
  let history: History = emptyHistory();

  const editor = createTextEditor(root, {
    onChange: () => refreshPreview(editor.draft() ?? undefined),
    onCommit: (d) => {
      const op = d.op as TextOp;
      if (d.replacesId === null) {
        // 什么都没打就定稿:不留下一条看不见的空文字。
        if (op.text !== "") mutate(pushOp(ops, op));
        else refreshPreview();
      } else {
        // 清空内容 = 删掉这条。replaceOp 的第三个参数传 null 即为删除。
        mutate(replaceOp(ops, d.replacesId, op.text === "" ? null : op));
      }
    },
  }, (p) => ({ x: Math.round(p.x / scaleNow()), y: Math.round(p.y / scaleNow()) }));
  surface.append(editor.el);

  /** 当前的位图/CSS 比例。拿不到位图时退回 1。 */
  function scaleNow(): number {
    const bmp = live?.bmp;
    return bmp ? bitmapScale(bmp.width, window.innerWidth) : 1;
  }

  /** 开始编辑一条文字。begin 返回 false 表示没拿到焦点,当作什么都没发生。 */
  function beginText(op: TextOp, replacesId: string | null): void {
    if (!editor.begin(op, replacesId)) return;
    refreshPreview(editor.draft() ?? undefined);
  }

  // 按在已有文字上、还没松手。moved 一旦为真就按「拖动」处理,否则松手时进入编辑。
  let textDown: { op: TextOp; at: Pt; moved: boolean } | null = null;

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
    hidePreview();
  }
  // 立刻把隐藏写成内联样式。样式表里那条 display:none 只负责「JS 还没跑到时别闪一下」,
  // 之后按钮的显隐一律由内联样式说了算——两个地方各管一半,迟早对不上。
  clearPending();

  /** 用户确认保存:把待定选区交给 copy,拷完拆除覆盖层。 */
  function commit(): void {
    // 点保存时可能还在输入:先把那条文字定稿,否则它会被整个丢掉。
    if (editor.isEditing()) editor.commit();
    if (!pending) return;
    // 重入守卫:拷贝进行中(committing === true)时,位图已经交出去了,live.bmp
    // 是 null。再次点保存(或者 Enter 又被触发一次)不该再跑一遍——第二次的
    // renderAnnotated 会在一个可能已经 detach 的位图上作画,静默退化成「复制失败」。
    if (committing) return;
    const r = pending;
    // ops 必须在这里原地快照:下面 committing=true 之后、bmpReady 的 .then 真正
    // 读到 ops 之前还隔着至少一次微任务。这段窗口期里键盘事件仍能触发撤销——例如
    // 撤销按钮 Enter 激活的 click 和 document 的 keydown 处理器同一个任务里前后
    // 触发,后者已经 commit() 过了。如果直接闭包读 ops,读到的就是被截胡后缩短的
    // 那一份;拍成快照传下去,才是用户点保存那一刻真正看到的操作列表。
    const opsAtCommit = ops;
    clearPending();
    // 记下发起这次拷贝时「当前」是哪个覆盖层:copy 是异步的,等它跑完时用户可能
    // 已经又触发了一次截图,live 换成了新的覆盖层。这里只能拆自己发起时的那个,
    // 不能无脑拆「此刻的」live,否则会把刚出现的新覆盖层拆掉。
    const mine = live;
    // 把位图的所有权从覆盖层挪到这次 commit:同步置位、同步清空 live.bmp,
    // 中间不隔一次 await——不然 committing 置位和 live.bmp 清空之间如果被
    // 别的同步代码插一脚,窗口虽然极窄也终究是窗口。清空之后,不管保存过程中
    // 发生几次 hideOverlay(用户按 Esc、又触发一次截图……),都碰不到这个位图。
    committing = true;
    if (live?.host === host) live.bmp = null;
    // 真正交给 copy 的那份位图引用,只在 finally 里关一次——bmpReady 本身可能
    // 因为「覆盖层已经换人」解析成 null(见上面的解码分支),这时压根没有位图
    // 可关,bmpForCommit 就保持 null。
    let bmpForCommit: ImageBitmap | null = null;
    void bmpReady
      .then((bmp) => {
        if (!bmp) return; // 覆盖层已经换人,这次保存作废
        bmpForCommit = bmp;
        return copy(bmp, r, opsAtCommit);
      })
      .catch(() => {}) // 失败的提示由 copy 自己弹 toast;这里吞掉避免未处理的 rejection
      .finally(() => {
        // 位图现在只在这一处关闭:上面已经把它从 live 摘掉,hideOverlay 早就够
        // 不到它了,所以这里关一次、且只会关这一次——不会跟 hideOverlay 撞车。
        bmpForCommit?.close();
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

  /**
   * 把一次形状拖拽转成 op。拿不到位图(还没解码完)或者太小就返回 null,由调用方丢掉。
   *
   * 坐标在这里就换算成位图坐标——与 endDrag 落定时完全一致,渲染阶段不再考虑缩放。
   */
  function shapeOpFrom(origin: { x: number; y: number }, toX: number, toY: number): Op | null {
    const bmp = live?.bmp;
    if (!bmp) return null;
    const scale = bitmapScale(bmp.width, window.innerWidth);
    if (tool === "rect") {
      const css = normalizeRect(origin.x, origin.y, toX, toY);
      if (isTooSmall(css)) return null; // 误点不该留下一个看不见的框
      return {
        kind: "rect",
        id: nextOpId(),
        r: {
          x: Math.round(css.x * scale),
          y: Math.round(css.y * scale),
          w: Math.round(css.w * scale),
          h: Math.round(css.h * scale),
        },
        color,
        width: lineWidth(brush, scale),
      };
    }
    if (tool === "arrow") {
      const from = toBitmapPt(origin, scale);
      const to = toBitmapPt({ x: toX, y: toY }, scale);
      // 起终点重合画不出方向,当误点丢掉。
      if (from.x === to.x && from.y === to.y) return null;
      return { kind: "arrow", id: nextOpId(), from, to, color, width: lineWidth(brush, scale) };
    }
    return null;
  }

  // 结束拖拽的公共逻辑:既被 surface 自身的 mouseup 调用,也被下面 window 级的
  // 兜底监听调用。「先判空、再置空 start、才使用它」保证两边都收到同一次松开时
  // 不会被处理两次——第二次进来 start 已经是 null,直接短路。
  function endDrag(clientX: number, clientY: number): void {
    if (painting) {
      painting.push({ x: clientX, y: clientY });
      const bmp = live?.bmp;
      if (bmp) {
        // 收集的是 CSS 坐标,存进操作列表前立刻换算成位图坐标——之后渲染就不必再考虑缩放。
        const scale = bitmapScale(bmp.width, window.innerWidth);
        const s: MosaicOp = {
          kind: "mosaic",
          id: nextOpId(),
          points: painting.map((p) => toBitmapPt(p, scale)),
          radius: brushRadius(brush, scale),
        };
        mutate(pushOp(ops, s));
      }
      painting = null;
      return;
    }
    if (shapeStart) {
      const op = shapeOpFrom(shapeStart, clientX, clientY);
      shapeStart = null;
      if (op) mutate(pushOp(ops, op));
      else refreshPreview(); // 丢掉这一笔,把预览恢复成没有草稿的样子
      return;
    }
    if (textDown) {
      const down = textDown;
      textDown = null;
      const p = toBitmapPt({ x: clientX, y: clientY }, scaleNow());
      if (down.moved) {
        // 拖动:只挪位置,不进编辑。
        const at = { x: down.op.at.x + (p.x - down.at.x), y: down.op.at.y + (p.y - down.at.y) };
        mutate(replaceOp(ops, down.op.id, { ...down.op, at }));
      } else {
        // 原地松手 = 想改这条字。
        beginText(down.op, down.op.id);
      }
      return;
    }
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
    refreshPreview();
  }

  surface.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return; // 右键留给取消
    // 拷贝进行中:位图已经交给 commit,live.bmp 是 null。这时开始新的框选或涂抹,
    // 涂抹会因为 bmp 拿不到而在 endDrag 里默默把这一笔丢掉、框选会显示一个预览
    // 不了了之的选区——两种体验都是「悄悄失败」,不如干脆连拖拽都不让开始。
    if (committing) return;
    if (tool === "mosaic" && pending) {
      // 马赛克工具下拖动是涂抹,不动选区。没有选区时不该能涂——涂到哪儿都不会被保存。
      painting = [{ x: e.clientX, y: e.clientY }];
      e.preventDefault();
      return;
    }
    if ((tool === "rect" || tool === "arrow") && pending) {
      shapeStart = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }
    if (tool === "text" && pending) {
      e.preventDefault();
      // 已经在编辑:这一下点击先把上一条定稿,再决定要不要开新的。
      if (editor.isEditing()) editor.commit();
      const s = scaleNow();
      const p = toBitmapPt({ x: e.clientX, y: e.clientY }, s);
      const hit = hitTest(ops.list, p, measureText);
      if (hit) {
        // 按在已有文字上:现在还分不清是想拖动还是想改字,等松手看有没有位移。
        textDown = { op: hit, at: p, moved: false };
        return;
      }
      beginText(
        { kind: "text", id: nextOpId(), at: p, text: "", color, fontPx: fontSize(brush, s) },
        null,
      );
      return;
    }
    // 重新开拖 = 对上一个选区不满意。先把工具栏收起来,否则它会悬在半空挡着新选区。
    clearPending();
    start = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  });

  // 涂抹时按帧重画,而不是每个 mousemove 都重画:renderAnnotated 每次调用都要
  // 分配三张裁剪尺寸的画布,一个接近全屏的选区上逐 mousemove 同步重画会明显卡顿。
  // pixelateCrop 那份缓存已经解决了「像素化底图」的重算问题,这里用 rAF 把「合成
  // 蒙版」这一步也限到每帧最多一次——多余的中间点被丢弃,不会丢的是最后一次。
  let paintRaf: number | null = null;
  function schedulePaintPreview(): void {
    if (paintRaf !== null) return;
    paintRaf = requestAnimationFrame(() => {
      paintRaf = null;
      // 排队等到这一帧才发现拖拽已经结束(painting 已被 endDrag 置空):那次
      // 重画交给 endDrag 里的 afterOpsChanged() 负责,这里直接跳过,避免拿一份
      // 过期的部分轨迹去重画一次没有意义的帧。
      if (!painting) return;
      const bmp = live?.bmp;
      if (!bmp) return;
      // 正在拖的这一笔还没定稿、没进 ops,但预览必须现在就看得见——不然「画面
      // 就是要保存的东西」这条约定在拖拽过程中会被打破。换算方式和 endDrag 落定
      // 时完全一致,只是这里的结果只用于渲染,不写回 ops。
      const scale = bitmapScale(bmp.width, window.innerWidth);
      const s: MosaicOp = {
        kind: "mosaic",
        id: nextOpId(),
        points: painting.map((p) => toBitmapPt(p, scale)),
        radius: brushRadius(brush, scale),
      };
      refreshPreview({ op: s, replacesId: null });
    });
  }

  surface.addEventListener("mousemove", (e) => {
    if (painting) {
      painting.push({ x: e.clientX, y: e.clientY });
      schedulePaintPreview();
      return;
    }
    if (shapeStart) {
      const op = shapeOpFrom(shapeStart, e.clientX, e.clientY);
      // 太小还画不出东西时传 undefined,预览就是干净的底图——比画一个瞬间闪现的
      // 零尺寸框好。
      refreshPreview(op ? { op, replacesId: null } : undefined);
      return;
    }
    if (textDown) {
      const p = toBitmapPt({ x: e.clientX, y: e.clientY }, scaleNow());
      if (!textDown.moved && p.x === textDown.at.x && p.y === textDown.at.y) return;
      textDown.moved = true;
      const at = {
        x: textDown.op.at.x + (p.x - textDown.at.x),
        y: textDown.op.at.y + (p.y - textDown.at.y),
      };
      refreshPreview({ op: { ...textDown.op, at }, replacesId: textDown.op.id });
      return;
    }
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

  // 工具栏浮在 surface 上方,mousedown 会冒泡到上面那个「开始框选」的监听器。不拦住的话,
  // 点任何一个工具按钮都会先把选区重置成一个 0×0 的新起点,选区当场消失,工具栏也
  // 跟着收起来。
  actions.addEventListener("mousedown", (e) => e.stopPropagation());

  surface.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    hideOverlay();
  });

  const onKey = (e: KeyboardEvent) => {
    // 正在输入文字:Esc/Enter/Ctrl+Z 都归那个 input,覆盖层不插手。编辑器自己会
    // stopPropagation,但它绑在 input 上、这里绑在 document 捕获阶段——捕获先于
    // 目标,所以必须在这里显式让位,否则 Enter 会顺带保存整张截图。
    if (editor.isEditing()) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      hideOverlay();
      return;
    }
    // Ctrl/Cmd+Z 与点撤销按钮完全等价,走同一个入口。
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.stopPropagation();
      e.preventDefault();
      doUndo();
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
  live = { host, prevOverflow, onKey, onWindowMouseUp, bmp: null };
}

/**
 * 用传统 execCommand 把图片写进剪贴板。返回是否写成了。
 *
 * 选区跨不进 Shadow DOM,所以承载图片的临时节点只能挂在页面自己的 body 上,
 * 不能放进覆盖层的 shadow root。
 */
async function copyViaExecCommand(canvas: HTMLCanvasElement): Promise<boolean> {
  const sel = window.getSelection();
  if (!sel) return false;

  // 定位到视口外并全透明:既能参与选区,又不会闪一下给用户看见,position:fixed
  // 也保证它不撑大文档、不影响滚动位置。
  const holder = document.createElement("div");
  holder.contentEditable = "true";
  holder.setAttribute("style", "position:fixed;top:0;left:-9999px;opacity:0;pointer-events:none;");
  const img = document.createElement("img");
  img.src = canvas.toDataURL("image/png");
  holder.appendChild(img);
  document.body.appendChild(holder);

  // 用户在页面上本来可能选着东西,复制完要原样还回去。
  const saved: Range[] = [];
  for (let i = 0; i < sel.rangeCount; i++) saved.push(sel.getRangeAt(i));

  try {
    // 图片没解码完就复制,剪贴板里会只剩一个 <img> 标签而没有位图。
    await img.decode();
    const range = document.createRange();
    range.selectNode(img);
    sel.removeAllRanges();
    sel.addRange(range);
    return document.execCommand("copy");
  } finally {
    holder.remove();
    sel.removeAllRanges();
    for (const r of saved) sel.addRange(r);
  }
}

/**
 * 把渲染好的截图写进系统剪贴板。返回是否写成了。
 *
 * 首选异步 Clipboard API——它写的是纯 image/png,粘贴质量最好。但
 * navigator.clipboard 和 ClipboardItem 都是 [SecureContext] 接口,内容脚本跑在
 * http:// 页面上时这两个东西压根不存在(不是调用失败,是属性为 undefined)。
 * 那种页面退回 execCommand("copy"):它不受安全上下文限制,靠 manifest 里的
 * clipboardWrite 权限,代价是剪贴板里会多一份 text/html 的 <img> 备选格式,
 * 少数编辑器可能取那一份而不是位图。
 */
async function writeImageToClipboard(canvas: HTMLCanvasElement, blob: Blob): Promise<boolean> {
  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    // 只能写 image/png:Chrome 的 ClipboardItem 只稳定支持这一种图片类型。
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  }
  return copyViaExecCommand(canvas);
}

export async function copyRegion(bmp: ImageBitmap, r: Rect, ops: Ops): Promise<void> {
  // 语言设置读取失败(最典型的是扩展重载/更新导致 context invalidated)不该拖累
  // 后面的提示——退回英文也远好过一声不吭,这个函数存在的意义就是让用户知道结果。
  let loc: Locale = "en";
  try {
    loc = await currentLocale();
  } catch {
    /* 忽略:上面已经决定了退回英文 */
  }
  try {
    const scale = bitmapScale(bmp.width, window.innerWidth);
    const b = toBitmapRect(r, scale, bmp.width, bmp.height);
    if (b.w === 0 || b.h === 0) return; // 选区完全落在图外,当取消,不提示
    // 没有马赛克是最常见的情形(框完选区直接保存,没碰马赛克工具)。renderAnnotated
    // 在列表里没有 mosaic 时根本不看 pix 参数,但 pixelateCrop 本身要分配两张
    // 裁剪尺寸的画布并做一次缩小再放大——4K 截图上这是几十 MB 的白费功夫。
    // 只在真有马赛克时才算它,空画布当占位符,反正用不上。
    const pix = hasMosaic(ops.list) ? pixelateCrop(bmp, b) : document.createElement("canvas");
    const canvas = renderAnnotated(bmp, b, ops, pix);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("toBlob returned null");
    const ok = await writeImageToClipboard(canvas, blob);
    // 两条路都没写成不是「失焦」——那句「点一下页面再试」在这里只会把人带偏。
    showToast(translate(loc, ok ? "shot.copied" : "shot.copyUnavailable"), ok);
  } catch (e) {
    // 最常见的原因是文档失焦——Clipboard API 要求文档处于聚焦态。
    console.error("copyRegion failed", e);
    showToast(translate(loc, "shot.copyFailed"), false);
  }
  // 注意:这里不再 bmp.close()。位图归覆盖层持有,由 hideOverlay 释放——
  // 保存之后覆盖层还要用它重画,提前关掉会让画布变空白。
}

// 加载期只注册一个监听器,别的什么都不做——这个脚本跑在每一个页面上。
// 加 typeof 守卫是因为单测里会 import 这个模块,那里没有 chrome。
if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((msg: ShowOverlayMsg) => {
    if (msg && msg.kind === SHOW_OVERLAY) showOverlay(msg.dataUrl, copyRegion);
  });
}
