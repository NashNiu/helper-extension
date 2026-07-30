import { remainingSeconds, type ActiveTimer } from "./logic";
import { getActiveTimer } from "../shared/activeTimer";

/** 徒标的完整呈现状态。text 为空串时 Chrome 会隐藏徒标。 */
export interface BadgeState {
  text: string;
  bg: string;
}

// 取自 src/index.css 的设计变量,与产品调色板保持一致。
export const BADGE_WORK = "#b06a52";     // --color-danger,暖色 = 专注
export const BADGE_BREAK = "#2e7d72";    // --color-accent,冷色 = 休息
export const BADGE_PAUSED = "#8a8f99";   // --color-muted
export const BADGE_AWAITING = "#c0392b"; // 唯一跳出柔和调色板的颜色:也是唯一需要用户动手的状态

/** 剩余秒数 → 徒标文字。保证 ≤ 3 字符,不会被 Chrome 挤成不可读。 */
function durationText(sec: number): string {
  const minutes = Math.ceil(sec / 60);
  // 自定义计时的工作时长没有上限(CustomTimerForm 只有 min=1),三位数分钟是可达状态。
  if (minutes >= 100) return `${Math.floor(minutes / 60)}h`;
  // 下界取 1:剩 1 秒也显示「1」,显示「0」会让人以为已经结束。
  return String(Math.max(1, minutes));
}

/**
 * 由计时状态推出徒标该长什么样。纯函数——不碰 chrome API,便于单测。
 *
 * 优先级:awaiting > paused > 阶段颜色。暂停时不看阶段色,到点待确认时不看暂停。
 */
export function badgeFor(timer: ActiveTimer | null, now: number): BadgeState {
  // 空闲:text 为空即隐藏徒标;bg 用不到,但仍返回合法值,免得调用方还要判空。
  if (!timer) return { text: "", bg: BADGE_PAUSED };
  // 到点等用户点「下一步」:剩余已是 0,显示数字没意义,用「!」催一下。
  if (timer.status === "awaiting") return { text: "!", bg: BADGE_AWAITING };
  // 暂停时墙钟还在走,必须用冻结下来的 pausedRemaining(与 logic.ts 的 estimatedEndAt 同一处理)。
  if (timer.status === "paused") {
    return { text: durationText(timer.pausedRemaining ?? 0), bg: BADGE_PAUSED };
  }
  const resting =
    timer.session?.phase === "short_break" || timer.session?.phase === "long_break";
  return {
    text: durationText(remainingSeconds(timer.startAt, timer.durationSeconds, now)),
    bg: resting ? BADGE_BREAK : BADGE_WORK,
  };
}

/**
 * 把当前计时状态刷到工具栏图标上。
 *
 * 纯 read→map→write 胶水,判定逻辑都在 badgeFor 里。徒标只是展示,任何失败只记日志——
 * 绝不能让它把心跳或 alarm 处理搞挂。
 */
export async function refreshBadge(): Promise<void> {
  try {
    const { text, bg } = badgeFor(await getActiveTimer(), Date.now());
    await chrome.action.setBadgeText({ text });
    // 空徒标时没必要再设颜色,少两次无效调用。
    if (text) {
      await chrome.action.setBadgeBackgroundColor({ color: bg });
      await chrome.action.setBadgeTextColor({ color: "#ffffff" });
    }
  } catch (e) {
    console.error("refreshBadge failed", e);
  }
}
