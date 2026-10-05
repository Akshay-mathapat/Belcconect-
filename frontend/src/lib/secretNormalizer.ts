import crypto from "crypto";

/**
 * Normalizes a secret string:
 * - Trims whitespace
 * - Strips one pair of surrounding double quotes ("...") or single quotes ('...')
 * - Handles null/undefined/empty safely
 */
export function normalizeSecret(val?: string | null): string {
  if (!val || typeof val !== "string") {
    return "";
  }
  let s = val.trim();
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/**
 * Returns the first 8 hex characters of the SHA-256 hash of the normalized secret.
 * Used for comparing secrets between environments (Vercel vs Render) without printing the secret.
 */
export function getSecretFingerprint(val?: string | null): string {
  const normalized = normalizeSecret(val);
  return crypto.createHash("sha256").update(normalized).digest("hex").substring(0, 8);
}

