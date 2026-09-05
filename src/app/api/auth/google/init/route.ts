import { NextResponse } from "next/server";
import crypto from "crypto";
import { createOAuthState } from "@/lib/oauthState";
import { storeGoogleOAuthTransaction } from "@/lib/googleOAuthTransactions";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") || "user";
  const mobile = searchParams.get("mobile") === "1";

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const appUrl = process.env.APP_URL || (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000");

  if (!clientId || !appUrl) {
    return NextResponse.json(
      { error: "Google OAuth Client ID is missing on the server." },
      { status: 500 }
    );
  }

  const appOrigin = new URL(appUrl).origin;
  const redirectUri = `${appOrigin}/api/auth/google/callback`;

  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

  // Generate cryptographically signed single-use state containing role and PKCE challenge.
  const state = createOAuthState(role, mobile, codeChallenge);
  await storeGoogleOAuthTransaction({ state, codeChallenge, role });

  const scope = encodeURIComponent("openid email profile");
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=${scope}&state=${encodeURIComponent(
    state
  )}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256&prompt=select_account`;

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("google_oauth_verifier", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });
  return response;
}
