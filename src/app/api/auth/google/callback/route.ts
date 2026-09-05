import { NextResponse } from "next/server";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { resolveGoogleIdentity } from "@/lib/googleAuthHelper";
import { verifyOAuthState } from "@/lib/oauthState";
import { signJwtToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import {
  consumeGoogleOAuthTransaction,
  createMobileHandoffCode,
  storeMobileHandoff,
} from "@/lib/googleOAuthTransactions";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const APP_URL = process.env.APP_URL || (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000");
const MOBILE_REDIRECT_URI = "com.cityconnect.app://oauth/callback";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appOrigin = APP_URL ? new URL(APP_URL).origin : "";
  console.info("[GOOGLE_AUTH] redirectUriHost", APP_URL ? new URL(APP_URL).host : "missing");
  console.info("[GOOGLE_AUTH] callbackReceived", true);

  // Helper to return HTML postMessage or redirect back
  const renderCloseWindowScript = (messagePayload?: any, mobile = false) => {
    if (mobile) {
      const mobileUrl = new URL(MOBILE_REDIRECT_URI);
      if (messagePayload?.type) mobileUrl.searchParams.set("type", messagePayload.type);
      if (messagePayload?.error) mobileUrl.searchParams.set("error", messagePayload.error);
      if (messagePayload?.code) mobileUrl.searchParams.set("code", messagePayload.code);
      return NextResponse.redirect(mobileUrl);
    }

    const payloadStr = messagePayload ? JSON.stringify(messagePayload) : "null";
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Authentication Processing</title></head>
        <body>
          <script>
            if (window.opener) {
              const payload = ${payloadStr};
              if (payload) {
                window.opener.postMessage(payload, "${appOrigin}");
              }
              window.close();
            } else {
              window.location.href = "${appOrigin}/login";
            }
          </script>
          <p>Processing login... Please wait.</p>
        </body>
      </html>
    `;
    return new Response(html, { headers: { "Content-Type": "text/html" } });
  };

  // 1. Startup & Credential Config Checks
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !APP_URL) {
    console.error("[GOOGLE_OAUTH_CALLBACK_ERROR] Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or APP_URL");
    return renderCloseWindowScript({ type: "GOOGLE_AUTH_ERROR", error: "Server OAuth configuration error." });
  }

  const stateCheck = verifyOAuthState(state);
  console.info("[GOOGLE_AUTH] stateValid", stateCheck.valid);

  // 2. Strict CSRF State Validation
  if (!stateCheck.valid) {
    console.warn("[GOOGLE_OAUTH_CSRF_REJECT] Invalid or expired OAuth state parameter");
    return renderCloseWindowScript({
      type: "GOOGLE_AUTH_ERROR",
      error: "Security validation failed: Invalid or expired OAuth transaction state.",
    }, stateCheck.mobile);
  }

  // 3. Consume cancelled transactions too, so every valid state is single-use.
  if (error || !code) {
    if (stateCheck.codeChallenge) {
      const stateConsumed = await consumeGoogleOAuthTransaction({
        state: state || "",
        codeChallenge: stateCheck.codeChallenge,
      });
      if (!stateConsumed) {
        return renderCloseWindowScript({
          type: "GOOGLE_AUTH_ERROR",
          error: "Security validation failed: OAuth transaction is expired or already used.",
        }, stateCheck.mobile);
      }
    }
    return renderCloseWindowScript({ type: "GOOGLE_AUTH_CANCEL", error: "Google authentication was cancelled." }, stateCheck.mobile);
  }

  // 4. Exchange the authorization code only after state and PKCE validation.
  try {
    const redirectUri = `${appOrigin}/api/auth/google/callback`;
    const oAuth2Client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri);
    const oauthCookieStore = await cookies();
    const codeVerifier = oauthCookieStore.get("google_oauth_verifier")?.value;

    // 5. Exchange Auth Code for Tokens
    if (!stateCheck.codeChallenge || !codeVerifier) {
      throw new Error("Missing OAuth PKCE verifier");
    }
    const computedCodeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
    if (computedCodeChallenge !== stateCheck.codeChallenge) {
      throw new Error("OAuth PKCE verifier does not match state challenge");
    }
    const stateConsumed = await consumeGoogleOAuthTransaction({
      state: state || "",
      codeChallenge: stateCheck.codeChallenge,
    });
    if (!stateConsumed) {
      console.warn("[GOOGLE_OAUTH_CSRF_REJECT] OAuth state replay or expiry");
      return renderCloseWindowScript({
        type: "GOOGLE_AUTH_ERROR",
        error: "Security validation failed: OAuth transaction is expired or already used.",
      }, stateCheck.mobile);
    }
    const { tokens } = await oAuth2Client.getToken({ code, codeVerifier });
    const idToken = tokens.id_token;

    if (!idToken) {
      throw new Error("No ID Token returned by Google");
    }

    // 6. Cryptographic ID Token Verification
    const ticket = await oAuth2Client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error("Invalid Google token payload");
    }
    console.info("[GOOGLE_AUTH] tokenVerified", true);

    // 7. Unified Account Resolution & Role Safety Check
    const result = await resolveGoogleIdentity({
      googleId: payload.sub,
      email: payload.email || "",
      emailVerified: payload.email_verified || false,
      name: payload.name,
      picture: payload.picture,
      requestedRole: stateCheck.role,
    });

    if (result.error || !result.user) {
      return renderCloseWindowScript({
        type: "GOOGLE_AUTH_ERROR",
        error: result.error || "Account resolution failed.",
      }, stateCheck.mobile);
    }

    const userObj = result.user;

    // 8. Native apps receive a one-time opaque handoff code, never a JWT.
    if (stateCheck.mobile) {
      const handoff = createMobileHandoffCode();
      await storeMobileHandoff({ codeHash: handoff.codeHash, user: userObj });
      return renderCloseWindowScript({
        type: "GOOGLE_AUTH_SUCCESS",
        code: handoff.code,
      }, true);
    }

    // 9. Issue the canonical BelConnect JWT for desktop web OAuth.
    const token = signJwtToken({
      userId: userObj.id,
      email: userObj.email,
      role: userObj.role,
      name: userObj.name,
    });
    console.info("[GOOGLE_AUTH] localJwtIssued", true);

    // 10. Next.js Cookie Handling for desktop web OAuth.
    const cookieStore = await cookies();
    cookieStore.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 3600,
      path: "/",
    });

    // 11. Send postMessage targeting STRICT trusted origin (NO WILD CARD "*")
    return renderCloseWindowScript({
      type: "GOOGLE_AUTH_SUCCESS",
      token,
      user: userObj,
    }, stateCheck.mobile);
  } catch (err: any) {
    console.error("[GOOGLE_OAUTH_CALLBACK_ERROR]", err?.message || err);
    return renderCloseWindowScript({
      type: "GOOGLE_AUTH_ERROR",
      error: "Google authentication failed.",
    }, stateCheck.mobile);
  }
}
