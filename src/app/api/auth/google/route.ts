import { NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { query } from "@/lib/db";
import { signJwtToken } from "@/lib/jwt";
import { checkRateLimit } from "@/lib/rateLimit";
import { parseAndValidate, googleAuthSchema } from "@/lib/validations";
import { resolveGoogleIdentity } from "@/lib/googleAuthHelper";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export async function POST(request: Request) {
  // 1. Rate Limiting Check
  const rateLimit = checkRateLimit(request, 10, 5 * 60 * 1000);
  if (!rateLimit.isAllowed && rateLimit.response) {
    return rateLimit.response;
  }

  // 2. Startup / Secret Config Validation
  if (!GOOGLE_CLIENT_ID) {
    console.error("[GOOGLE_AUTH_ERROR] GOOGLE_CLIENT_ID is not configured");
    return NextResponse.json(
      { error: "Google OAuth is not configured on the server." },
      { status: 500 }
    );
  }

  try {
    const validation = await parseAndValidate(request, googleAuthSchema);
    if (validation.response) {
      return validation.response;
    }

    const { credential } = validation.data;

    // 3. Cryptographic Verification of Google ID Token
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
    } catch (err: any) {
      console.error("[GOOGLE_AUTH_ERROR] Invalid Google ID token:", err?.message || err);
      return NextResponse.json(
        { error: "Invalid or expired Google credential." },
        { status: 401 }
      );
    }

    const payload = ticket.getPayload();
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid Google credential payload." },
        { status: 401 }
      );
    }

    // 4. Unified Google User Resolution
    const result = await resolveGoogleIdentity({
      googleId: payload.sub,
      email: payload.email || "",
      emailVerified: payload.email_verified || false,
      name: payload.name,
      picture: payload.picture,
      // Direct ID-token sign-in has no server-side OAuth transaction. Keep this
      // legacy endpoint customer-only; role-specific sign-in uses /init.
      requestedAccountType: "customer",
    });

    if (result.error || !result.user) {
      return NextResponse.json(
        { error: result.error || "Authentication failed." },
        { status: result.statusCode || 400 }
      );
    }

    const userObj = result.user;

    // Load customer addresses & bookings if customer
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

    // 5. Issue Canonical BelConnect JWT Token
    const token = signJwtToken({
      userId: userObj.id,
      email: userObj.email,
      role: userObj.role,
      name: userObj.name
    });

    const response = NextResponse.json({ success: true, user: userObj, token });
    
    // Cookie Handling
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 3600,
      path: "/"
    });

    return response;
  } catch (error: any) {
    console.error("Error in google auth API:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
