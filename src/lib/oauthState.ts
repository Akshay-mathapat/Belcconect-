import crypto from "crypto";
import { signJwtToken, verifyJwtToken } from "@/lib/jwt";

export interface OAuthStatePayload {
  role: "user" | "provider" | "job_provider";
  nonce: string;
  iat: number;
  codeChallenge?: string;
}

/**
 * Creates a signed short-lived single-use OAuth State parameter (JWT format) to prevent CSRF.
 */
export function createOAuthState(role: string = "user", mobile = false, codeChallenge?: string): string {
  const safeRole = (["user", "provider", "job_provider"].includes(role) ? role : "user") as "user" | "provider" | "job_provider";
  const nonce = crypto.randomBytes(16).toString("hex");
  
  return signJwtToken({
    userId: "oauth_state",
    email: "oauth@state.internal",
    role: safeRole,
    name: nonce,
    oauthMobile: mobile,
    oauthCodeChallenge: codeChallenge,
  });
}

/**
 * Validates the state parameter returned by Google during OAuth callback.
 */
export function verifyOAuthState(stateToken: string | null): { valid: boolean; role?: string; mobile?: boolean; codeChallenge?: string } {
  if (!stateToken) return { valid: false };

  try {
    const payload = verifyJwtToken(stateToken) as any;
    if (!payload || payload.userId !== "oauth_state" || payload.email !== "oauth@state.internal" || !payload.name) {
      return { valid: false };
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.iat && now - payload.iat > 10 * 60) {
      return { valid: false };
    }

    const role = ["user", "provider", "job_provider"].includes(payload.role) ? payload.role : "user";
    return {
      valid: true,
      role,
      mobile: payload.oauthMobile === true,
      codeChallenge: payload.oauthCodeChallenge,
    };
  } catch (err) {
    return { valid: false };
  }
}
