import { assertCsrfOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { query, verifyPassword } from "@/lib/db";
import { signJwtToken } from "@/lib/jwt";
import {
  checkIpRateLimit,
  checkEmailRateLimit,
  recordLoginFailure,
  recordLoginSuccess,
} from "@/lib/rateLimit";
import { parseAndValidate, loginSchema } from "@/lib/validations";
import { createSession, setSessionCookie, type UserRole } from "@/lib/session";

export async function POST(request: Request) {
  const csrfError = await assertCsrfOrigin(request);
  if (csrfError) return csrfError;

  // 1. IP Ceiling Rate Limit Check (120 req/min)
  const ipLimit = await checkIpRateLimit(request, 120, 60, undefined, undefined, false, true);
  if (!ipLimit.isAllowed) {
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        retryAfter: ipLimit.retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(ipLimit.retryAfter),
          "X-RateLimit-Limit": "120",
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  try {
    // 2. Strict Zod Schema Validation (rejects empty/missing passwords with 400)
    const validation = await parseAndValidate(request, loginSchema);
    if (validation.response) {
      return validation.response;
    }

    const { email, password } = validation.data;
    if (!password || !password.trim()) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // 3. Per-normalized-email failure rate limit check (10 failures / 15 min)
    const emailLimit = await checkEmailRateLimit(cleanEmail, 10, undefined, false, true, 15 * 60);
    if (!emailLimit.isAllowed) {
      return NextResponse.json(
        {
          error: "Too many failed login attempts. Please try again later.",
          retryAfter: emailLimit.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(emailLimit.retryAfter),
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // 4. Single UNION ALL login query including account_status
    const loginQuery = `
      SELECT id, email, name, phone, avatar, password_hash, 'user' AS role, NULL::boolean AS is_verified, NULL::text AS verification_status, NULL::text AS kyc_status, account_status FROM customers WHERE LOWER(email) = $1
      UNION ALL
      SELECT id, email, name, phone, avatar, password_hash, 'provider' AS role, is_verified, verification_status, kyc_status, account_status FROM service_providers WHERE LOWER(email) = $1
      UNION ALL
      SELECT id, email, name, phone, avatar, password_hash, 'job_provider' AS role, NULL::boolean AS is_verified, NULL::text AS verification_status, NULL::text AS kyc_status, account_status FROM job_providers WHERE LOWER(email) = $1
      LIMIT 1
    `;
    const userRes = await query(loginQuery, [cleanEmail]);

    if (userRes.rows.length === 0) {
      await recordLoginFailure(cleanEmail);
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const candidate = userRes.rows[0];

    // Check account status: suspended accounts cannot log in
    if (candidate.account_status === "suspended") {
      return NextResponse.json(
        { error: "This account has been suspended. Please contact support." },
        { status: 403 }
      );
    }

    // 5. Verify password hash using argon2 queue
    const isMatch = await verifyPassword(password, candidate.password_hash);
    if (!isMatch) {
      await recordLoginFailure(cleanEmail);
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // 6. Reset failure counter on login success
    await recordLoginSuccess(cleanEmail);

    // 7. Lean profile payload
    const isProvider = candidate.role === "provider";
    const isVerifiedProvider = isProvider && (candidate.is_verified === true || candidate.verification_status === "verified");
    const providerVerificationStatus = isProvider
      ? (candidate.verification_status || (candidate.is_verified ? "verified" : "unverified"))
      : undefined;

    const userObj: Record<string, any> = {
      id: candidate.id,
      email: candidate.email,
      name: candidate.name,
      phone: candidate.phone,
      avatar: candidate.avatar,
      role: candidate.role,
      addresses: [],
      bookings: [],
      ...(isProvider ? {
        isVerified: isVerifiedProvider,
        verificationStatus: providerVerificationStatus,
        kycStatus: candidate.kyc_status || (isVerifiedProvider ? "Verified" : "Unverified"),
      } : {}),
    };

    // 8. Create server-side session in PostgreSQL with graceful fallback
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = request.headers.get("user-agent") || null;
    const clientType = request.headers.get("x-client-type") === "android" ? "android" : "web";
    const issueLegacy = process.env.AUTH_ISSUE_LEGACY_JWT !== "false";

    let session: { sessionId: string; rawToken: string; expiresAt: Date; absoluteExpiresAt: Date } | null = null;
    try {
      session = await createSession({
        userId: candidate.id,
        role: candidate.role as UserRole,
        ip,
        user_agent: userAgent,
        client: clientType
      });
    } catch (sessionErr: any) {
      console.error(
        `[AUTH_LOGIN_SESSION_ERROR] Failed to create session for user ${candidate.id}:`,
        sessionErr?.message || "Unknown error"
      );
      if (!issueLegacy) {
        return NextResponse.json(
          { error: "Authentication service unavailable. Please try again." },
          { status: 503 }
        );
      }
    }

    // 9. Dual-issuance: legacy JWT if AUTH_ISSUE_LEGACY_JWT is true (default true)
    let token = "";
    if (issueLegacy) {
      token = signJwtToken({
        userId: userObj.id,
        email: userObj.email,
        role: userObj.role,
        name: userObj.name,
      });
    }

    const response = NextResponse.json({
      success: true,
      user: userObj,
      ...(issueLegacy ? { token } : {}),
      ...(session ? { sessionId: session.sessionId } : {})
    });

    // Legacy cookie support during transition
    if (issueLegacy && token) {
      response.cookies.set("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 3600,
        path: "/",
      });
    }

    // Set server-side session cookie (__Host-session) when session creation succeeded
    // Must be set after response.cookies.set to prevent Next.js from overwriting headers
    if (session) {
      setSessionCookie(response.headers, session.rawToken, candidate.role as UserRole);
    }

    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    return response;
  } catch (error: unknown) {
    console.error("[AUTH_LOGIN_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
