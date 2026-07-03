import { en, type MessageKey } from "./messages/en";
import { zhHans } from "./messages/zh-Hans";
import { zhHant } from "./messages/zh-Hant";

export type Locale = "zh-Hans" | "zh-Hant" | "en";
export type LocalePref = "system" | Locale;

export const LOCALE_KEY = "helper.locale";

const DICTS: Record<Locale, Record<MessageKey, string>> = {
  en,
  "zh-Hans": zhHans,
  "zh-Hant": zhHant,
};

function rawUiLanguage(): string {
  try {
    if (typeof chrome !== "undefined" && chrome.i18n?.getUILanguage) {
      return chrome.i18n.getUILanguage() || "";
    }
  } catch {
    /* ignore */
  }
  if (typeof navigator !== "undefined" && navigator.language) return navigator.language;
  return "";
}

export function detectSystemLocale(): Locale {
  const lang = rawUiLanguage().toLowerCase();
  if (lang.startsWith("zh")) {
    return /tw|hk|mo|hant/.test(lang) ? "zh-Hant" : "zh-Hans";
  }
  if (lang.startsWith("en")) return "en";
  return "en";
}

export function resolveLocale(pref: LocalePref, system: Locale): Locale {
  return pref === "system" ? system : pref;
}

export function translate(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const template = DICTS[locale]?.[key] ?? en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in params ? String(params[name]) : `{${name}}`,
  );
}
