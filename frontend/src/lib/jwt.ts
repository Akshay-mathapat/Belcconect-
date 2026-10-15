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
  } catch (e) {
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

export function getAuthenticatedUser(request: Request): SessionPayload | null {
  try {
    // 1. Check Authorization header: Bearer <token>
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      const verified = verifyJwtToken(token);
      if (verified) return verified;
    }

    // 2. Check Cookie header: auth_token=<token>
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      const cookies = cookieHeader.split(";").map((c) => c.trim());
      const authCookie = cookies.find((c) => c.startsWith("auth_token="));
      if (authCookie) {
        const token = authCookie.substring("auth_token=".length).trim();
        const verified = verifyJwtToken(token);
        if (verified) return verified;
      }
    }

    // 3. URL query parameter (?token=) strictly restricted to direct download routes with short-lived tokens
    try {
      const url = new URL(request.url);
      const queryToken = url.searchParams.get("token");
      if (queryToken && queryToken.trim()) {
        const pathname = url.pathname;
        if (isUrlTokenPermittedForPath(pathname)) {
          const verified = verifyJwtToken(queryToken.trim());
          if (verified) {
            // Must be a short-lived token (total lifetime <= 1 hour or remaining lifetime <= 1 hour)
            const tokenLifetime = (verified.exp || 0) - (verified.iat || 0);
            const remainingLifetime = (verified.exp || 0) - Math.floor(Date.now() / 1000);
            if (tokenLifetime <= 3600 || remainingLifetime <= 3600) {
              return verified;
            }
          }
        }
      }
    } catch (_) {}

    return null;
  } catch (e) {
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
  } catch (e) {}
  return null;
}
