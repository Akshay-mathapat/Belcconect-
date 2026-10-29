import { assertCsrfOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { query, verifyPassword } from "@/lib/db";
import { signJwtToken } from "@/lib/jwt";
import { checkRateLimit } from "@/lib/rateLimit";
import { createSession, setSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  const csrfError = await assertCsrfOrigin(request);
  if (csrfError) return csrfError;

  try {
    // 1. Strict rate limiting on admin login (max 5 requests per 15 minutes)
    const rateLimit = await checkRateLimit(request, 5, 15 * 60 * 1000);
    if (!rateLimit.isAllowed) {
      return rateLimit.response!;
    }

    const body = await request.json().catch(() => ({}));
    const { email, password } = body;

    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // 2. Query admin user from admins table
    const result = await query(
      "SELECT id, email, password_hash FROM public.admins WHERE LOWER(email) = LOWER($1)",
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Invalid administrator credentials." },
        { status: 401 }
      );
    }

    const admin = result.rows[0];

    // 3. Verify password using Argon2 helper
    const isValid = await verifyPassword(password, admin.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid administrator credentials." },
        { status: 401 }
      );
    }

    // 4. Create server-side admin session in PostgreSQL with graceful fallback
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = request.headers.get("user-agent") || null;
    const issueLegacy = process.env.AUTH_ISSUE_LEGACY_JWT !== "false";

    let session: { sessionId: string; rawToken: string; expiresAt: Date; absoluteExpiresAt: Date } | null = null;
    try {
      session = await createSession({
        userId: admin.id,
        role: "admin",
        ip,
        user_agent: userAgent,
        device_label: "Admin Portal",
        client: "web"
      });
    } catch (sessionErr: any) {
      console.error(
        `[ADMIN_LOGIN_SESSION_ERROR] Failed to create session for admin ${admin.id}:`,
        sessionErr?.message || "Unknown error"
      );
      if (!issueLegacy) {
        return NextResponse.json(
          { error: "Authentication service unavailable. Please try again." },
          { status: 503 }
        );
      }
    }

    // 5. Dual-issuance: legacy JWT if AUTH_ISSUE_LEGACY_JWT is true (default true)
    let token = "";
    if (issueLegacy) {
      token = signJwtToken({
        userId: admin.id,
        email: admin.email,
        role: "admin"
      });
    }

    const response = NextResponse.json({
      success: true,
      ...(issueLegacy ? { token } : {}),
      ...(session ? { sessionId: session.sessionId } : {}),
      admin: {
        id: admin.id,
        email: admin.email,
        role: "admin"
      }
    });

    // Set server-side session cookie (__Host-admin_session) when session was created
    if (session) {
      setSessionCookie(response.headers, session.rawToken, "admin");
    }

    // Legacy cookie support during transition
    if (issueLegacy && token) {
      response.cookies.set("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 3600
      });
    }

    return response;
  } catch (error: any) {
    console.error("Admin login error:", error?.message || error);
    return NextResponse.json(
      { error: "Internal server error during authentication." },
      { status: 500 }
    );
  }
}
