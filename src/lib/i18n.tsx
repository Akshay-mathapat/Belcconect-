"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

import en from "./translations/en.json";
import hi from "./translations/hi.json";
import kn from "./translations/kn.json";
import mr from "./translations/mr.json";
import { useAuthStore } from "@/store/useAuthStore";

export type Locale = "en" | "hi" | "kn" | "mr";
export type SupportedLanguage = Locale;

export interface LanguageOption {
  code: Locale;
  label: string;
  nativeLabel: string;
  regionCode: string;
}

export const LOCALES: LanguageOption[] = [
  { code: "en", label: "English", nativeLabel: "English", regionCode: "en-IN" },
  { code: "kn", label: "Kannada", nativeLabel: "ಕನ್ನಡ", regionCode: "kn-IN" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", regionCode: "hi-IN" },
  { code: "mr", label: "Marathi", nativeLabel: "ಮರಾಠಿ", regionCode: "mr-IN" },
];

const STORAGE_KEYS = ["cityconnect:language", "cityconnect-locale"];

const translations: Record<Locale, Record<string, unknown>> = { en, hi, kn, mr };

/**
 * Get nested string value from translation object using dot notation (e.g. "common.next")
 */
function getNestedValue(obj: Record<string, unknown>, path: string): string {
  if (!obj || !path) return path;
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === "object" && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path; // Fallback to key path if missing
    }
  }
  return typeof current === "string" ? current : path;
}

/**
 * Helper utility to map app language code to BCP 47 locale tag for Intl formatting
 */
export function getLocaleTag(lang: Locale): string {
  switch (lang) {
    case "kn": return "kn-IN";
    case "hi": return "hi-IN";
    case "mr": return "mr-IN";
    case "en":
    default: return "en-IN";
  }
}

/**
 * Format currency amount in INR with proper language locale
 */
export function formatCurrency(amount: number, lang: Locale = "en"): string {
  try {
    return new Intl.NumberFormat(getLocaleTag(lang), {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(amount);
  } catch (e) {
    return `₹${amount}`;
  }
}

interface I18nContextType {
  locale: Locale;
  language: Locale;
  setLocale: (locale: Locale) => void;
  setLanguage: (language: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  dir: "ltr" | "rtl";
  getBookingStatusLabel: (status: string) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);
  const currentUser = useAuthStore((state) => state.currentUser);
  const userPrefLang = currentUser?.preferred_language;

  // Synchronize language state across storage keys, document lang attribute, and user account preference
  useEffect(() => {
    let initialLang: Locale = "en";

    // 1. Check authenticated user preference if set
    if (userPrefLang && ["en", "kn", "hi", "mr"].includes(userPrefLang as Locale)) {
      initialLang = userPrefLang as Locale;
    } else {
      // 2. Check localStorage key
      for (const key of STORAGE_KEYS) {
        const stored = typeof window !== "undefined" ? localStorage.getItem(key) as Locale | null : null;
        if (stored && ["en", "kn", "hi", "mr"].includes(stored)) {
          initialLang = stored;
          break;
        }
      }
    }

    setLocaleState((prev) => (prev !== initialLang ? initialLang : prev));
    if (typeof document !== "undefined" && document.documentElement.lang !== initialLang) {
      document.documentElement.lang = initialLang;
    }
    setMounted(true);
  }, [userPrefLang]);

  const setLocale = useCallback((newLocale: Locale) => {
    if (!["en", "kn", "hi", "mr"].includes(newLocale)) return;
    setLocaleState(newLocale);

    // Save to localStorage
    if (typeof window !== "undefined") {
      STORAGE_KEYS.forEach(k => localStorage.setItem(k, newLocale));
    }

    // Update document HTML lang attribute for screen readers & browser accessibility
    if (typeof document !== "undefined") {
      document.documentElement.lang = newLocale;
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let text = getNestedValue(translations[locale], key);
      
      // Fallback to English if key missing in selected language
      if ((!text || text === key) && locale !== "en") {
        text = getNestedValue(translations.en, key);
      }

      if (params && typeof text === "string") {
        Object.entries(params).forEach(([paramKey, paramVal]) => {
          text = text.replace(new RegExp(`{\\s*${paramKey}\\s*}`, "g"), String(paramVal));
        });
      }

      return text || key;
    },
    [locale]
  );

  const getBookingStatusLabel = useCallback((status: string): string => {
    if (!status) return status;
    const translationKey = `account.statuses.${status}`;
    const translated = t(translationKey);
    return translated !== translationKey ? translated : status;
  }, [t]);

  const contextValue: I18nContextType = useMemo(
    () => ({
      locale,
      language: locale,
      setLocale,
      setLanguage: setLocale,
      t,
      dir: "ltr",
      getBookingStatusLabel
    }),
    [locale, setLocale, t, getBookingStatusLabel]
  );

  // Safe SSR / static prerender hydration boundary
  if (!mounted) {
    const fallbackContext: I18nContextType = {
      locale: "en",
      language: "en",
      setLocale,
      setLanguage: setLocale,
      t: (key: string, params?: Record<string, string | number>) => {
        let text = getNestedValue(translations.en, key);
        if (params && typeof text === "string") {
          Object.entries(params).forEach(([paramKey, paramVal]) => {
            text = text.replace(new RegExp(`{\\s*${paramKey}\\s*}`, "g"), String(paramVal));
          });
        }
        return text || key;
      },
      dir: "ltr",
      getBookingStatusLabel: (status: string) => status
    };

    return (
      <I18nContext.Provider value={fallbackContext}>
        {children}
      </I18nContext.Provider>
    );
  }

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    // Return safe SSG / non-provider fallback instead of breaking build
    return {
      locale: "en" as Locale,
      language: "en" as Locale,
      setLocale: () => {},
      setLanguage: () => {},
      t: (key: string) => getNestedValue(translations.en, key),
      dir: "ltr" as const,
      getBookingStatusLabel: (status: string) => status
    };
  }
  return context;
}

export const useLanguage = useTranslation;
