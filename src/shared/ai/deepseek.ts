export type AiErrorKind = "auth" | "rate" | "network" | "bad_output";

export class AiError extends Error {
  kind: AiErrorKind;
  constructor(kind: AiErrorKind, message?: string) {
    super(message ?? kind);
    this.name = "AiError";
    this.kind = kind;
  }
}

export type AnalyzedItem =
  | { type: "reminder"; message: string; trigger_at: string }
  | { type: "timer"; name: string; duration_seconds: number }
  | { type: "todo"; content: string };

export type KeyStatus = "valid" | "invalid" | "network_error";

const ENDPOINT = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** 本地时区 ISO 字符串(带偏移),让模型据此换算相对时间。 */
export function localIsoWithOffset(d: Date): string {
  const offMin = -d.getTimezoneOffset();
  const sign = offMin >= 0 ? "+" : "-";
  const abs = Math.abs(offMin);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

function systemPrompt(now: Date): string {
  return [
    "你把用户的一句话解析成结构化任务,可能包含多个意图。",
    `当前时间: ${localIsoWithOffset(now)}。相对时间(如"明天9点""25分钟后")据此换算成绝对时间。`,
    '只输出 JSON,形如 {"items":[...]}。每个 item 为下列之一:',
    '{"type":"reminder","message":"提醒正文(去掉时间词)","trigger_at":"带时区的ISO8601,如 2026-07-08T09:00:00+08:00,须晚于当前时间"}',
    '{"type":"timer","name":"计时名(默认 计时)","duration_seconds":正整数秒}',
    '{"type":"todo","content":"待办文本"}',
    '无法识别为提醒或计时的内容作为 todo。没有任何意图时输出 {"items":[]}。除 JSON 外不要输出任何文字。',
  ].join("\n");
}

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
}

function mapStatus(res: Response): void {
  if (res.status === 401 || res.status === 403) throw new AiError("auth");
  if (res.status === 429) throw new AiError("rate");
  if (!res.ok) throw new AiError("network", `HTTP ${res.status}`);
}

function coerceItems(raw: unknown, now: Date): AnalyzedItem[] {
  if (typeof raw !== "object" || raw === null) throw new AiError("bad_output");
  const arr = (raw as { items?: unknown }).items;
  if (!Array.isArray(arr)) throw new AiError("bad_output");
  const seen = new Set<string>();
  const out: AnalyzedItem[] = [];
  for (const it of arr) {
    if (typeof it !== "object" || it === null) continue;
    const o = it as Record<string, unknown>;
    if (o.type === "reminder") {
      if (seen.has("reminder")) continue;
      if (typeof o.message !== "string" || typeof o.trigger_at !== "string") continue;
      const d = new Date(o.trigger_at);
      if (isNaN(d.getTime()) || d.getTime() <= now.getTime()) continue;
      seen.add("reminder");
      out.push({ type: "reminder", message: o.message.trim(), trigger_at: d.toISOString() });
    } else if (o.type === "timer") {
      if (seen.has("timer")) continue;
      const secs = typeof o.duration_seconds === "number" ? Math.round(o.duration_seconds) : NaN;
      if (!Number.isFinite(secs) || secs <= 0) continue;
      seen.add("timer");
      const name = typeof o.name === "string" && o.name.trim() ? o.name.trim() : "计时";
      out.push({ type: "timer", name, duration_seconds: secs });
    } else if (o.type === "todo") {
      if (seen.has("todo")) continue;
      if (typeof o.content !== "string" || !o.content.trim()) continue;
      seen.add("todo");
      out.push({ type: "todo", content: o.content.trim() });
    }
  }
  return out;
}

export async function analyzeWithDeepseek(
  input: string,
  now: Date,
  key: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AnalyzedItem[]> {
  let res: Response;
  try {
    res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt(now) },
          { role: "user", content: input },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 512,
        stream: false,
      }),
    });
  } catch {
    throw new AiError("network");
  }
  mapStatus(res);
  let data: ChatResponse;
  try {
    data = (await res.json()) as ChatResponse;
  } catch {
    throw new AiError("bad_output");
  }
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new AiError("bad_output");
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AiError("bad_output");
  }
  return coerceItems(parsed, now);
}

export async function validateKey(
  key: string,
  fetchImpl: typeof fetch = fetch,
): Promise<KeyStatus> {
  try {
    const res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        stream: false,
      }),
    });
    if (res.ok) return "valid";
    if (res.status === 401 || res.status === 403) return "invalid";
    return "network_error";
  } catch {
    return "network_error";
  }
}
