// 到时提示音播放器。MV3 service worker 没有 AudioContext,声音只能由离屏文档播。
//
// 本文件在 public/ 下、不经打包,所以既不能是 TypeScript、也不能 import src/ 下的
// 模块(crxjs 只从 popup/options/devtools/sandbox/side_panel 这些 manifest 字段发现
// HTML 入口,不认识 offscreen)。音符时间表由 service worker 算好后随消息发来,
// 这里只负责排振荡器——所有逻辑都留在可测的 TS 那边。
const CHIME_MSG = "helper.chime";
const PEAK_GAIN = 0.25;

// 复用同一个 AudioContext:Chrome 对单页面的 AudioContext 数量有上限(约 6 个),
// 每条消息新建一个在连续到点时会撞上限。
let ctx = null;
let closeTimer = null;

function audioCtx() {
  if (!ctx) ctx = new AudioContext();
  // 离屏文档没有用户手势,若被 autoplay 策略挂起就显式恢复。
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function play(notes) {
  const c = audioCtx();
  const t0 = c.currentTime;
  for (const n of notes) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = n.freq;
    const start = t0 + n.start;
    const end = start + n.dur;
    // 指数衰减包络:立刻起音再衰到近无声,听起来像敲一下,而不是持续蜂鸣。
    // 终值不能取 0——exponentialRampToValueAtTime 对 0 无定义。
    gain.gain.setValueAtTime(PEAK_GAIN, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(end);
  }
  // 播完自关闭,不常驻占内存;留 250ms 余量确保尾音放干。
  // 期间又来一条提醒就重置定时器,别把正在响的声音掐断。
  const total = Math.max(...notes.map((n) => n.start + n.dur));
  if (closeTimer !== null) clearTimeout(closeTimer);
  closeTimer = setTimeout(() => window.close(), total * 1000 + 250);
}

// 内容脚本的剪贴板消息也会广播到本页,故必须先按 type 过滤再处理。
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== CHIME_MSG) return;
  if (!Array.isArray(msg.notes) || msg.notes.length === 0) return;
  try {
    play(msg.notes);
  } catch (e) {
    console.error("chime playback failed", e);
  }
});
