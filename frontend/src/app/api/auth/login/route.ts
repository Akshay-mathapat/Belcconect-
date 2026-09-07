import { NextResponse } from "next/server";
import { query, verifyPassword } from "@/lib/db";
import { signJwtToken } from "@/lib/jwt";
import { checkRateLimit } from "@/lib/rateLimit";
import { parseAndValidate, loginSchema } from "@/lib/validations";

export async function POST(request: Request) {
  // 1. Rate Limiting Check (Max 5 attempts per 5 minutes)
  const rateLimit = checkRateLimit(request, 5, 5 * 60 * 1000);
  if (!rateLimit.isAllowed && rateLimit.response) {
    return rateLimit.response;
  }

  try {
    // 2. Strict Zod Schema Validation
    const validation = await parseAndValidate(request, loginSchema);
    if (validation.response) {
      return validation.response;
    }

    const { email, password } = validation.data;
    const cleanEmail = email.trim().toLowerCase();

    let userObj: any = null;

    // 1. Check customers (role: user)
    const custRes = await query(
      "SELECT id, email, name, phone, avatar, password_hash FROM customers WHERE email = $1",
      [cleanEmail]
    );
    if (custRes.rows.length > 0) {
      const candidate = custRes.rows[0];
      const isMatch = await verifyPassword(password, candidate.password_hash);
      if (isMatch) {
        userObj = { ...candidate, role: "user" };
        delete userObj.password_hash;
      }
    }

    // 2. Check service_providers (role: provider)
    if (!userObj) {
      const provRes = await query(
        "SELECT id, email, name, phone, avatar, password_hash FROM service_providers WHERE email = $1",
        [cleanEmail]
      );
      if (provRes.rows.length > 0) {
        const candidate = provRes.rows[0];
        const isMatch = await verifyPassword(password, candidate.password_hash);
        if (isMatch) {
          userObj = { ...candidate, role: "provider" };
          delete userObj.password_hash;
        }
      }
    }

    // 3. Check job_providers (role: job_provider)
    if (!userObj) {
      const empRes = await query(
        "SELECT id, email, name, phone, avatar, password_hash FROM job_providers WHERE email = $1",
        [cleanEmail]
      );
      if (empRes.rows.length > 0) {
        const candidate = empRes.rows[0];
        const isMatch = await verifyPassword(password, candidate.password_hash);
        if (isMatch) {
          userObj = { ...candidate, role: "job_provider" };
          delete userObj.password_hash;
        }
      }
    }

    if (!userObj) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // Load customer addresses & bookings if customer logged in
    if (userObj.role === "user") {
      const addrRes = await query("SELECT id, type, text FROM addresses WHERE user_id = $1", [userObj.id]);
      userObj.addresses = addrRes.rows || [];

      const bookRes = await query(
        `SELECT b.id, b.service_name, b.provider_name, b.provider_id, b.date, b.time, b.status, b.rating, b.review_comment, b.created_at
         FROM bookings b WHERE b.customer_id = $1 ORDER BY b.created_at DESC`,
        [userObj.id]
      );
      userObj.bookings = (bookRes.rows || []).map((b: any) => ({
        id: b.id,
        service: b.service_name,
        provider: b.provider_name || "Verified Expert",
        providerId: b.provider_id,
        date: `${b.date} at ${b.time}`,
        status: b.status || "Requested",
        rating: b.rating,
        reviewComment: b.review_comment,
        createdAt: b.created_at ? new Date(b.created_at).toISOString() : new Date().toISOString()
      }));
    } else {
      userObj.addresses = [];
      userObj.bookings = [];
    }

    // Generate JWT token
    const token = signJwtToken({
      userId: userObj.id,
      email: userObj.email,
      role: userObj.role,
      name: userObj.name
    });

    const response = NextResponse.json({ success: true, user: userObj, token });
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 3600,
      path: "/"
    });

    return response;
  } catch (error: any) {
    console.error("Error in login API:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
