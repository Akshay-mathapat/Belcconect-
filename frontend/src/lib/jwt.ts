import crypto from "crypto";

// DO NOT REINTRODUCE HARDCODED FALLBACKS FOR SECRETS (JWT_SECRET, DATABASE_URL, SIGNALING_INTERNAL_SECRET, LIVEKIT_API_SECRET, VAPID_PRIVATE_KEY) UNDER ANY CIRCUMSTANCES, INCLUDING LOCAL DEV CONVENIENCE.
const JWT_SECRET = process.env.JWT_SECRET!;

if (!JWT_SECRET && typeof window === "undefined") {
  throw new Error("FATAL: JWT_SECRET environment variable is missing.");
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

  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
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

    const expectedSignature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    if (signature !== expectedSignature) return null;

    const payload: SessionPayload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }

    return payload;
  } catch (e) {
    return null;
  }
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

    // 3. Fallback: x-user-id header for unauthenticated / demo sessions (active in development or DEMO_MODE)
    const xUserId = request.headers.get("x-user-id");
    if (xUserId && (process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true") && xUserId.trim().length > 0) {
      const trimmedId = xUserId.trim();
      const isProvider = trimmedId.includes("provider") || trimmedId.includes("prov");
      return {
        userId: trimmedId,
        email: isProvider ? "provider@belconnect.com" : "customer@belconnect.com",
        role: isProvider ? "provider" : "user",
        name: isProvider ? "Service Provider" : "Customer"
      };
    }

    return null;
  } catch (e) {
    return null;
  }
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cityconnect_token") || localStorage.getItem("auth_token") || null;
}
