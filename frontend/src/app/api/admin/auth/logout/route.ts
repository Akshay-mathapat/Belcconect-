import { assertCsrfOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getSessionTokenFromRequest, revokeSession, clearSessionCookie, getCookieConfig } from "@/lib/session";

export async function POST(request: Request) {
  const csrfError = await assertCsrfOrigin(request);
  if (csrfError) return csrfError;

  const token = getSessionTokenFromRequest(request, "admin");
  if (token) {
    try {
      await revokeSession(token);
    } catch (err: any) {
      console.warn("[Admin Logout] Non-fatal revokeSession error:", err?.message);
    }
  }

  const response = NextResponse.json({
    success: true,
    message: "Admin logged out successfully."
  });

  const { name: adminCookieName, isSecure: adminCookieSecure } = getCookieConfig("admin");
  response.cookies.set(adminCookieName, "", {
    httpOnly: true,
    secure: adminCookieSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  response.cookies.set("auth_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  clearSessionCookie(response.headers, "admin");
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

  return response;
}
