import { NextResponse } from "next/server";
import { query, verifyPassword } from "@/lib/db";
import { signJwtToken } from "@/lib/jwt";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
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

    // 4. Issue JWT with role "admin"
    const token = signJwtToken({
      userId: admin.id,
      email: admin.email,
      role: "admin"
    });

    const response = NextResponse.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        role: "admin"
      }
    });

    // Set secure auth cookie
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 3600
    });

    return response;
  } catch (error: any) {
    console.error("Admin login error:", error?.message || error);
    return NextResponse.json(
      { error: "Internal server error during authentication." },
      { status: 500 }
    );
  }
}

