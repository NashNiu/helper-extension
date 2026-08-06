export async function storageGet<T>(key: string): Promise<T | null> {
  const result = await chrome.storage.local.get(key);
  const value = result[key];
  return value === undefined ? null : (value as T);
}

/**
 * 批量读取:一次 chrome.storage.local.get 拿回多个键,而不是每个键各发一次调用。
 * 用于像 hydrate() 这样「给一页列表逐条补数据」的场景——键数固定,批量后就是常数次 IPC
 * 而不是随列表长度线性增长。返回值按传入的 key 索引,缺失的键按 storageGet 同样的
 * 规则归一成 null(而不是 undefined),调用方不用对两种读法区分处理。
 *
 * 空 keys 列表直接返回 {},不发起调用——调用方(比如没有任何图片键要读的场景)不该为
 * 「什么都不用读」这件事付一次 IPC 的代价,也没有必要为它单独绕过这个函数。
 */
export async function storageGetMany<T>(keys: string[]): Promise<Record<string, T | null>> {
  if (keys.length === 0) return {};
  const result = await chrome.storage.local.get(keys);
  const out: Record<string, T | null> = {};
  for (const key of keys) {
    const value = result[key];
    out[key] = value === undefined ? null : (value as T);
  }
  return out;
}

export async function storageSet(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function storageRemove(key: string): Promise<void> {
  await chrome.storage.local.remove(key);
}
