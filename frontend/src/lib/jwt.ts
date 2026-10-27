import crypto from "crypto";

function normalizeSecret(val?: string | null): string {
  if (!val || typeof val !== "string") return "";
  let s = val.trim();
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

export function getJwtSecret(): string {
  const secret = normalizeSecret(process.env.JWT_SECRET);
  if (!secret || secret.length < 32) {
    throw new Error("FATAL: JWT_SECRET environment variable is missing or shorter than 32 characters.");
  }
  return secret;
}

export interface SessionPayload {
  userId: string;
  email: string;
  role: "user" | "provider" | "job_provider" | "admin";
  name?: string;
  oauthMobile?: boolean;
  oauthCodeChallenge?: string;
  oauthAccountType?: "customer" | "service_provider" | "job_provider";
  oauthRoleNeutral?: boolean;
  iat?: number;
  exp?: number;
  sessionId?: string;
  client?: string;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

export function signJwtToken(payload: Omit<SessionPayload, "iat" | "exp">, expiresInSeconds = 7 * 24 * 3600): string {
  const header = { alg: "HS256", typ: "JWT" };
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expiresInSeconds;
  const fullPayload: SessionPayload = { ...payload, iat, exp };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const secret = getJwtSecret();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyJwtToken(token: string): SessionPayload | null {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;

    const secret = getJwtSecret();
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    // Constant-time signature comparison to prevent timing attacks
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload: SessionPayload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// Allowed route prefixes for URL query token fallback (strictly limited to direct file/media download endpoints)
export const ALLOWED_URL_TOKEN_PREFIXES = [
  "/api/attachments/",
  "/api/jobs/resumes/",
  "/api/jobs/applications/"
] as const;

export function isUrlTokenPermittedForPath(pathname: string): boolean {
  return ALLOWED_URL_TOKEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Extracts and verifies legacy JWT tokens from request headers, cookies, or permitted query params.
 * Internal helper used for dual-validation legacy fallback.
 * Strictly rejects tokens for role 'admin' and never reads tokens on /api/admin/* routes.
 */
export function getLegacyJwtUser(request: Request): SessionPayload | null {
  try {
    const url = new URL(request.url, "http://localhost");
    const pathname = url.pathname;

    // Legacy JWTs are NEVER accepted on /api/admin/* routes
    if (pathname.startsWith("/api/admin")) {
      return null;
    }

    // 1. Check Authorization header: Bearer <token>
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      const verified = verifyJwtToken(token);
      if (verified) {
        if (verified.role === "admin") return null;
        return verified;
      }
    }

    // 2. Check Cookie header: auth_token=<token>
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      const cookies = cookieHeader.split(";").map((c) => c.trim());
      const authCookie = cookies.find((c) => c.startsWith("auth_token="));
      if (authCookie) {
        const token = authCookie.substring("auth_token=".length).trim();
        const verified = verifyJwtToken(token);
        if (verified) {
          if (verified.role === "admin") return null;
          return verified;
        }
      }
    }

    // 3. URL query parameter (?token=) strictly restricted to direct download routes with short-lived tokens
    try {
      const queryToken = url.searchParams.get("token");
      if (queryToken && queryToken.trim()) {
        if (isUrlTokenPermittedForPath(pathname)) {
          const verified = verifyJwtToken(queryToken.trim());
          if (verified) {
            if (verified.role === "admin") return null;
            // Must be a short-lived token (total lifetime <= 1 hour or remaining lifetime <= 1 hour)
            const tokenLifetime = (verified.exp || 0) - (verified.iat || 0);
            const remainingLifetime = (verified.exp || 0) - Math.floor(Date.now() / 1000);
            if (tokenLifetime <= 3600 || remainingLifetime <= 3600) {
              return verified;
            }
          }
        }
      }
    } catch {
      // Ignore URL parsing errors
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * BelConnect Primary Authentication Resolver
 * Async authentication function validating opaque server-side sessions stored in PostgreSQL.
 * Seamlessly supports dual-validation legacy fallback when enabled.
 */
export async function getAuthenticatedUser(
  request: Request,
  queryRunner?: (sql: string, params: any[]) => Promise<any>
): Promise<SessionPayload | null> {
  try {
    let getSessionUserFn: ((req: Request, qr?: (sql: string, params: any[]) => Promise<any>) => Promise<any>) | null = null;
    try {
      const sessMod: any = await import("./session");
      if (typeof sessMod.getSessionUser === "function") {
        getSessionUserFn = sessMod.getSessionUser;
      }
    } catch {
      try {
        const modName = "./session" + ".ts";
        const sessMod: any = await import(/* webpackIgnore: true */ modName);
        if (typeof sessMod.getSessionUser === "function") {
          getSessionUserFn = sessMod.getSessionUser;
        }
      } catch {
        // Fallback for tests
      }
    }

    if (!getSessionUserFn) {
      // Direct legacy JWT fallback if session module cannot be loaded
      const legacyUser = getLegacyJwtUser(request);
      return legacyUser;
    }

    const user = await getSessionUserFn(request, queryRunner);
    if (!user) return null;
    return {
      userId: user.userId,
      email: user.email,
      role: user.role,
      name: user.name,
      sessionId: user.sessionId,
      client: user.client,
    };
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err.name === "DatabaseUnavailableError" || (err as any).isDatabaseUnavailable)
    ) {
      throw err;
    }
    console.error("[getAuthenticatedUser] Authentication error:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  // 1. Check direct keys
  const direct = localStorage.getItem("cityconnect_token") || localStorage.getItem("auth_token") || localStorage.getItem("cityconnect_auth_token");
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
