import crypto from "crypto";

export type OAuthAccountType = "customer" | "service_provider" | "job_provider";

export interface OAuthStatePayload {
  role: "user";
  oauthAccountType: OAuthAccountType;
  oauthRoleNeutral?: boolean;
  nonce: string;
  iat: number;
  codeChallenge?: string;
}

function normalizeOAuthAccountType(value: unknown): OAuthAccountType | null {
  switch (value) {
    case "customer":
    case "user":
      return "customer";
    case "service_provider":
    case "provider":
      return "service_provider";
    case "job_provider":
    case "jobprovider":
      return "job_provider";
    default:
      return null;
  }
}

function getOAuthStateSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.trim().length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: OAUTH_STATE_SECRET environment variable is missing or shorter than 32 characters.");
    }
    return "dev_oauth_state_secret_min_32_chars_fallback!";
  }
  return secret.trim();
}

/**
 * Creates a signed short-lived single-use OAuth State parameter using dedicated OAUTH_STATE_SECRET to prevent CSRF.
 */
export function createOAuthState(
  accountType: OAuthAccountType,
  mobile = false,
  codeChallenge?: string,
  roleNeutral = false
): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const iat = Math.floor(Date.now() / 1000);
  const payload = {
    nonce,
    accountType,
    mobile: Boolean(mobile),
    codeChallenge: codeChallenge || null,
    roleNeutral: Boolean(roleNeutral),
    iat
  };

  const secret = getOAuthStateSecret();
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${signature}`;
}

/**
 * Validates the state parameter returned by Google during OAuth callback.
 * Supports dedicated OAUTH_STATE_SECRET (2-part format) with legacy JWT fallback (3-part format).
 */
export function verifyOAuthState(stateToken: string | null): {
  valid: boolean;
  mobile?: boolean;
  codeChallenge?: string;
  roleNeutral?: boolean;
} {
  if (!stateToken || typeof stateToken !== "string") return { valid: false };

  const parts = stateToken.split(".");
  
  // 1. Dedicated OAUTH_STATE_SECRET format: payload.signature (2 parts)
  if (parts.length === 2) {
    const [payloadB64, signature] = parts;
    if (!payloadB64 || !signature) return { valid: false };

    try {
      const secret = getOAuthStateSecret();
      const expectedSig = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");

      if (
        signature.length !== expectedSig.length ||
        !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
      ) {
        return { valid: false };
      }

      const payloadStr = Buffer.from(payloadB64, "base64url").toString("utf-8");
      const payload = JSON.parse(payloadStr);

      const now = Math.floor(Date.now() / 1000);
      // 10 minutes maximum validity
      if (!payload.iat || now - payload.iat > 10 * 60 || now < payload.iat - 60) {
        return { valid: false };
      }

      if (!payload.nonce || typeof payload.nonce !== "string") {
        return { valid: false };
      }

      if (!normalizeOAuthAccountType(payload.accountType)) {
        return { valid: false };
      }

      return {
        valid: true,
        mobile: payload.mobile === true,
        codeChallenge: payload.codeChallenge || undefined,
        roleNeutral: payload.roleNeutral === true
      };
    } catch {
      return { valid: false };
    }
  }

  // 2. Legacy fallback for in-flight tokens (3-part JWT)
  if (parts.length === 3) {
    try {
      const [headerB64, payloadB64, sigB64] = parts;
      const secret = process.env.JWT_SECRET;
      if (!secret) return { valid: false };

      const expectedSig = crypto.createHmac("sha256", secret).update(`${headerB64}.${payloadB64}`).digest("base64url");
      if (
        sigB64.length !== expectedSig.length ||
        !crypto.timingSafeEqual(Buffer.from(sigB64), Buffer.from(expectedSig))
      ) {
        return { valid: false };
      }

      const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
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
    } catch {
      return { valid: false };
    }
  }

  return { valid: false };
}
