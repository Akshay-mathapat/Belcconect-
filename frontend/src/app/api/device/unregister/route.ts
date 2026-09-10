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

    const body = await request.json().catch(() => ({}));
    const { token } = body;
    const userId = authUser.userId;

    if (token && typeof token === "string") {
      await query(
        `DELETE FROM device_push_tokens WHERE user_id = $1 AND token = $2`,
        [userId, token.trim()]
      );
    } else {
      await query(
        `DELETE FROM device_push_tokens WHERE user_id = $1`,
        [userId]
      );
    }

    return NextResponse.json({
      success: true,
      message: "Device unregistered successfully"
    });
  } catch (error: any) {
    console.error("[Device Unregister API] Error unregistering device:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

