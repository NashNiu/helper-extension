import { describe, expect, it } from "vitest";
import { chimeNotes } from "./chime";

describe("chimeNotes", () => {
  it("提醒类是上行两音", () => {
    const notes = chimeNotes("reminder");
    expect(notes).toHaveLength(2);
    expect(notes[1].freq).toBeGreaterThan(notes[0].freq);
  });

  it("计时类是下行两音", () => {
    const notes = chimeNotes("timer");
    expect(notes).toHaveLength(2);
    expect(notes[1].freq).toBeLessThan(notes[0].freq);
  });

  it("两种音色用同一组频率,只是顺序相反", () => {
    const r = chimeNotes("reminder").map((n) => n.freq);
    const t = chimeNotes("timer").map((n) => n.freq);
    expect([...t].reverse()).toEqual(r);
  });

  it("第二音在第一音结束前起,叠成叮咚而非两声独立响", () => {
    const [a, b] = chimeNotes("reminder");
    expect(b.start).toBeGreaterThan(0);
    expect(b.start).toBeLessThan(a.start + a.dur);
  });

  it("每个音的时长都为正,频率都在可听范围", () => {
    for (const tone of ["reminder", "timer"] as const) {
      for (const n of chimeNotes(tone)) {
        expect(n.dur).toBeGreaterThan(0);
        expect(n.freq).toBeGreaterThan(200);
        expect(n.freq).toBeLessThan(4000);
      }
    }
  });

  it("总时长不超过 0.7 秒", () => {
    for (const tone of ["reminder", "timer"] as const) {
      const total = Math.max(...chimeNotes(tone).map((n) => n.start + n.dur));
      expect(total).toBeLessThanOrEqual(0.7);
    }
  });
});
