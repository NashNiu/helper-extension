import type { Draft, Pt, TextOp } from "../../shared/capture/annotate";

export interface TextEditorCallbacks {
  /** 草稿变了(内容或位置),调用方应当重画预览。 */
  onChange(): void;
  /** 定稿。空内容也会回调——删不删由调用方决定,编辑器不替它做主。 */
  onCommit(draft: Draft): void;
}

export interface TextEditor {
  el: HTMLInputElement;
  /** 开始编辑。返回 false 表示没能拿到焦点,草稿已丢弃,调用方应当当作什么都没发生。 */
  begin(op: TextOp, replacesId: string | null): boolean;
  commit(): void;
  isEditing(): boolean;
  draft(): Draft | null;
}

/**
 * 文字输入的承载体。
 *
 * input 视觉上完全隐藏:它只负责接键盘,以及给输入法候选框提供一个锚点位置
 * (所以它的定位必须跟着文字走,不能扔在角落)。文字和光标一律由画布绘制——
 * DOM 字体度量和 canvas 字体度量对不上,若让 input 显示文字,定稿那一刻文字
 * 会轻微跳动。
 */
export function createTextEditor(
  root: ShadowRoot,
  cb: TextEditorCallbacks,
  /** 位图坐标 → CSS 坐标。编辑器不该知道缩放这回事,但 input 的定位只认 CSS 像素。 */
  toCss: (p: Pt) => Pt,
): TextEditor {
  const el = document.createElement("input");
  el.type = "text";
  el.setAttribute("data-shot-text-input", "");
  // 透明且无边框,但**不能**用 display:none / visibility:hidden——那样它拿不到焦点,
  // 输入法也没了锚点。宽高留 1px 是为了让输入法候选框贴着文字弹出来。
  el.setAttribute(
    "style",
    "position:absolute;width:1px;height:1px;padding:0;border:0;outline:0;background:transparent;color:transparent;caret-color:transparent;font-size:16px;",
  );
  // 必须挂进 shadow root 才能拿到焦点——脱离文档树的元素无论如何 focus() 都成不了
  // activeElement,这不是 happy-dom 的特例,是 DOM 规范本身的行为。
  root.appendChild(el);

  /** at 是位图坐标,input 要 CSS 坐标。全模块只此一处换算。 */
  function place(at: Pt): void {
    const c = toCss(at);
    el.style.left = `${c.x}px`;
    el.style.top = `${c.y}px`;
  }

  let current: Draft | null = null;
  // 输入法组字期间的 Enter 是在选候选字,不是定稿。
  let composing = false;

  function sync(): void {
    if (!current) return;
    current = {
      ...current,
      op: { ...(current.op as TextOp), text: el.value },
      caret: el.selectionStart ?? el.value.length,
    };
    cb.onChange();
  }

  el.addEventListener("input", sync);
  // 方向键、Home/End、鼠标拖选都会挪动 selectionStart 但不触发 input——不补这一句,
  // 光标就只在下一次真正敲字时才跟着挪对,这之前画布画的插入点跟真实的对不上。
  el.addEventListener("keyup", sync);
  el.addEventListener("compositionstart", () => {
    composing = true;
  });
  el.addEventListener("compositionend", () => {
    composing = false;
    sync();
  });
  // 失焦即定稿:规格要求「点别处/切工具/点保存」都要先定稿再执行原动作,而这三个
  // 场景的共同点是焦点会被移出这个 input——工具栏按钮、画布、保存按钮的 mousedown
  // 默认行为都会抢走焦点。与其在覆盖层里给每个回调分别补一句 editor.commit(),
  // 不如在这里一次性接住 blur,天然覆盖全部三条路径,也不会漏掉将来新增的按钮。
  // commit() 自己也会调 el.blur() 来清掉焦点,那会同步再派发一次 blur——此时
  // current 已经被 commit() 置空,下面这次重入调用会在 commit() 的头一行短路,
  // 不会二次回调 onCommit。
  el.addEventListener("blur", () => commit());
  el.addEventListener("keydown", (e) => {
    if (composing) return;
    if (e.key === "Enter" || e.key === "Escape") {
      // 这两行**挡不住**覆盖层的全局处理器看到 Enter/Esc:那个处理器绑在
      // document 的捕获阶段,捕获先于目标,这里在目标阶段(input 上)调用的
      // stopPropagation() 物理上不可能抢在它前面。真正挡住「Enter 顺带保存/
      // Esc 顺带关闭覆盖层」的,是覆盖层 onKey 开头那句
      // `if (editor.isEditing()) return;`。
      // 这两行剩下的价值是:挡住页面自己在冒泡阶段挂的快捷键,以及挡表单提交——
      // 仍然值得留着,只是不能再指望它们拦住覆盖层。
      e.stopPropagation();
      e.preventDefault();
      commit();
    }
  });

  function begin(op: TextOp, replacesId: string | null): boolean {
    // 复位组字标记:若上一次编辑的输入法组字没收到 compositionend 就被打断
    // (概率很低,但确实会发生),composing 会一直停在 true,导致这次新编辑的
    // Esc/Enter 全部失灵。begin() 是每次编辑会话的起点,在这里清零最保险。
    composing = false;
    current = { op, replacesId, caret: op.text.length };
    el.value = op.text;
    // 位置跟着文字走,输入法候选框才会贴着文字弹,而不是飘到页面角落。
    place(op.at);
    el.focus();
    // 极少数页面会抢焦点。那时与其留一个永远定不了稿的草稿,不如当作什么都没发生。
    // 判据必须是 root.activeElement:input 在 shadow DOM 里,document.activeElement
    // 返回的是 shadow 宿主元素,永远等不到 input。
    if (root.activeElement !== el) {
      current = null;
      return false;
    }
    el.setSelectionRange(el.value.length, el.value.length);
    return true;
  }

  function commit(): void {
    if (!current) return;
    const done = current;
    current = null;
    el.value = "";
    el.blur();
    cb.onCommit(done);
  }

  return {
    el,
    begin,
    commit,
    isEditing: () => current !== null,
    draft: () => current,
  };
}
