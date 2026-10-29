import { NextResponse } from "next/server";
import { getSessionTokenFromRequest, validateSession, type UserRole } from "@/lib/session";
import { getAuthenticatedUser } from "@/lib/jwt";
import { query } from "@/lib/db";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "Content-Type": "application/json"
};

/**
 * GET /api/auth/me
 * 
 * Cookie-authenticated session profile resolver.
 * Validates opaque server-side session (__Host-session) from cookies.
 * Seamlessly supports dual-validation legacy fallback when AUTH_ACCEPT_LEGACY_JWT is active.
 * 
 * Guarantees:
 * - Always returns Cache-Control: no-store
 * - Returns current authenticated user and role
 * - NEVER exposes or returns a session token or JWT token
 * - Returns 401 Unauthorized if no active valid session exists
 * - Returns 503 + Retry-After if database is unavailable
 */
interface UserDbRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatar: string | null;
  role: UserRole;
  is_verified: boolean | null;
  verification_status: string | null;
  kyc_status: string | null;
  account_status: string;
}

interface UserAddressRow {
  id: string;
  type: string;
  text: string;
}

interface UserProfileData {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  phone: string | null;
  avatar: string | null;
  isVerified: boolean | null;
  verificationStatus: string | null;
  kycStatus: string | null;
  sessionId?: string;
  addresses?: UserAddressRow[];
}

export async function GET(request: Request) {
  try {
    // 1. Primary: Opaque server-side session from __Host-session cookie
    const token = getSessionTokenFromRequest(request, "user");
    let user: UserProfileData | null = null;

    if (token) {
      try {
        const validated = await validateSession(token);
        if (validated) {
          const uRes = await query(
            `SELECT id, email, name, phone, avatar, 'user' AS role, NULL::boolean AS is_verified, NULL::text AS verification_status, NULL::text AS kyc_status, account_status FROM customers WHERE id = $1
             UNION ALL
             SELECT id, email, name, phone, avatar, 'provider' AS role, is_verified, verification_status, kyc_status, account_status FROM service_providers WHERE id = $1
             UNION ALL
             SELECT id, email, name, phone, avatar, 'job_provider' AS role, NULL::boolean AS is_verified, NULL::text AS verification_status, NULL::text AS kyc_status, account_status FROM job_providers WHERE id = $1
             LIMIT 1`,
            [validated.userId]
          );
          if (uRes.rows.length > 0) {
            const row: UserDbRow = uRes.rows[0];
            if (row.account_status === "active") {
              user = {
                id: String(row.id),
                email: String(row.email),
                role: row.role,
                name: String(row.name),
                phone: row.phone,
                avatar: row.avatar,
                isVerified: row.is_verified,
                verificationStatus: row.verification_status,
                kycStatus: row.kyc_status,
                sessionId: validated.sessionId
              };
            }
          }
        }
      } catch (sessErr: unknown) {
        if (
          sessErr instanceof Error &&
          (sessErr.name === "DatabaseUnavailableError" || (sessErr as { isDatabaseUnavailable?: boolean }).isDatabaseUnavailable)
        ) {
          return NextResponse.json(
            { error: "Database temporarily unavailable" },
            { status: 503, headers: { ...NO_STORE_HEADERS, "Retry-After": "5" } }
          );
        }
      }
    }

    // 2. Dual-validation legacy fallback when session cookie is missing or invalid
    if (!user) {
      const acceptLegacy = process.env.AUTH_ACCEPT_LEGACY_JWT !== "false";
      if (acceptLegacy) {
        const legacyUser = await getAuthenticatedUser(request);
        if (legacyUser && legacyUser.userId) {
          const uRes = await query(
            `SELECT id, email, name, phone, avatar, 'user' AS role, NULL::boolean AS is_verified, NULL::text AS verification_status, NULL::text AS kyc_status, account_status FROM customers WHERE id = $1
             UNION ALL
             SELECT id, email, name, phone, avatar, 'provider' AS role, is_verified, verification_status, kyc_status, account_status FROM service_providers WHERE id = $1
             UNION ALL
             SELECT id, email, name, phone, avatar, 'job_provider' AS role, NULL::boolean AS is_verified, NULL::text AS verification_status, NULL::text AS kyc_status, account_status FROM job_providers WHERE id = $1
             LIMIT 1`,
            [legacyUser.userId]
          );
          if (uRes.rows.length > 0) {
            const row: UserDbRow = uRes.rows[0];
            if (row.account_status === "active") {
              user = {
                id: String(row.id),
                email: String(row.email),
                role: row.role,
                name: String(row.name),
                phone: row.phone,
                avatar: row.avatar,
                isVerified: row.is_verified,
                verificationStatus: row.verification_status,
                kycStatus: row.kyc_status
              };
            }
          }
        }
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    // Load customer addresses if user is customer
    if (user.role === "user") {
      const addrRes = await query("SELECT id, type, text FROM addresses WHERE user_id = $1", [user.id]).catch(() => ({ rows: [] }));
      user.addresses = (addrRes.rows as UserAddressRow[]) || [];
    }

    return NextResponse.json(
      {
        success: true,
        user
      },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    console.error("[GET /api/auth/me Error]:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
