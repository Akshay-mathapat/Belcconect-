/**
 * BelConnect - Indian Mobile Phone Normalization & Validation Helper
 * Standalone pure utility (zero external dependencies) so it can be safely
 * imported in serverless routes, browser code, and standalone Node scripts.
 */

/**
 * Normalizes and validates an Indian mobile number.
 * Accepts: 10 digits starting with 6-9, with optional '+91', '91', or '0' prefix.
 * Returns: Normalized format '+91XXXXXXXXXX' or null if invalid.
 */
export function normalizeIndianPhone(input: string | null | undefined): string | null {
  if (!input || typeof input !== "string") return null;

  // Remove spaces, hyphens, parentheses, dots
  let cleaned = input.trim().replace(/[\s\-\(\)\.]/g, "");

  // Handle prefix
  if (cleaned.startsWith("+91")) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith("91") && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }

  // Must be exactly 10 digits starting with 6, 7, 8, or 9
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  return null;
}

