"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

import en from "./translations/en.json";
import hi from "./translations/hi.json";
import kn from "./translations/kn.json";
import mr from "./translations/mr.json";

export type Locale = "en" | "hi" | "kn" | "mr";

export const LOCALES: { code: Locale; label: string; nativeLabel: string }[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "kn", label: "Kannada", nativeLabel: "ಕನ್ನಡ" },
  { code: "mr", label: "Marathi", nativeLabel: "मराठी" },
];

// All current languages are LTR, but the architecture supports RTL
const RTL_LOCALES: Locale[] = [];

const translations: Record<Locale, Record<string, unknown>> = { en, hi, kn, mr };

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === "object" && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path; // Fallback to key path
    }
  }
  return typeof current === "string" ? current : path;
}

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
  dir: "ltr" | "rtl";
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("cityconnect-locale") as Locale | null;
    if (stored && translations[stored]) {
      setLocaleState(stored);
    }
    setMounted(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("cityconnect-locale", newLocale);
    // Update document direction for RTL support
    document.documentElement.dir = RTL_LOCALES.includes(newLocale) ? "rtl" : "ltr";
  }, []);

  const t = useCallback(
    (key: string): string => {
      const result = getNestedValue(translations[locale], key);
      // Fallback to English if key not found in current locale
      if (result === key && locale !== "en") {
        return getNestedValue(translations.en, key);
      }
      return result;
    },
    [locale]
  );

  const dir = RTL_LOCALES.includes(locale) ? "rtl" : "ltr";

  // Prevent hydration mismatch — render with defaults until mounted
  if (!mounted) {
    return (
      <I18nContext.Provider
        value={{
          locale: "en",
          setLocale,
          t: (key: string) => getNestedValue(translations.en, key),
          dir: "ltr",
        }}
      >
        {children}
      </I18nContext.Provider>
    );
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dir }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within I18nProvider");
  }
  return context;
}
