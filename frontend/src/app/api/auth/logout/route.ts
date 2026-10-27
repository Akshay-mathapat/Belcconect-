import { NextResponse } from "next/server";
import { getSessionTokenFromRequest, revokeSession, clearSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
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

  return response;
}

