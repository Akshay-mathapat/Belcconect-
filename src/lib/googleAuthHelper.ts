import crypto from "crypto";
import { getClient } from "@/lib/db";

export interface GoogleIdentityParams {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name?: string | null;
  picture?: string | null;
  requestedRole?: string | null;
}

export interface GoogleIdentityResult {
  user: any;
  status: "existing" | "linked" | "created";
  error?: string;
  statusCode?: number;
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
  requestedRole,
}: GoogleIdentityParams): Promise<GoogleIdentityResult> {
  if (!email || !emailVerified) {
    return {
      user: null,
      status: "existing",
      error: "Unverified or missing Google email address. Access denied.",
      statusCode: 400,
    };
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name || cleanEmail.split("@")[0] || "BelConnect User";
  const avatar = picture || "";

  let dbClient;
  let userObj: any = null;
  let resolveStatus: "existing" | "linked" | "created" = "existing";

  try {
    dbClient = await getClient();
    await dbClient.query("BEGIN");

    // 1. Search by google_id across tables
    const custG = await dbClient.query("SELECT * FROM customers WHERE google_id = $1 LIMIT 1", [googleId]);
    if (custG.rows.length > 0) {
      userObj = { ...custG.rows[0], role: "user" };
      resolveStatus = "existing";
    } else {
      const provG = await dbClient.query("SELECT * FROM service_providers WHERE google_id = $1 LIMIT 1", [googleId]);
      if (provG.rows.length > 0) {
        userObj = { ...provG.rows[0], role: "provider" };
        resolveStatus = "existing";
      } else {
        const empG = await dbClient.query("SELECT * FROM job_providers WHERE google_id = $1 LIMIT 1", [googleId]);
        if (empG.rows.length > 0) {
          userObj = { ...empG.rows[0], role: "job_provider" };
          resolveStatus = "existing";
        }
      }
    }

    // 2. Search by email if not found by google_id
    if (!userObj) {
      const custE = await dbClient.query("SELECT * FROM customers WHERE email = $1 LIMIT 1", [cleanEmail]);
      if (custE.rows.length > 0) {
        const matched = custE.rows[0];
        if (matched.google_id && matched.google_id !== googleId) {
          await dbClient.query("ROLLBACK");
          return {
            user: null,
            status: "existing",
            error: "Account link conflict: This email is associated with a different Google account.",
            statusCode: 409,
          };
        }
        await dbClient.query(
          "UPDATE customers SET google_id = $1, avatar = COALESCE(NULLIF(avatar, ''), $2) WHERE id = $3",
          [googleId, avatar, matched.id]
        );
        userObj = { ...matched, google_id: googleId, role: "user" };
        resolveStatus = "linked";
      } else {
        const provE = await dbClient.query("SELECT * FROM service_providers WHERE email = $1 LIMIT 1", [cleanEmail]);
        if (provE.rows.length > 0) {
          const matched = provE.rows[0];
          if (matched.google_id && matched.google_id !== googleId) {
            await dbClient.query("ROLLBACK");
            return {
              user: null,
              status: "existing",
              error: "Account link conflict: This email is associated with a different Google account.",
              statusCode: 409,
            };
          }
          await dbClient.query(
            "UPDATE service_providers SET google_id = $1, avatar = COALESCE(NULLIF(avatar, ''), $2) WHERE id = $3",
            [googleId, avatar, matched.id]
          );
          userObj = { ...matched, google_id: googleId, role: "provider" };
          resolveStatus = "linked";
        } else {
          const empE = await dbClient.query("SELECT * FROM job_providers WHERE email = $1 LIMIT 1", [cleanEmail]);
          if (empE.rows.length > 0) {
            const matched = empE.rows[0];
            if (matched.google_id && matched.google_id !== googleId) {
              await dbClient.query("ROLLBACK");
              return {
                user: null,
                status: "existing",
                error: "Account link conflict: This email is associated with a different Google account.",
                statusCode: 409,
              };
            }
            await dbClient.query(
              "UPDATE job_providers SET google_id = $1, avatar = COALESCE(NULLIF(avatar, ''), $2) WHERE id = $3",
              [googleId, avatar, matched.id]
            );
            userObj = { ...matched, google_id: googleId, role: "job_provider" };
            resolveStatus = "linked";
          }
        }
      }
    }

    // 3. Create New User
    if (!userObj) {
      // Safe Role Sanitation (Admin / Privileged roles strictly forbidden)
      const targetRole =
        requestedRole && ["user", "provider", "job_provider"].includes(requestedRole)
          ? requestedRole
          : "user";

      const prefix = targetRole === "user" ? "cust" : targetRole === "provider" ? "prov" : "emp";
      const newUserId = `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
      const targetTable =
        targetRole === "user"
          ? "customers"
          : targetRole === "provider"
          ? "service_providers"
          : "job_providers";

      await dbClient.query(
        `INSERT INTO ${targetTable} (id, email, name, avatar, google_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [newUserId, cleanEmail, cleanName, avatar, googleId]
      );

      userObj = {
        id: newUserId,
        email: cleanEmail,
        name: cleanName,
        avatar,
        google_id: googleId,
        role: targetRole,
        isFirstLogin: true,
      };
      resolveStatus = "created";
    }

    await dbClient.query("COMMIT");
  } catch (err) {
    if (dbClient) await dbClient.query("ROLLBACK");
    throw err;
  } finally {
    if (dbClient) dbClient.release();
  }

  delete userObj.password_hash;
  return { user: userObj, status: resolveStatus };
}
