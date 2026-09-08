import crypto from "crypto";
import { getClient } from "@/lib/db";
import {
  OAuthAccountType,
  oauthAccountTypeToJwtRole,
  oauthAccountTypeToTable,
} from "@/lib/oauthAccountType";

export interface GoogleIdentityParams {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name?: string | null;
  picture?: string | null;
  requestedAccountType: OAuthAccountType;
  roleNeutral?: boolean;
}

export interface GoogleIdentityResult {
  user: any;
  accountType?: OAuthAccountType;
  status: "existing" | "linked" | "created";
  error?: string;
  statusCode?: number;
}

const ACCOUNT_TABLES: Array<{ type: OAuthAccountType; table: "customers" | "service_providers" | "job_providers" }> = [
  { type: "customer", table: "customers" },
  { type: "service_provider", table: "service_providers" },
  { type: "job_provider", table: "job_providers" },
];

function accountMismatch(actual: OAuthAccountType): GoogleIdentityResult {
  const labels = { customer: "customer", service_provider: "service provider", job_provider: "job provider" };
  return {
    user: null,
    status: "existing",
    error: `This Google account is already registered as a ${labels[actual]}. Please use the ${labels[actual]} portal or a different Google account.`,
    statusCode: 409,
  };
}

/**
 * Single Unified Helper for resolving Google User Accounts across BelConnect.
 * 
 * Rules:
 * 1. Requires verified email from Google.
 * 2. Lookup existing user by google_id across customers, service_providers, job_providers.
 * 3. Lookup existing user by verified email if not found by google_id.
 *    - If found and google_id is empty, link google_id.
 *    - If found and google_id matches incoming googleId, proceed.
 *    - If found and google_id exists but is different, reject conflict (409).
 * 4. If new user:
 *    - Enforce safe requested role ("user", "provider", "job_provider"). Admin is strictly forbidden.
 *    - Default role is "user".
 *    - Create record with password_hash = NULL. Never generate fake/placeholder passwords.
 *    - Service Providers / KYC status stays unverified by default.
 */
export async function resolveGoogleIdentity({
  googleId,
  email,
  emailVerified,
  name,
  picture,
  requestedAccountType,
  roleNeutral = false,
}: GoogleIdentityParams): Promise<GoogleIdentityResult> {
  if (!email || !emailVerified) {
    return { user: null, status: "existing", error: "Unverified or missing Google email address. Access denied.", statusCode: 400 };
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name || cleanEmail.split("@")[0] || "BelConnect User";
  const avatar = picture || "";
  const dbClient = await getClient();

  try {
    await dbClient.query("BEGIN");

    // Google identity is global: never create or overwrite a second local identity for one sub.
    for (const account of ACCOUNT_TABLES) {
      const result = await dbClient.query(`SELECT * FROM ${account.table} WHERE google_id = $1 LIMIT 1`, [googleId]);
      if (result.rows.length > 0) {
        if (!roleNeutral && account.type !== requestedAccountType) {
          await dbClient.query("ROLLBACK");
          return accountMismatch(account.type);
        }
        const user = { ...result.rows[0], role: oauthAccountTypeToJwtRole(account.type) };
        await dbClient.query("COMMIT");
        delete user.password_hash;
        return { user, accountType: account.type, status: "existing" };
      }
    }

    // Registration forbids duplicate email addresses across account tables, so a cross-portal
    // Google login must fail explicitly rather than presenting the wrong role as authenticated.
    for (const account of ACCOUNT_TABLES) {
      const result = await dbClient.query(`SELECT * FROM ${account.table} WHERE email = $1 LIMIT 1`, [cleanEmail]);
      if (result.rows.length === 0) continue;

      if (!roleNeutral && account.type !== requestedAccountType) {
        await dbClient.query("ROLLBACK");
        return accountMismatch(account.type);
      }

      const matched = result.rows[0];
      if (matched.google_id && matched.google_id !== googleId) {
        await dbClient.query("ROLLBACK");
        return { user: null, status: "existing", error: "Account link conflict: This email is associated with a different Google account.", statusCode: 409 };
      }

      await dbClient.query(
        `UPDATE ${account.table}
         SET google_id = $1, avatar = COALESCE(NULLIF(avatar, ''), $2)
         WHERE id = $3 AND (google_id IS NULL OR google_id = $1)`,
        [googleId, avatar, matched.id]
      );
      const user = { ...matched, google_id: googleId, role: oauthAccountTypeToJwtRole(account.type) };
      await dbClient.query("COMMIT");
      delete user.password_hash;
      return { user, accountType: account.type, status: "linked" };
    }

    const targetTable = oauthAccountTypeToTable(requestedAccountType);
    const prefix = requestedAccountType === "customer" ? "cust" : requestedAccountType === "service_provider" ? "prov" : "emp";
    const newUserId = `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
    await dbClient.query(
      `INSERT INTO ${targetTable} (id, email, name, avatar, google_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [newUserId, cleanEmail, cleanName, avatar, googleId]
    );

    const user = {
      id: newUserId,
      email: cleanEmail,
      name: cleanName,
      avatar,
      google_id: googleId,
      role: oauthAccountTypeToJwtRole(requestedAccountType),
      isFirstLogin: true,
    };
    await dbClient.query("COMMIT");
    return { user, accountType: requestedAccountType, status: "created" };
  } catch (error) {
    await dbClient.query("ROLLBACK");
    throw error;
  } finally {
    dbClient.release();
  }
}
