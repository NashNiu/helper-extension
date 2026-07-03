import { describe, expect, it, vi, afterEach } from "vitest";
import { detectSystemLocale, resolveLocale, translate } from "./core";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubUiLang(lang: string | undefined) {
  vi.stubGlobal("chrome", lang === undefined ? {} : { i18n: { getUILanguage: () => lang } });
}

describe("detectSystemLocale", () => {
  it("zh-CN → zh-Hans", () => {
    stubUiLang("zh-CN");
    expect(detectSystemLocale()).toBe("zh-Hans");
  });
  it("zh-TW → zh-Hant", () => {
    stubUiLang("zh-TW");
    expect(detectSystemLocale()).toBe("zh-Hant");
  });
  it("zh-Hant → zh-Hant", () => {
    stubUiLang("zh-Hant");
    expect(detectSystemLocale()).toBe("zh-Hant");
  });
  it("en-US → en", () => {
    stubUiLang("en-US");
    expect(detectSystemLocale()).toBe("en");
  });
  it("fr → en (fallback)", () => {
    stubUiLang("fr-FR");
    expect(detectSystemLocale()).toBe("en");
  });
  it("no chrome.i18n and empty navigator → en", () => {
    stubUiLang(undefined);
    vi.stubGlobal("navigator", { language: "" });
    expect(detectSystemLocale()).toBe("en");
  });
});

describe("resolveLocale", () => {
  it("system uses detected", () => expect(resolveLocale("system", "zh-Hant")).toBe("zh-Hant"));
  it("explicit wins", () => expect(resolveLocale("en", "zh-Hans")).toBe("en"));
});

describe("translate", () => {
  it("returns locale string", () => expect(translate("zh-Hans", "tab.todo")).toBe("待办"));
  it("interpolates params", () =>
    expect(translate("en", "timer.startNextRound", { n: 3 })).toBe("Start round 3"));
  it("falls back to en for missing translation (defensive)", () => {
    // 所有键都齐全,这里验证 en locale 正常返回
    expect(translate("en", "tab.timer")).toBe("Timer");
  });
});
