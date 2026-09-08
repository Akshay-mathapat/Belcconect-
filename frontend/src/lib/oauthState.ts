import crypto from "crypto";
import { signJwtToken, verifyJwtToken } from "@/lib/jwt";
import { normalizeOAuthAccountType, OAuthAccountType } from "@/lib/oauthAccountType";

export interface OAuthStatePayload {
  role: "user";
  oauthAccountType: OAuthAccountType;
  oauthRoleNeutral?: boolean;
  nonce: string;
  iat: number;
  codeChallenge?: string;
}

/**
 * Creates a signed short-lived single-use OAuth State parameter (JWT format) to prevent CSRF.
 */
export function createOAuthState(accountType: OAuthAccountType, mobile = false, codeChallenge?: string, roleNeutral = false): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  
  return signJwtToken({
    userId: "oauth_state",
    email: "oauth@state.internal",
    role: "user",
    oauthAccountType: accountType,
    ...(roleNeutral ? { oauthRoleNeutral: true } : {}),
    name: nonce,
    oauthMobile: mobile,
    oauthCodeChallenge: codeChallenge,
  });
}

/**
 * Validates the state parameter returned by Google during OAuth callback.
 */
export function verifyOAuthState(stateToken: string | null): { valid: boolean; mobile?: boolean; codeChallenge?: string; roleNeutral?: boolean } {
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

    if (!normalizeOAuthAccountType(payload.oauthAccountType)) return { valid: false };
    return {
      valid: true,
      mobile: payload.oauthMobile === true,
      codeChallenge: payload.oauthCodeChallenge,
      roleNeutral: payload.oauthRoleNeutral === true,
    };
  } catch (err) {
    return { valid: false };
  }
}
