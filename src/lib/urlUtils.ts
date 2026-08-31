/**
 * Utility functions for URL sanitization and open redirect prevention.
 */

/**
 * Validates and sanitizes returnTo URLs to prevent Open Redirect vulnerabilities.
 * A valid return URL MUST:
 * 1. Start with a single slash "/"
 * 2. NOT start with a double slash "//" (protocol-relative URL)
 * 3. NOT contain a scheme/protocol (e.g. http://, https://, javascript:, data:)
 * 4. NOT contain drive letters or backslashes (e.g. C:\ or \\)
 *
 * @param returnTo The raw candidate URL string
 * @param fallback The safe internal fallback path (default: "/")
 * @returns Sanitized internal path string
 */
export function getSafeReturnUrl(returnTo?: string | null, fallback: string = "/"): string {
  if (!returnTo) return fallback;

  try {
    const decoded = decodeURIComponent(returnTo).trim();

    // Must start with '/'
    if (!decoded.startsWith("/")) return fallback;

    // Must NOT start with '//' (protocol-relative URL attack)
    if (decoded.startsWith("//")) return fallback;

    // Must NOT contain protocol or scheme delimiters (http:, https:, javascript:, etc.)
    if (/^(https?:|javascript:|data:|file:)/i.test(decoded)) return fallback;

    // Must NOT contain Windows backslashes or drive letters
    if (decoded.includes("\\") || decoded.includes(":")) return fallback;

    return decoded;
  } catch (e) {
    return fallback;
  }
}
