import { storageGet, storageSet, storageRemove } from "../storage";

export const DEEPSEEK_KEY_STORAGE_KEY = "helper.deepseek.key";

export async function getKey(): Promise<string> {
  return (await storageGet<string>(DEEPSEEK_KEY_STORAGE_KEY)) ?? "";
}

export async function setKey(key: string): Promise<void> {
  await storageSet(DEEPSEEK_KEY_STORAGE_KEY, key);
}

export async function clearKey(): Promise<void> {
  await storageRemove(DEEPSEEK_KEY_STORAGE_KEY);
}
