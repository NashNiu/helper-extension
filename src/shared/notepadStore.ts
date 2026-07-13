import { storageGet, storageSet } from "./storage";

export const NOTEPAD_KEY = "helper.notepad";
export const NOTE_MAX_CHARS = 50_000;

export interface NotepadData {
  content: string;
  updatedAt: number;
}

// 纯函数:超出上限时截断,便于单测
export function clampNote(raw: string): string {
  return raw.length > NOTE_MAX_CHARS ? raw.slice(0, NOTE_MAX_CHARS) : raw;
}

export async function getNote(): Promise<NotepadData> {
  const n = await storageGet<Partial<NotepadData>>(NOTEPAD_KEY);
  return {
    content: n && typeof n.content === "string" ? n.content : "",
    updatedAt: n && typeof n.updatedAt === "number" ? n.updatedAt : 0,
  };
}

export async function saveNote(content: string, now: number): Promise<NotepadData> {
  const data: NotepadData = { content: clampNote(content), updatedAt: now };
  await storageSet(NOTEPAD_KEY, data);
  return data;
}
