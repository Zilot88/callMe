"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { Locale, TranslationKey } from "./translations";
import { translations } from "./translations";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (key) => translations[key]?.en ?? key,
});

function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "en";

  // Check localStorage first (user preference)
  try {
    const saved = localStorage.getItem("callme-locale");
    if (saved === "en" || saved === "ru") return saved;
  } catch { /* ignore */ }

  // Detect from browser languages
  const langs = navigator.languages ?? [navigator.language];
  for (const lang of langs) {
    const code = lang.toLowerCase().split("-")[0];
    if (code === "ru" || code === "uk" || code === "be") return "ru";
  }

  return "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  const setLocale = useCallback((loc: Locale) => {
    setLocaleState(loc);
    try { localStorage.setItem("callme-locale", loc); } catch { /* ignore */ }
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      const entry = translations[key];
      if (!entry) return key;
      return entry[locale] ?? entry.en ?? key;
    },
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
