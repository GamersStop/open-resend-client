"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import en from "@/locales/en.json";
import es from "@/locales/es.json";
import hi from "@/locales/hi.json";
import zh from "@/locales/zh.json";
import de from "@/locales/de.json";
import fr from "@/locales/fr.json";

export type SupportedLocale = "en" | "es" | "hi" | "zh" | "de" | "fr";

export interface LocaleOption {
  code: SupportedLocale;
  label: string;
  nativeLabel: string;
  flag: string;
}

export const SUPPORTED_LOCALES: LocaleOption[] = [
  { code: "en", label: "English", nativeLabel: "English", flag: "🇺🇸" },
  { code: "es", label: "Spanish", nativeLabel: "Español", flag: "🇪🇸" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", flag: "🇮🇳" },
  { code: "zh", label: "Chinese", nativeLabel: "简体中文", flag: "🇨🇳" },
  { code: "de", label: "German", nativeLabel: "Deutsch", flag: "🇩🇪" },
  { code: "fr", label: "French", nativeLabel: "Français", flag: "🇫🇷" },
];

const DICTIONARIES: Record<SupportedLocale, Record<string, unknown>> = {
  en: en as Record<string, unknown>,
  es: es as Record<string, unknown>,
  hi: hi as Record<string, unknown>,
  zh: zh as Record<string, unknown>,
  de: de as Record<string, unknown>,
  fr: fr as Record<string, unknown>,
};

interface I18nContextType {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (keyPath: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  setLocale: () => {},
  t: (keyPath, fallback) => fallback ?? keyPath,
});

function resolveKey(dict: Record<string, unknown>, keyPath: string): string | undefined {
  const parts = keyPath.split(".");
  let current: unknown = dict;
  for (const part of parts) {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === "string" ? current : undefined;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("openresend_locale") as SupportedLocale | null;
      if (saved && saved in DICTIONARIES) {
        setLocaleState(saved);
        return;
      }
      // Check browser language
      const browserLang = navigator.language.slice(0, 2) as SupportedLocale;
      if (browserLang in DICTIONARIES) {
        setLocaleState(browserLang);
      }
    } catch {
      // Fallback to default
    }
  }, []);

  const setLocale = (newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem("openresend_locale", newLocale);
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // Storage unavailable
    }
  };

  const t = (keyPath: string, fallback?: string): string => {
    const activeDict = DICTIONARIES[locale] || DICTIONARIES.en;
    const translated = resolveKey(activeDict, keyPath);
    if (translated !== undefined) return translated;

    // Fallback to English dictionary
    const enVal = resolveKey(DICTIONARIES.en, keyPath);
    if (enVal !== undefined) return enVal;

    return fallback ?? keyPath;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
