import { storageGet, storageSet } from "./storage";

// 串行化所有写操作:三条捕获通道可能并发写,不排队会互相覆盖丢数据。
let writeTail: Promise<unknown> = Promise.resolve();
function enqueue<T>(op: () => Promise<T>): Promise<T> {
  const run = writeTail.then(op, op);
  writeTail = run.catch(() => {});
  return run;
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 单张图片上限,超出拒绝入库,避免本地存储被撑爆

export const CLIP_ITEMS_KEY = "helper.clipboard.items";
export const CLIP_SETTINGS_KEY = "helper.clipboard.settings";
export const DEFAULT_LIMIT = 100;

export type ClipType = "text" | "image";

export interface ClipItem {
  id: string;
  type: ClipType;
  text?: string;
  dataUrl?: string;
  w?: number;
  h?: number;
  bytes?: number;
  source: string;
  createdAt: number;
  pinned: boolean;
  pinnedAt?: number;
}

export interface ClipSettings {
  limit: number;
}

export interface ClipGroups {
  pinned: ClipItem[];
  today: ClipItem[];
  earlier: ClipItem[];
}

// 去重:新增文字与「最新一条文字」内容相同 → 把那条时间戳更新并移到最前,不新增。图片不去重。
export function dedupe(items: ClipItem[], incoming: ClipItem): ClipItem[] {
  if (incoming.type === "text") {
    const idx = items.findIndex((i) => i.type === "text");
    if (idx !== -1 && items[idx].text === incoming.text) {
      const bumped = { ...items[idx], createdAt: incoming.createdAt };
      return [bumped, ...items.filter((_, i) => i !== idx)];
    }
  }
  return [incoming, ...items];
}

// 自动淘汰:置顶项永不删;非置顶按现有顺序(最新在前)保留前 limit 条,超出删除。
export function cull(items: ClipItem[], limit: number): ClipItem[] {
  const nonPinned = items.filter((i) => !i.pinned);
  const culled = new Set(nonPinned.slice(limit).map((i) => i.id));
  return items.filter((i) => !culled.has(i.id));
}

export function sortForDisplay(items: ClipItem[], now: number): ClipGroups {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const startOfToday = d.getTime();
  const pinned = [...items.filter((i) => i.pinned)].sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0));
  const nonPinned = [...items.filter((i) => !i.pinned)].sort((a, b) => b.createdAt - a.createdAt);
  return {
    pinned,
    today: nonPinned.filter((i) => i.createdAt >= startOfToday),
    earlier: nonPinned.filter((i) => i.createdAt < startOfToday),
  };
}

export function applyPin(items: ClipItem[], id: string, now: number): ClipItem[] {
  return items.map((i) => (i.id === id ? { ...i, pinned: true, pinnedAt: now } : i));
}

export function applyUnpin(items: ClipItem[], id: string): ClipItem[] {
  return items.map((i) => {
    if (i.id !== id) return i;
    const { pinnedAt: _drop, ...rest } = i;
    return { ...rest, pinned: false };
  });
}

export function applyRemove(items: ClipItem[], id: string): ClipItem[] {
  return items.filter((i) => i.id !== id);
}

export async function getItems(): Promise<ClipItem[]> {
  return (await storageGet<ClipItem[]>(CLIP_ITEMS_KEY)) ?? [];
}

export async function setItems(items: ClipItem[]): Promise<void> {
  await storageSet(CLIP_ITEMS_KEY, items);
}

export async function getSettings(): Promise<ClipSettings> {
  const s = await storageGet<ClipSettings>(CLIP_SETTINGS_KEY);
  return s && typeof s.limit === "number" ? s : { limit: DEFAULT_LIMIT };
}

export function addItem(item: ClipItem): Promise<ClipItem[]> {
  return enqueue(async () => {
    const [items, settings] = await Promise.all([getItems(), getSettings()]);
    const next = cull(dedupe(items, item), settings.limit);
    await setItems(next);
    return next;
  });
}

export function setLimit(limit: number): Promise<ClipItem[]> {
  return enqueue(async () => {
    await storageSet(CLIP_SETTINGS_KEY, { limit });
    const next = cull(await getItems(), limit);
    await setItems(next);
    return next;
  });
}

export function pinItem(id: string): Promise<ClipItem[]> {
  return enqueue(async () => {
    const next = applyPin(await getItems(), id, Date.now());
    await setItems(next);
    return next;
  });
}

export function unpinItem(id: string): Promise<ClipItem[]> {
  return enqueue(async () => {
    const next = applyUnpin(await getItems(), id);
    await setItems(next);
    return next;
  });
}

export function removeItem(id: string): Promise<ClipItem[]> {
  return enqueue(async () => {
    const next = applyRemove(await getItems(), id);
    await setItems(next);
    return next;
  });
}
