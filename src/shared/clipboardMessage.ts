import type { ClipItem } from "./clipboardStore";

export const CAPTURE_TEXT = "clipboard/capture-text";

export interface CaptureTextMsg {
  kind: typeof CAPTURE_TEXT;
  text: string;
  source: string;
}

export function buildTextCapture(rawText: string, hostname: string): CaptureTextMsg | null {
  const text = rawText.trim();
  if (!text) return null;
  return { kind: CAPTURE_TEXT, text, source: hostname };
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function makeTextItem(p: { text: string; source: string; id: string; createdAt: number }): ClipItem {
  return { id: p.id, type: "text", text: p.text, source: p.source, createdAt: p.createdAt, pinned: false };
}

export function makeImageItem(p: {
  dataUrl: string;
  bytes: number;
  w: number;
  h: number;
  source: string;
  id: string;
  createdAt: number;
}): ClipItem {
  return {
    id: p.id,
    type: "image",
    dataUrl: p.dataUrl,
    bytes: p.bytes,
    w: p.w,
    h: p.h,
    source: p.source,
    createdAt: p.createdAt,
    pinned: false,
  };
}
