import { storageGet, storageSet } from "./storage";

export const SOUND_KEY = "helper.sound.enabled";

/**
 * 到时是否响声音。未设置过时默认开——用户装上就该听见,不该先去翻设置。
 * storageGet 把 undefined 归一成 null,所以存过的 false 不会被 ?? 吃掉。
 */
export async function isSoundEnabled(): Promise<boolean> {
  return (await storageGet<boolean>(SOUND_KEY)) ?? true;
}

export async function setSoundEnabled(next: boolean): Promise<void> {
  await storageSet(SOUND_KEY, next);
}
