/**
 * BelConnect - Core SEO Configuration
 * Centralized site metadata, URL normalization, city scope, and social profiles.
 */

function resolveSiteUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (!envUrl) {
    // In production build, fail fast with a clear message if NEXT_PUBLIC_SITE_URL is not set
    if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production") {
      throw new Error(
        "FATAL SEO CONFIG ERROR: NEXT_PUBLIC_SITE_URL environment variable is required in production builds but is missing. Please set NEXT_PUBLIC_SITE_URL (e.g. 'https://belconnect.in' or 'https://belconnect.vercel.app') in your Vercel Project Settings."
      );
    }
    // Safe fallback for local development, CI tests, and preview branches
    const fallback = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";
    return fallback.trim().replace(/\/+$/, "");
  }
  return envUrl.trim().replace(/\/+$/, "");
}

export const SITE_URL = resolveSiteUrl();
export const SITE_NAME = "BelConnect";
export const PRIMARY_CITY = "Belagavi";
export const ALTERNATE_CITY = "Belgaum";
export const CITY_NAMES = [PRIMARY_CITY, ALTERNATE_CITY] as const;

/**
 * Default SEO description under 155 characters (132 characters)
 * Mentions Belagavi, services, and local verified professionals without keyword stuffing.
 */
export const DEFAULT_DESCRIPTION =
  "Book trusted local home services in Belagavi. Connect with verified electricians, plumbers, AC repair, and cleaning professionals.";

/**
 * Builds an absolute URL from a relative path, ensuring single leading slash
 * and no trailing slashes unless it's the root.
 */
export function absoluteUrl(path = ""): string {
  if (!path || path === "/") return SITE_URL;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${cleanPath.replace(/\/+$/, "")}`;
}

export const SOCIAL_PROFILES = {
  twitter: process.env.NEXT_PUBLIC_SOCIAL_TWITTER || "https://twitter.com/BelConnect",
  facebook: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK || "",
  instagram: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM || "",
  linkedin: process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN || "",
  youtube: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE || "",
} as const;

export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@belconnect.in";
export const GRIEVANCE_EMAIL = process.env.NEXT_PUBLIC_GRIEVANCE_EMAIL || "grievance@belconnect.in";
export const GOOGLE_SITE_VERIFICATION = process.env.GOOGLE_SITE_VERIFICATION || "";
export const BING_SITE_VERIFICATION = process.env.BING_SITE_VERIFICATION || "";

