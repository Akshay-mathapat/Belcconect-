import crypto from "crypto";
import { query } from "@/lib/db";
import { OAuthAccountType } from "@/lib/oauthAccountType";

const OAUTH_TRANSACTION_TTL_SECONDS = 10 * 60;
const MOBILE_HANDOFF_TTL_SECONDS = 2 * 60;

// DO NOT REINTRODUCE HARDCODED FALLBACKS FOR SECRETS (JWT_SECRET, DATABASE_URL, SIGNALING_INTERNAL_SECRET, LIVEKIT_API_SECRET, VAPID_PRIVATE_KEY) UNDER ANY CIRCUMSTANCES, INCLUDING LOCAL DEV CONVENIENCE.
const JWT_SECRET = process.env.JWT_SECRET!;

if (!JWT_SECRET && typeof window === "undefined") {
  throw new Error("FATAL: JWT_SECRET environment variable is missing.");
}

function hashValue(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function encryptVerifier(value: string): string {
  const key = crypto.createHash("sha256").update(JWT_SECRET).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decryptVerifier(value: string): string {
  const [ivEncoded, tagEncoded, encryptedEncoded] = value.split(".");
  const key = crypto.createHash("sha256").update(JWT_SECRET).digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export async function storeGoogleOAuthTransaction({
  state,
  codeChallenge,
  accountType,
  codeVerifier,
}: {
  state: string;
  codeChallenge: string;
  accountType: OAuthAccountType;
  codeVerifier: string;
}): Promise<void> {
  await query(
    `INSERT INTO google_oauth_transactions (state_hash, code_challenge, account_type, code_verifier, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + ($5 * INTERVAL '1 second'))`,
    [hashValue(state), codeChallenge, accountType, encryptVerifier(codeVerifier), OAUTH_TRANSACTION_TTL_SECONDS]
  );
}

export async function consumeGoogleOAuthTransaction({
  state,
  codeChallenge,
}: {
  state: string;
  codeChallenge: string;
}): Promise<{ accountType: OAuthAccountType; codeVerifier: string } | null> {
  const result = await query(
    `UPDATE google_oauth_transactions
     SET used_at = NOW()
     WHERE state_hash = $1
       AND code_challenge = $2
       AND used_at IS NULL
       AND expires_at > NOW()
     RETURNING account_type, code_verifier`,
    [hashValue(state), codeChallenge]
  );
  const row = result.rows[0];
  if (!row?.account_type || !row.code_verifier) return null;
  return { accountType: row.account_type, codeVerifier: decryptVerifier(row.code_verifier) };
}

export function createMobileHandoffCode(): { code: string; codeHash: string } {
  const code = crypto.randomBytes(32).toString("base64url");
  return { code, codeHash: hashValue(code) };
}

export async function storeMobileHandoff({
  codeHash,
  user,
}: {
  codeHash: string;
  user: { id: string; email: string; name?: string; role: string };
}): Promise<void> {
  await query(
    `INSERT INTO google_mobile_handoffs
       (code_hash, user_id, email, name, role, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + ($6 * INTERVAL '1 second'))`,
    [codeHash, user.id, user.email, user.name || "BelConnect User", user.role, MOBILE_HANDOFF_TTL_SECONDS]
  );
}

export async function consumeMobileHandoff(code: string): Promise<{
  id: string;
  email: string;
  name: string;
  role: "user" | "provider" | "job_provider";
} | null> {
  const result = await query(
    `UPDATE google_mobile_handoffs
     SET used_at = NOW()
     WHERE code_hash = $1
       AND used_at IS NULL
       AND expires_at > NOW()
     RETURNING user_id AS id, email, name, role`,
    [hashValue(code)]
  );
  return result.rows[0] || null;
}
