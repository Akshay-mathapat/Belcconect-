import { NextResponse } from "next/server";
import { sendPushToUser } from "@/lib/pushNotifications";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { secret, userId, title, body: pushBody, icon, data } = body;

    // DO NOT FALL BACK TO ANY DEFAULT VALUE, EMPTY STRING INCLUDED, FOR A SECRET USED IN AN AUTHORIZATION OR SIGNATURE CHECK — FAIL STARTUP INSTEAD.
    const internalSecret = process.env.SIGNALING_INTERNAL_SECRET || process.env.INTERNAL_API_SECRET;
    if (!internalSecret && typeof window === "undefined") {
      throw new Error("FATAL: SIGNALING_INTERNAL_SECRET environment variable is missing.");
    }
    if (!secret || secret !== internalSecret) {
      return NextResponse.json({ error: "Forbidden: Invalid internal secret" }, { status: 403 });
    }

    if (!userId || !title) {
      return NextResponse.json({ error: "userId and title are required" }, { status: 400 });
    }

    // Trigger push notification non-blockingly
    sendPushToUser(userId, {
      title,
      body: pushBody || "",
      icon: icon || "/BelConnectLogo.png",
      data: data || {}
    }).catch(() => {});

    return NextResponse.json({ success: true, message: "Push notification triggered" });
  } catch (error: any) {
    console.error("[Push Send API Error]:", error);
    return NextResponse.json({ error: "Failed to send push notification" }, { status: 500 });
  }
}
