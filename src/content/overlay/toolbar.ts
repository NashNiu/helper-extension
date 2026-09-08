import { translate, type Locale } from "../../i18n/core";
import type { MessageKey } from "../../i18n/messages/en";
import { DEFAULT_BRUSH, type BrushSize } from "../../shared/capture/annotate";

export type Tool = "select" | "mosaic";

export interface ToolbarCallbacks {
  onTool(t: Tool): void;
  onBrush(b: BrushSize): void;
  onUndo(): void;
  onCancel(): void;
  onSave(): void;
}

export interface Toolbar {
  el: HTMLElement;
  setTool(t: Tool): void;
  setBrush(b: BrushSize): void;
  setUndoEnabled(on: boolean): void;
  setLocale(loc: Locale): void;
}

const ICONS = {
  select: '<path d="M4 4l7 16 2.5-6.5L20 11z"/>',
  mosaic: '<path d="M3 3h6v6H3zM15 3h6v6h-6zM9 9h6v6H9zM3 15h6v6H3zM15 15h6v6h-6z"/>',
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

export function createToolbar(cb: ToolbarCallbacks): Toolbar {
  let loc: Locale = "en";
  let tool: Tool = "select";
  let brush: BrushSize = DEFAULT_BRUSH;

  const el = document.createElement("div");
  el.className = "toolbar";
  el.setAttribute("data-shot-actions", "");

  const toolBtns: Record<Tool, HTMLButtonElement> = {
    select: iconButton(ICONS.select, true),
    mosaic: iconButton(ICONS.mosaic, true),
  };
  const brushBtns: Record<BrushSize, HTMLButtonElement> = {
    small: iconButton('<circle cx="12" cy="12" r="3"/>', true),
    medium: iconButton('<circle cx="12" cy="12" r="5"/>', true),
    large: iconButton('<circle cx="12" cy="12" r="8"/>', true),
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

  for (const t of ["select", "mosaic"] as const) {
    toolBtns[t].setAttribute("data-tool", t);
    toolBtns[t].addEventListener("click", () => cb.onTool(t));
    el.append(toolBtns[t]);
  }
  for (const b of ["small", "medium", "large"] as const) {
    brushBtns[b].setAttribute("data-brush", b);
    brushBtns[b].addEventListener("click", () => cb.onBrush(b));
    brushes.append(brushBtns[b]);
  }
  el.append(brushes, undoBtn, cancelBtn, saveBtn);

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
    label(brushBtns.small, "shot.brushSmall");
    label(brushBtns.medium, "shot.brushMedium");
    label(brushBtns.large, "shot.brushLarge");
    label(undoBtn, "shot.undo");
    label(cancelBtn, "action.cancel");
    label(saveBtn, "action.save");

    for (const t of ["select", "mosaic"] as const) {
      toolBtns[t].setAttribute("aria-pressed", String(t === tool));
    }
    for (const b of ["small", "medium", "large"] as const) {
      brushBtns[b].setAttribute("aria-pressed", String(b === brush));
    }
    // 笔刷档位只在马赛克工具下有意义,选区工具下露出来只是噪音。
    brushes.style.display = tool === "mosaic" ? "flex" : "none";
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
    setUndoEnabled(on) {
      undoBtn.disabled = !on;
    },
    setLocale(next) {
      loc = next;
      paint();
    },
  };
}
