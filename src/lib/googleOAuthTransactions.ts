import crypto from "crypto";
import { query } from "@/lib/db";

const OAUTH_TRANSACTION_TTL_SECONDS = 10 * 60;
const MOBILE_HANDOFF_TTL_SECONDS = 2 * 60;

function hashValue(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function storeGoogleOAuthTransaction({
  state,
  codeChallenge,
  role,
}: {
  state: string;
  codeChallenge: string;
  role: string;
}): Promise<void> {
  await query(
    `INSERT INTO google_oauth_transactions (state_hash, code_challenge, role, expires_at)
     VALUES ($1, $2, $3, NOW() + ($4 * INTERVAL '1 second'))`,
    [hashValue(state), codeChallenge, role, OAUTH_TRANSACTION_TTL_SECONDS]
  );
}

export async function consumeGoogleOAuthTransaction({
  state,
  codeChallenge,
}: {
  state: string;
  codeChallenge: string;
}): Promise<boolean> {
  const result = await query(
    `UPDATE google_oauth_transactions
     SET used_at = NOW()
     WHERE state_hash = $1
       AND code_challenge = $2
       AND used_at IS NULL
       AND expires_at > NOW()
     RETURNING state_hash`,
    [hashValue(state), codeChallenge]
  );
  return result.rowCount === 1;
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
