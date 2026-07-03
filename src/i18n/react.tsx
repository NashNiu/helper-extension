import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  LOCALE_KEY,
  detectSystemLocale,
  resolveLocale,
  translate,
  type Locale,
  type LocalePref,
} from "./core";
import type { MessageKey } from "./messages/en";
import { storageGet, storageSet } from "../shared/storage";

interface I18nValue {
  pref: LocalePref;
  locale: Locale;
  setPref: (p: LocalePref) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<LocalePref>("system");
  const [system] = useState<Locale>(() => detectSystemLocale());

  useEffect(() => {
    void storageGet<LocalePref>(LOCALE_KEY).then((v) => {
      if (v === "system" || v === "en" || v === "zh-Hans" || v === "zh-Hant") setPrefState(v);
    });
  }, []);

  const setPref = useCallback((p: LocalePref) => {
    setPrefState(p);
    void storageSet(LOCALE_KEY, p);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ pref, locale: resolveLocale(pref, system), setPref }),
    [pref, system, setPref],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useLocale() {
  return useI18n();
}

export function useT() {
  const { locale } = useI18n();
  return useCallback(
    (key: MessageKey, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale],
  );
}
