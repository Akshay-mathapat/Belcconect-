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

export async function POST(request: Request) {
  // 1. IP Ceiling Rate Limit Check (120 req/min)
  const ipLimit = await checkIpRateLimit(request, 120, 60);
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
    const emailLimit = await checkEmailRateLimit(cleanEmail, 10);
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

    // 4. Single UNION ALL login query utilizing migration 022 LOWER(email) indexes
    const loginQuery = `
      SELECT id, email, name, phone, avatar, password_hash, 'user' AS role FROM customers WHERE LOWER(email) = $1
      UNION ALL
      SELECT id, email, name, phone, avatar, password_hash, 'provider' AS role FROM service_providers WHERE LOWER(email) = $1
      UNION ALL
      SELECT id, email, name, phone, avatar, password_hash, 'job_provider' AS role FROM job_providers WHERE LOWER(email) = $1
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

    // 7. Lean profile payload: addresses and bookings are empty on login hotpath
    // Post-login data loading is handled asynchronously by the client
    const userObj = {
      id: candidate.id,
      email: candidate.email,
      name: candidate.name,
      phone: candidate.phone,
      avatar: candidate.avatar,
      role: candidate.role,
      addresses: [],
      bookings: [],
    };

    // 8. Generate JWT token
    const token = signJwtToken({
      userId: userObj.id,
      email: userObj.email,
      role: userObj.role,
      name: userObj.name,
    });

    const response = NextResponse.json({ success: true, user: userObj, token });
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 3600,
      path: "/",
    });

    return response;
  } catch (error: unknown) {
    console.error("[AUTH_LOGIN_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
