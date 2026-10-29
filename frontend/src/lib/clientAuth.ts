/**
 * BelConnect Client Authentication Utilities
 * Browser-safe helpers that extract authentication tokens from localStorage.
 * STRICTLY client-side: never imports pg, crypto, session, or server database modules.
 */

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  // 1. Check direct keys
  const direct =
    localStorage.getItem("cityconnect_token") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("cityconnect_auth_token");
  if (direct && direct.trim().length > 10) return direct.trim();

  // 2. Check JSON store
  try {
    const raw = localStorage.getItem("belconnect-auth-store");
    if (raw) {
      const parsed = JSON.parse(raw);
      const tok = parsed?.state?.currentUser?.token;
      if (tok && typeof tok === "string" && tok.trim().length > 10) return tok.trim();
    }
  } catch {}
  return null;
}

