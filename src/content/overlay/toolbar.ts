import { translate, type Locale } from "../../i18n/core";
import type { MessageKey } from "../../i18n/messages/en";
import { DEFAULT_BRUSH, DEFAULT_COLOR, OP_COLORS, type BrushSize, type OpColor } from "../../shared/capture/annotate";

export type Tool = "select" | "mosaic" | "rect" | "arrow" | "text";

export interface ToolbarCallbacks {
  onTool(t: Tool): void;
  onBrush(b: BrushSize): void;
  onColor(c: OpColor): void;
  onUndo(): void;
  onCancel(): void;
  onSave(): void;
}

export interface Toolbar {
  el: HTMLElement;
  setTool(t: Tool): void;
  setBrush(b: BrushSize): void;
  setColor(c: OpColor): void;
  setUndoEnabled(on: boolean): void;
  setLocale(loc: Locale): void;
}

const ICONS = {
  select: '<path d="M4 4l7 16 2.5-6.5L20 11z"/>',
  mosaic: '<path d="M3 3h6v6H3zM15 3h6v6h-6zM9 9h6v6H9zM3 15h6v6H3zM15 15h6v6h-6z"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
  arrow: '<path d="M5 19L19 5M19 5h-7M19 5v7"/>',
  text: '<path d="M5 6h14M12 6v13M9 19h6"/>',
  undo: '<path d="M4 10h10a5 5 0 010 10h-6M4 10l4-4M4 10l4 4"/>',
  cancel: '<path d="M6 6l12 12M18 6L6 18"/>',
  save: '<path d="M4 12.5l5.5 5.5L20 7"/>',
};

/** 图标按钮:没有可见文字,所以文案必须同时挂在 aria-label(读屏)和 title(悬停)上。 */
function iconButton(icon: string, filled: boolean): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"
      fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">${icon}</svg>`;
  return b;
}

/** 颜色按钮:圆点直接用该颜色本身,而不是 currentColor——用户要靠它认色。 */
function colorButton(c: OpColor): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <circle cx="12" cy="12" r="7" fill="${OP_COLORS[c]}"/></svg>`;
  return b;
}

const TOOLS = ["select", "mosaic", "rect", "arrow", "text"] as const;
const COLORS = ["red", "yellow", "green", "blue"] as const;

export function createToolbar(cb: ToolbarCallbacks): Toolbar {
  let loc: Locale = "en";
  let tool: Tool = "select";
  let brush: BrushSize = DEFAULT_BRUSH;
  let color: OpColor = DEFAULT_COLOR;

  const el = document.createElement("div");
  el.className = "toolbar";
  el.setAttribute("data-shot-actions", "");

  const toolBtns: Record<Tool, HTMLButtonElement> = {
    select: iconButton(ICONS.select, true),
    mosaic: iconButton(ICONS.mosaic, true),
    rect: iconButton(ICONS.rect, false),
    arrow: iconButton(ICONS.arrow, false),
    text: iconButton(ICONS.text, false),
  };
  const brushBtns: Record<BrushSize, HTMLButtonElement> = {
    small: iconButton('<circle cx="12" cy="12" r="3"/>', true),
    medium: iconButton('<circle cx="12" cy="12" r="5"/>', true),
    large: iconButton('<circle cx="12" cy="12" r="8"/>', true),
  };
  const colorBtns: Record<OpColor, HTMLButtonElement> = {
    red: colorButton("red"),
    yellow: colorButton("yellow"),
    green: colorButton("green"),
    blue: colorButton("blue"),
  };
  const undoBtn = iconButton(ICONS.undo, false);
  const cancelBtn = iconButton(ICONS.cancel, false);
  const saveBtn = iconButton(ICONS.save, false);

  undoBtn.setAttribute("data-undo", "");
  cancelBtn.setAttribute("data-shot-cancel", "");
  saveBtn.setAttribute("data-shot-save", "");
  cancelBtn.className = "cancel";
  saveBtn.className = "save";

  const brushes = document.createElement("span");
  brushes.setAttribute("data-brushes", "");
  brushes.className = "group";

  const colors = document.createElement("span");
  colors.setAttribute("data-colors", "");
  colors.className = "group";

  for (const t of TOOLS) {
    toolBtns[t].setAttribute("data-tool", t);
    toolBtns[t].addEventListener("click", () => cb.onTool(t));
    el.append(toolBtns[t]);
  }
  for (const b of ["small", "medium", "large"] as const) {
    brushBtns[b].setAttribute("data-brush", b);
    brushBtns[b].addEventListener("click", () => cb.onBrush(b));
    brushes.append(brushBtns[b]);
  }
  for (const c of COLORS) {
    colorBtns[c].setAttribute("data-color", c);
    colorBtns[c].addEventListener("click", () => cb.onColor(c));
    colors.append(colorBtns[c]);
  }
  el.append(brushes, colors, undoBtn, cancelBtn, saveBtn);

  undoBtn.addEventListener("click", () => cb.onUndo());
  cancelBtn.addEventListener("click", () => cb.onCancel());
  saveBtn.addEventListener("click", () => cb.onSave());

  function label(btn: HTMLElement, key: MessageKey): void {
    const text = translate(loc, key);
    btn.setAttribute("aria-label", text);
    btn.setAttribute("title", text);
  }

  function paint(): void {
    label(toolBtns.select, "shot.toolSelect");
    label(toolBtns.mosaic, "shot.toolMosaic");
    label(toolBtns.rect, "shot.toolRect");
    label(toolBtns.arrow, "shot.toolArrow");
    label(toolBtns.text, "shot.toolText");
    label(colorBtns.red, "shot.colorRed");
    label(colorBtns.yellow, "shot.colorYellow");
    label(colorBtns.green, "shot.colorGreen");
    label(colorBtns.blue, "shot.colorBlue");
    label(brushBtns.small, "shot.brushSmall");
    label(brushBtns.medium, "shot.brushMedium");
    label(brushBtns.large, "shot.brushLarge");
    label(undoBtn, "shot.undo");
    label(cancelBtn, "action.cancel");
    label(saveBtn, "action.save");

    for (const t of TOOLS) toolBtns[t].setAttribute("aria-pressed", String(t === tool));
    for (const c of COLORS) colorBtns[c].setAttribute("aria-pressed", String(c === color));
    for (const b of ["small", "medium", "large"] as const) {
      brushBtns[b].setAttribute("aria-pressed", String(b === brush));
    }
    // 粗细同时是笔刷、线宽和字号,四个绘制工具下都有意义;只有选区工具纯取景,
    // 露出来是噪音。与下面颜色行的显隐是同一条原则。
    brushes.style.display = tool === "select" ? "none" : "flex";
    // 颜色只对三个绘制工具有意义,选区和马赛克下露出来只是噪音。
    colors.style.display = tool === "rect" || tool === "arrow" || tool === "text" ? "flex" : "none";
  }

  undoBtn.disabled = true;
  paint();

  return {
    el,
    setTool(t) {
      tool = t;
      paint();
    },
    setBrush(b) {
      brush = b;
      paint();
    },
    setColor(c) {
      color = c;
      paint();
    },
    setUndoEnabled(on) {
      undoBtn.disabled = !on;
    },
    setLocale(next) {
      loc = next;
      paint();
    },
  };
}
