import { assertCsrfOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getSessionTokenFromRequest, revokeSession, clearSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  const csrfError = await assertCsrfOrigin(request);
  if (csrfError) return csrfError;

  const token = getSessionTokenFromRequest(request, "user");
  if (token) {
    try {
      await revokeSession(token);
    } catch (err: any) {
      console.warn("[Auth Logout] Non-fatal revokeSession error:", err?.message);
    }
  }

  const response = NextResponse.json({
    success: true,
    message: "Logged out successfully."
  });

  clearSessionCookie(response.headers, "user");
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

  return response;
}
