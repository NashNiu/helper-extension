/** 到时提示音的音色:提醒类上行,计时类下行,听声即可分辨是哪类事件。 */
export type ChimeTone = "reminder" | "timer";

/** 一个音符:freq 为频率(Hz),start 为相对播放起点的秒数,dur 为持续秒数。 */
export interface Note {
  freq: number;
  start: number;
  dur: number;
}

const A5 = 880;
const D6 = 1174.66;

/**
 * 合成「叮咚」的音符时间表。
 *
 * 在 service worker 侧算好再随消息发给离屏播放器——播放器在 public/ 下、
 * 不经打包,无法 import 本模块,所以音符数学必须留在这边(也才测得到)。
 */
export function chimeNotes(tone: ChimeTone): Note[] {
  const [first, second] = tone === "reminder" ? [A5, D6] : [D6, A5];
  return [
    { freq: first, start: 0, dur: 0.28 },
    // 第二音在第一音尾巴上起,两音交叠听起来是一声「叮咚」而非两下。
    { freq: second, start: 0.16, dur: 0.45 },
  ];
}
