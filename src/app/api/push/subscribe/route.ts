import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

export async function POST(req: Request) {
  try {
    const authUser = getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized: Missing authentication token" }, { status: 401 });
    }

    const body = await req.json();
    const { subscription } = body;
    const userId = authUser.userId;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { error: "Valid push subscription object is required" },
        { status: 400 }
      );
    }

    const { endpoint, keys } = subscription;
    const { p256dh, auth } = keys;

    if (!p256dh || !auth) {
      return NextResponse.json({ error: "Subscription p256dh and auth keys are required" }, { status: 400 });
    }

    const subId = `sub-${Date.now()}-${Math.floor(Math.random() * 8999 + 1000)}`;

    await query(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (endpoint) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth,
         updated_at = NOW()`,
      [subId, userId, endpoint, p256dh, auth]
    );

    return NextResponse.json({ success: true, message: "Push subscription saved successfully" });
  } catch (error: any) {
    console.error("[Push Subscribe API Error]:", error);
    return NextResponse.json({ error: "Failed to save push subscription" }, { status: 500 });
  }
}
