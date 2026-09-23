import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

export async function POST(request: Request) {
  try {
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized: Missing authentication token" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { blockedUserId, reason } = body;

    if (!blockedUserId || typeof blockedUserId !== "string") {
      return NextResponse.json(
        { error: "blockedUserId is required" },
        { status: 400 }
      );
    }

    const blockerId = authUser.userId;
    const targetUserId = blockedUserId.trim();

    // Prevent self-blocking
    if (blockerId === targetUserId) {
      return NextResponse.json(
        { error: "You cannot block yourself" },
        { status: 400 }
      );
    }

    // Verify target user actually exists in the platform
    const targetUserCheck = await query(
      `SELECT id FROM customers WHERE id = $1
       UNION
       SELECT id FROM service_providers WHERE id = $1
       LIMIT 1`,
      [targetUserId]
    );

    if (targetUserCheck.rows.length === 0) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }

    // Check duplicate block relationship
    const existing = await query(
      `SELECT id FROM user_blocks WHERE blocker_id = $1 AND blocked_user_id = $2 LIMIT 1`,
      [blockerId, targetUserId]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "This user is already blocked" },
        { status: 409 }
      );
    }

    const blockId = `blk-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const cleanReason = typeof reason === "string" ? reason.trim().slice(0, 100) : null;

    await query(
      `INSERT INTO user_blocks (id, blocker_id, blocked_user_id, reason)
       VALUES ($1, $2, $3, $4)`,
      [blockId, blockerId, targetUserId, cleanReason]
    );

    return NextResponse.json({
      success: true,
      message: "User blocked successfully"
    });
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "This user is already blocked" },
        { status: 409 }
      );
    }
    console.error("Error creating user block:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
