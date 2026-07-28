import { chimeNotes, type ChimeTone } from "../shared/chime";
import { isSoundEnabled } from "../shared/soundSettings";

// public/ 下的文件被原样拷到扩展根目录,故这里是根相对路径。
const OFFSCREEN_PATH = "offscreen.html";
const CHIME_MSG = "helper.chime";

// 串行化离屏文档的创建:心跳可能在同一批唤醒里触发多条提醒,并发调 createDocument
// 会让第二个调用抛「Only a single offscreen document may be created」。
let createTail: Promise<void> = Promise.resolve();

async function ensureOffscreen(): Promise<void> {
  const run = createTail.then(async () => {
    if (await chrome.offscreen.hasDocument()) return;
    try {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_PATH,
        reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
        justification: "Play a short chime when a reminder or timer is due.",
      });
    } catch (e) {
      // 播放器播完会自关闭,hasDocument 与 createDocument 之间存在窗口期;
      // 撞上「已存在」说明恰好是我们想要的状态,忽略即可。
      if (!String(e).includes("Only a single offscreen document")) throw e;
    }
  });
  createTail = run.catch(() => {});
  return run;
}

/**
 * 到时播放提示音。
 *
 * 声音是附加物:关掉开关时连离屏文档都不建,任何失败也只记日志。
 * 调用方一律 `void playChime(...)`,不要 await——绝不能让它挡住通知横幅。
 */
export async function playChime(tone: ChimeTone): Promise<void> {
  try {
    if (!(await isSoundEnabled())) return;
    await ensureOffscreen();
    await chrome.runtime.sendMessage({ type: CHIME_MSG, notes: chimeNotes(tone) });
  } catch (e) {
    console.error("playChime failed", e);
  }
}
