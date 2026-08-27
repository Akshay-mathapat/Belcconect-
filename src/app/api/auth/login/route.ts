import { NextResponse } from "next/server";
import { query, hashPassword } from "@/lib/db";
import { signJwtToken } from "@/lib/jwt";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const hashedPassword = hashPassword(password);

    let userObj: any = null;

    // 1. Check customers (role: user)
    const custRes = await query(
      "SELECT id, email, name, phone, avatar FROM customers WHERE email = $1 AND password_hash = $2",
      [cleanEmail, hashedPassword]
    );
    if (custRes.rows.length > 0) {
      userObj = { ...custRes.rows[0], role: "user" };
    }

    // 2. Check service_providers (role: provider)
    if (!userObj) {
      const provRes = await query(
        "SELECT id, email, name, phone, avatar FROM service_providers WHERE email = $1 AND password_hash = $2",
        [cleanEmail, hashedPassword]
      );
      if (provRes.rows.length > 0) {
        userObj = { ...provRes.rows[0], role: "provider" };
      }
    }

    // 3. Check job_providers (role: job_provider)
    if (!userObj) {
      const empRes = await query(
        "SELECT id, email, name, phone, avatar FROM job_providers WHERE email = $1 AND password_hash = $2",
        [cleanEmail, hashedPassword]
      );
      if (empRes.rows.length > 0) {
        userObj = { ...empRes.rows[0], role: "job_provider" };
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
