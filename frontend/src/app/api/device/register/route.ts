import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized: Missing authentication session" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { token, platform = "android" } = body;

    if (!token || typeof token !== "string" || token.trim().length === 0) {
      return NextResponse.json(
        { error: "Device token is required" },
        { status: 400 }
      );
    }

    const userId = authUser.userId;
    const id = `dt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    await query(
      `INSERT INTO device_push_tokens (id, user_id, token, platform, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (token) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           platform = EXCLUDED.platform,
           updated_at = NOW()`,
      [id, userId, token.trim(), platform]
    );

    return NextResponse.json({
      success: true,
      message: "Device registered for native push notifications"
    });
  } catch (error: any) {
    console.error("[Device Register API] Error registering device token:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

