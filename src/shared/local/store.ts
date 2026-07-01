import { storageGet, storageSet } from "../storage";

/** 从本地存储读取一个数组;不存在时返回空数组。 */
export async function readList<T>(key: string): Promise<T[]> {
  return (await storageGet<T[]>(key)) ?? [];
}

export function writeList<T>(key: string, list: T[]): Promise<void> {
  return storageSet(key, list);
}

/** 生成下一个本地自增 id(现有最大 id + 1,空表从 1 开始)。 */
export function nextId(list: { id: number }[]): number {
  return list.reduce((max, x) => Math.max(max, x.id), 0) + 1;
}
