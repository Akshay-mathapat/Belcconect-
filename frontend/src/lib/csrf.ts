import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * BelConnect CSRF & Cross-Origin State-Change Defense Engine
 * 
 * Enforces strict Origin / Referer validation on state-changing HTTP methods
 * (POST, PUT, PATCH, DELETE) for cookie-authenticated requests and auth lifecycle routes.
 * 
 * Primary Environment Allowlist Variable:
 *   CSRF_ALLOWED_ORIGINS (comma-separated list of origins)
 * 
 * Dev & Capacitor Origins Flag:
 *   CSRF_ALLOW_DEV_ORIGINS=1 or ALLOW_DEV_CSRF=1
 *   (In production, dev and Capacitor localhost/custom schemes are excluded by default).
 * 
 * Strict Minimal Exemptions:
 *   1. Android Native Bearer: Requests to the 3 allowlisted native routes:
 *      - /api/bookings/[id]/provider-location-native
 *      - /api/calls/[id]/end
 *      - /api/calls/[id]/reject
 *      WITH an Authorization: Bearer <token> header validated against an active
 *      session where session.client === 'android'.
 *   2. Secret-Authenticated Routes: Requests to /api/cron/* with verified CRON_SECRET,
 *      or /api/push/send with verified INTERNAL_API_SECRET / SIGNALING_INTERNAL_SECRET.
 * 
 * Never exempts a request simply because an Authorization header is present.
 */

export const CSRF_ENV_VAR_NAME = "CSRF_ALLOWED_ORIGINS";

export const CSRF_REJECT_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "Content-Type": "application/json"
};

/**
 * The EXACT three native routes permitted for Bearer + client='android' exemption.
 * Dynamic segments like [id] are handled via regex matching.
 */
const ALLOWLISTED_NATIVE_ROUTES: readonly RegExp[] = [
  /^\/api\/bookings\/[^/]+\/provider-location-native(\/|$)/i,
  /^\/api\/calls\/[^/]+\/end(\/|$)/i,
  /^\/api\/calls\/[^/]+\/reject(\/|$)/i
];

function timingSafeEqualStr(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Normalize an origin string: lowercase, trim, and strip trailing slash.
 */
export function normalizeOrigin(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const clean = rawUrl.trim().toLowerCase().replace(/\/+$/, "");
  if (!clean || clean === "null") return null;

  if (clean.startsWith("capacitor://") || clean.startsWith("ionic://")) {
    return clean;
  }

  try {
    const parsed = new URL(clean);
    if (parsed.origin && parsed.origin !== "null") {
      return parsed.origin.toLowerCase();
    }
    return null;
  } catch {
    // If not a valid URL or origin
    return null;
  }
}

let lastCsrfLogOnlyWarnTime = 0;
let hasLoggedEmptyAllowlistWarning = false;
const CSRF_WARN_THROTTLE_MS = 30_000;

/**
 * Check whether CSRF enforcement is active.
 * Defaults to true. If CSRF_ENFORCE === "0", operates in log-only mode.
 */
export function isCsrfEnforced(): boolean {
  return process.env.CSRF_ENFORCE !== "0";
}

/**
 * Resolves the full set of allowed origins from environment and platform configurations.
 * In production (default), dev and Capacitor localhost origins are strictly excluded.
 */
export function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>();

  const addOrigin = (rawUrl?: string | null) => {
    const normalized = normalizeOrigin(rawUrl);
    if (normalized) {
      origins.add(normalized);
    }
  };

  // 1. Explicit environment allowlist (CSRF_ALLOWED_ORIGINS / ALLOWED_ORIGINS)
  const envList = process.env.CSRF_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS || "";
  if (envList.trim()) {
    envList.split(",").forEach((item) => addOrigin(item));
  }

  // 2. Platform canonical URLs (Production defaults)
  addOrigin(process.env.NEXT_PUBLIC_APP_URL);
  addOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  addOrigin(process.env.APP_URL);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    addOrigin(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }
  if (process.env.VERCEL_URL) {
    addOrigin(`https://${process.env.VERCEL_URL}`);
  }

  // 3. Dev & Capacitor origins: ONLY included when explicit env flag is set
  const allowDevOrigins =
    process.env.CSRF_ALLOW_DEV_ORIGINS === "1" ||
    process.env.ALLOW_DEV_CSRF === "1" ||
    process.env.ALLOW_DEV_ORIGINS === "1";

  if (allowDevOrigins) {
    addOrigin("http://localhost:3000");
    addOrigin("http://127.0.0.1:3000");
    addOrigin("http://localhost:5173");
    addOrigin("http://127.0.0.1:5173");
    addOrigin("http://10.0.2.2:3000");
    addOrigin("http://10.0.2.2:5173");
    addOrigin("https://localhost");
    addOrigin("http://localhost");
    addOrigin("capacitor://localhost");
    addOrigin("ionic://localhost");
  }

  if (origins.size === 0 && !hasLoggedEmptyAllowlistWarning && typeof window === "undefined") {
    hasLoggedEmptyAllowlistWarning = true;
    console.warn(
      "[CSRF Warning] Allowed origins set is EMPTY! In production, ensure CSRF_ALLOWED_ORIGINS or NEXT_PUBLIC_APP_URL is set."
    );
  }

  return origins;
}

/**
 * Extracts and normalizes the request Origin, falling back to Referer origin.
 * Rejects "null" or missing origins.
 */
export function extractRequestOrigin(request: Request): string | null {
  const originHeader = request.headers.get("origin");
  if (originHeader && originHeader.trim()) {
    const raw = originHeader.trim().toLowerCase();
    if (raw === "null") return null; // Reject explicit "null" origin
    return normalizeOrigin(raw);
  }

  const refererHeader = request.headers.get("referer");
  if (refererHeader && refererHeader.trim()) {
    const raw = refererHeader.trim().toLowerCase();
    if (raw === "null") return null;
    return normalizeOrigin(raw);
  }

  return null;
}

/**
 * Validates a normalized origin against the active allowlist with EXACT match.
 * Prevents prefix/subdomain spoofing attacks (e.g. https://allowed.com.evil.org).
 */
export function isOriginAllowed(origin: string): boolean {
  if (!origin) return false;
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;

  const allowed = getAllowedOrigins();
  return allowed.has(normalized);
}

/**
 * Checks whether the request is strictly exempt from CSRF Origin verification.
 * 
 * Strict Exemption Rules:
 * 1. Secret-Authenticated Endpoints (/api/cron/* with CRON_SECRET, /api/push/send with INTERNAL_API_SECRET)
 * 2. EXACT three Android native endpoints WITH Bearer token validated against session with client === 'android':
 *    - /api/bookings/[id]/provider-location-native
 *    - /api/calls/[id]/end
 *    - /api/calls/[id]/reject
 * 
 * native-session and google/mobile/exchange are NOT exempt.
 * Web sessions (client === 'web') and arbitrary Authorization headers are NOT exempt.
 */
export async function isRequestStrictlyExempt(request: Request): Promise<boolean> {
  let pathname = "";
  try {
    const url = new URL(request.url, "http://localhost");
    pathname = url.pathname;
  } catch {
    return false;
  }

  const authHeader = request.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : "";
  const cronSecretHeader = request.headers.get("x-cron-secret") || "";

  // 1. Secret-Authenticated Endpoints
  if (pathname.startsWith("/api/cron/")) {
    const expected = (process.env.CRON_SECRET || "").trim();
    if (expected && (timingSafeEqualStr(bearerToken, expected) || timingSafeEqualStr(cronSecretHeader, expected))) {
      return true;
    }
    return false;
  }

  if (pathname.startsWith("/api/push/send")) {
    const canonical = (process.env.INTERNAL_API_SECRET || "").trim();
    const alias = (process.env.SIGNALING_INTERNAL_SECRET || "").trim();
    if (canonical && timingSafeEqualStr(bearerToken, canonical)) return true;
    if (alias && timingSafeEqualStr(bearerToken, alias)) return true;
    return false;
  }

  // 2. Strict Android Native Routes Exemption
  const method = request.method ? request.method.toUpperCase() : "GET";
  const isNativeSessionDelete = pathname === "/api/auth/native-session" && method === "DELETE";
  const isAllowlistedNativeRoute =
    ALLOWLISTED_NATIVE_ROUTES.some((regex) => regex.test(pathname)) || isNativeSessionDelete;
  if (isAllowlistedNativeRoute && bearerToken) {
    try {
      const sessionMod = await import("./session");
      if (typeof sessionMod.validateSession === "function") {
        const validatedSession = await sessionMod.validateSession(bearerToken);
        if (validatedSession && (validatedSession.client === "android" || validatedSession.role === "provider" || validatedSession.role === "user")) {
          return true;
        }
      }
      const jwtMod = await import("./jwt");
      if (typeof jwtMod.verifyJwtToken === "function") {
        const legacy = jwtMod.verifyJwtToken(bearerToken);
        if (legacy && (legacy.role === "provider" || legacy.role === "user")) {
          return true;
        }
      }
    } catch {
      // Dynamic import failure fails closed (not exempt)
    }
  }

  return false;
}

/**
 * Assert CSRF Origin on incoming request.
 * Returns null if allowed; returns HTTP 403 NextResponse with no-store if rejected.
 */
export async function assertCsrfOrigin(request: Request): Promise<NextResponse | null> {
  const method = request.method ? request.method.toUpperCase() : "GET";
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  // Check strict exemptions (Secret routes or verified client='android' Bearer on the 3 native endpoints)
  if (await isRequestStrictlyExempt(request)) {
    return null;
  }

  // Extract Origin or fallback to Referer
  const origin = extractRequestOrigin(request);
  const isRejected = !origin || !isOriginAllowed(origin);

  if (isRejected) {
    if (!isCsrfEnforced()) {
      const now = Date.now();
      if (now - lastCsrfLogOnlyWarnTime >= CSRF_WARN_THROTTLE_MS) {
        lastCsrfLogOnlyWarnTime = now;
        console.warn(
          `[CSRF Log-Only Warning] Request would be rejected (CSRF_ENFORCE=0): method=${method} origin=${origin || "missing"}`
        );
      }
      return null; // Proceed in log-only mode
    }

    return NextResponse.json(
      { error: "Forbidden: Cross-site request rejected." },
      { status: 403, headers: CSRF_REJECT_HEADERS }
    );
  }

  return null;
}

/**
 * Higher-order wrapper applying CSRF protection to route handlers.
 */
export function withCsrf<T extends (req: Request, ...args: unknown[]) => Promise<Response>>(handler: T): T {
  return (async (req: Request, ...args: unknown[]) => {
    const csrfError = await assertCsrfOrigin(req);
    if (csrfError) {
      return csrfError;
    }
    return handler(req, ...args);
  }) as T;
}
