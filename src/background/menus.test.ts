import { describe, expect, it } from "vitest";
import { plannedMenus, CLIP_IMAGE_MENU_ID, SHOT_MENU_ID } from "./menus";

const ALL_ON = { sidePanel: true, contextMenu: true, shortcut: true };

describe("plannedMenus", () => {
  it("截图菜单开启时，两个菜单项都在", () => {
    const ids = plannedMenus("zh-Hans", ALL_ON).map((m) => m.id);
    expect(ids).toContain(CLIP_IMAGE_MENU_ID);
    expect(ids).toContain(SHOT_MENU_ID);
  });

  it("截图菜单关闭时，只剩保存图片那一项", () => {
    const ids = plannedMenus("zh-Hans", { ...ALL_ON, contextMenu: false }).map((m) => m.id);
    expect(ids).toEqual([CLIP_IMAGE_MENU_ID]);
  });

  it("其他两个入口的开关不影响右键菜单", () => {
    const ids = plannedMenus("zh-Hans", { sidePanel: false, contextMenu: true, shortcut: false }).map((m) => m.id);
    expect(ids).toContain(SHOT_MENU_ID);
  });

  it("保存图片项只在图片上下文出现", () => {
    const m = plannedMenus("zh-Hans", ALL_ON).find((x) => x.id === CLIP_IMAGE_MENU_ID)!;
    expect(m.contexts).toEqual(["image"]);
  });

  it("截图项在页面/选中文字/图片/链接上都能出现", () => {
    const m = plannedMenus("zh-Hans", ALL_ON).find((x) => x.id === SHOT_MENU_ID)!;
    expect(m.contexts).toEqual(["page", "selection", "image", "link"]);
  });

  it("标题按 locale 走，英文与中文不同", () => {
    const zh = plannedMenus("zh-Hans", ALL_ON).find((x) => x.id === SHOT_MENU_ID)!.title;
    const en = plannedMenus("en", ALL_ON).find((x) => x.id === SHOT_MENU_ID)!.title;
    expect(zh).toBe("截图");
    expect(en).toBe("Take a screenshot");
  });
});
