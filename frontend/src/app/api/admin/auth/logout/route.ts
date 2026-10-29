import { assertCsrfOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getSessionTokenFromRequest, revokeSession, clearSessionCookie } from "@/lib/session";

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

  clearSessionCookie(response.headers, "admin");
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

  return response;
}
