import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createCallReport } from "@/lib/calls";
import { getAuthenticatedUser } from "@/lib/jwt";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = getAuthenticatedUser(request);

    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: callId } = await params;

    if (!callId) {
      return NextResponse.json(
        { error: "Call ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { reason } = body || {};

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return NextResponse.json(
        { error: "reason is required" },
        { status: 400 }
      );
    }

    // Authoritative call lookup.
    // Never trust caller/receiver/reporter identity from the client.
    const callRes = await query(
      `SELECT id, caller_id, receiver_id
       FROM calls
       WHERE id = $1
       LIMIT 1`,
      [callId]
    );

    if (callRes.rows.length === 0) {
      return NextResponse.json(
        { error: "Call not found" },
        { status: 404 }
      );
    }

    const call = callRes.rows[0];

    const isParticipant =
      authUser.userId === call.caller_id ||
      authUser.userId === call.receiver_id;

    if (!isParticipant) {
      return NextResponse.json(
        { error: "Forbidden: You are not a participant in this call" },
        { status: 403 }
      );
    }

    // Reporter identity always comes from the authenticated JWT.
    const reporterId = authUser.userId;

    await createCallReport(
      callId,
      reporterId,
      reason.trim()
    );

    return NextResponse.json({
      success: true,
      message: "Call report submitted successfully",
    });
  } catch (error) {
    console.error("Error reporting call:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}