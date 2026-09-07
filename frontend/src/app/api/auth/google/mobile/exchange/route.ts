import { NextResponse } from "next/server";
import { signJwtToken } from "@/lib/jwt";
import { checkRateLimit } from "@/lib/rateLimit";
import { consumeMobileHandoff } from "@/lib/googleOAuthTransactions";

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, 10, 5 * 60 * 1000);
  if (!rateLimit.isAllowed && rateLimit.response) return rateLimit.response;

  try {
    const body = await request.json();
    const code = typeof body?.code === "string" ? body.code : "";
    if (!/^[A-Za-z0-9_-]{40,100}$/.test(code)) {
      return NextResponse.json({ error: "Invalid or expired mobile sign-in code." }, { status: 401 });
    }

    const user = await consumeMobileHandoff(code);
    if (!user) {
      return NextResponse.json({ error: "Invalid or expired mobile sign-in code." }, { status: 401 });
    }

    const token = signJwtToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });
    console.info("[GOOGLE_AUTH] localJwtIssued", true);

    const response = NextResponse.json({
      success: true,
      user,
      token,
    });
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 3600,
      path: "/",
    });
    return response;
  } catch (error: unknown) {
    console.error("[GOOGLE_AUTH_MOBILE_EXCHANGE_ERROR]", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Mobile sign-in exchange failed." }, { status: 500 });
  }
}
