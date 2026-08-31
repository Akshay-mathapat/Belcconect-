import { SupportedLanguage } from "./i18n";

/**
 * Maps application language code to standard BCP 47 locale tag
 */
export function getLocale(language: SupportedLanguage | string): string {
  switch (language) {
    case "kn":
      return "kn-IN";
    case "hi":
      return "hi-IN";
    case "mr":
      return "mr-IN";
    case "en":
    default:
      return "en-IN";
  }
}

/**
 * Formats currency amount in INR with locale-aware number formatting
 */
export function formatCurrency(amount: number, language: SupportedLanguage | string = "en"): string {
  try {
    return new Intl.NumberFormat(getLocale(language), {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(amount);
  } catch (e) {
    return `₹${amount}`;
  }
}

/**
 * Formats date object or date string according to user's selected language
 */
export function formatDate(date: string | Date | number, language: SupportedLanguage | string = "en"): string {
  try {
    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
    if (isNaN(d.getTime())) return String(date);
    return new Intl.DateTimeFormat(getLocale(language), {
      year: "numeric",
      month: "short",
      day: "numeric"
    }).format(d);
  } catch (e) {
    return String(date);
  }
}

/**
 * Formats numbers according to locale (e.g. 10,000)
 */
export function formatNumber(num: number, language: SupportedLanguage | string = "en"): string {
  try {
    return new Intl.NumberFormat(getLocale(language)).format(num);
  } catch (e) {
    return String(num);
  }
}
