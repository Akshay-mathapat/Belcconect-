import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyJwtToken } from "@/lib/jwt";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let userId = searchParams.get("userId") || req.headers.get("x-user-id");

    if (!userId) {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const decoded = verifyJwtToken(authHeader.replace("Bearer ", ""));
        if (decoded?.userId) userId = decoded.userId;
      }
    }

    if (!userId) {
      userId = "customer-1";
    }

    const res = await query(
      `SELECT id, user_id as "userId", type, title, body, booking_id as "bookingId", is_read as "isRead", created_at as "createdAt"
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return NextResponse.json(res.rows);
  } catch (error: any) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, all, userId } = body;

    let targetUserId = userId || req.headers.get("x-user-id") || "customer-1";

    if (all) {
      await query(
        `UPDATE notifications SET is_read = TRUE WHERE user_id = $1`,
        [targetUserId]
      );
      return NextResponse.json({ success: true, message: "All notifications marked as read" });
    }

    if (!id) {
      return NextResponse.json({ error: "Notification ID or 'all: true' is required" }, { status: 400 });
    }

    await query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1`,
      [id]
    );

    return NextResponse.json({ success: true, message: "Notification marked as read" });
  } catch (error: any) {
    console.error("PATCH /api/notifications error:", error);
    return NextResponse.json({ error: error.message || "Failed to update notification" }, { status: 500 });
  }
}
