import { translate, type Locale } from "../i18n/core";
import { currentLocale } from "../shared/locale";
import { getEntries, type ShotEntries } from "../shared/captureSettings";

export const CLIP_IMAGE_MENU_ID = "helper-clip-image";
export const SHOT_MENU_ID = "helper-shot";

export interface MenuSpec {
  id: string;
  title: string;
  contexts: chrome.contextMenus.ContextType[];
}

/**
 * 纯函数:给定语言和入口开关,算出「此刻应该存在哪些菜单项」。
 *
 * 单独抽出来是因为 contextMenus 只能整体 removeAll + 重建(没有单项开关 API),
 * 而「该有哪些项」才是真正需要测的逻辑。
 */
export function plannedMenus(loc: Locale, entries: ShotEntries): MenuSpec[] {
  const menus: MenuSpec[] = [
    { id: CLIP_IMAGE_MENU_ID, title: translate(loc, "clip.menuSaveImage"), contexts: ["image"] },
  ];
  if (entries.contextMenu) {
    menus.push({
      id: SHOT_MENU_ID,
      title: translate(loc, "shot.menuTitle"),
      contexts: ["page", "selection", "image", "link"],
    });
  }
  return menus;
}

/**
 * 把菜单同步成 plannedMenus 的样子。所有菜单注册都必须走这里——
 * removeAll 会清掉全部菜单项,分散在多个模块里各注册各的会互相抹掉。
 */
export async function syncMenus(): Promise<void> {
  const loc = await currentLocale();
  const entries = await getEntries();
  const specs = plannedMenus(loc, entries);
  await new Promise<void>((resolve) => {
    chrome.contextMenus.removeAll(() => {
      for (const s of specs) {
        chrome.contextMenus.create({ id: s.id, title: s.title, contexts: s.contexts });
      }
      resolve();
    });
  });
}
