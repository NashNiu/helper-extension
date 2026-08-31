import { storageGet, storageSet } from "./storage";

export const SHOT_ENTRIES_KEY = "helper.screenshot.entries";

/** 三个截图入口。startCapture 用它区分来源,好按开关分别放行。 */
export type ShotSource = "sidePanel" | "contextMenu" | "shortcut";

export interface ShotEntries {
  sidePanel: boolean;
  contextMenu: boolean;
  shortcut: boolean;
}

/** 默认三个都开:装上就能用,不该先去设置里翻开关(与 soundSettings 的取向一致)。 */
export const DEFAULT_ENTRIES: ShotEntries = { sidePanel: true, contextMenu: true, shortcut: true };

/**
 * 逐字段用 ?? 补默认值,而不是整体 ?? DEFAULT_ENTRIES:老版本存下的对象可能缺字段
 * (以后加第四个入口时必然如此),整体兜底会让缺的字段变成 undefined,在
 * `if (!entries.x)` 这类判断里被静默当成关闭。
 */
export async function getEntries(): Promise<ShotEntries> {
  const raw = await storageGet<Partial<ShotEntries>>(SHOT_ENTRIES_KEY);
  return {
    sidePanel: raw?.sidePanel ?? DEFAULT_ENTRIES.sidePanel,
    contextMenu: raw?.contextMenu ?? DEFAULT_ENTRIES.contextMenu,
    shortcut: raw?.shortcut ?? DEFAULT_ENTRIES.shortcut,
  };
}

export async function setEntry(source: ShotSource, on: boolean): Promise<void> {
  const current = await getEntries();
  await storageSet(SHOT_ENTRIES_KEY, { ...current, [source]: on });
}

export async function isEntryEnabled(source: ShotSource): Promise<boolean> {
  return (await getEntries())[source];
}
