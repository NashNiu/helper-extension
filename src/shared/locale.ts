import { LOCALE_KEY, detectSystemLocale, resolveLocale, type Locale, type LocalePref } from "../i18n/core";
import { storageGet } from "./storage";

export async function currentLocale(): Promise<Locale> {
  const pref = (await storageGet<LocalePref>(LOCALE_KEY)) ?? "system";
  return resolveLocale(pref, detectSystemLocale());
}
