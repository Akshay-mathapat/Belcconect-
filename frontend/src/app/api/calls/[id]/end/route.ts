import { NextResponse } from "next/server";
import { getCallById, updateCallStatus, CallEndReason, CallParticipantRole } from "@/lib/calls";
import { sendCallSignal } from "@/lib/socketSignaling";
import { callSignaling } from "@/lib/callSignaling";
import { getAuthenticatedUser } from "@/lib/jwt";
import { sendCallPushWakeUp } from "@/lib/pushNotifications";

const TERMINAL_STATUSES = ["ENDED", "REJECTED", "CANCELLED", "MISSED", "FAILED"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: callId } = await params;
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized: Missing authentication session" }, { status: 401 });
    }
    console.log(`[CALL-END] authenticated user=${authUser.userId}`);

    const call = await getCallById(callId);
    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }
    console.log(`[CALL-END] call found id=${call.id} status=${call.status}`);

    if (authUser.userId !== call.receiverId && authUser.userId !== call.callerId) {
      return NextResponse.json({ error: "Forbidden: You are not a participant in this call" }, { status: 403 });
    }

    // Idempotent: If already in a terminal state, return current record without error
    if (TERMINAL_STATUSES.includes(call.status)) {
      return NextResponse.json({
        success: true,
        call,
        alreadyEnded: true
      });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional
    }

    // Determine status transition & reason
    let newStatus: any = "ENDED";
    let reason: CallEndReason = (body.reason as CallEndReason) || "ended";

    if (call.status === "INITIATED" || call.status === "RINGING") {
      if (authUser.userId === call.callerId) {
        newStatus = "CANCELLED";
        reason = "cancelled";
      } else {
        newStatus = "MISSED";
        reason = "missed";
      }
    }

    const endedByRole: CallParticipantRole = authUser.userId === call.callerId ? "customer" : "provider";
    const endedByName = authUser.userId === call.callerId
      ? (call.callerName || "Customer")
      : (call.receiverName || "Service Provider");

    const updatedCall = await updateCallStatus(callId, newStatus, {
      endReason: reason,
      endedByUserId: authUser.userId,
      endedByRole
    });

    if (!updatedCall) {
      return NextResponse.json({ error: "Failed to end call" }, { status: 500 });
    }
    console.log(`[CALL-END] DB terminal update success callId=${callId} status=${newStatus} reason=${reason}`);

    const endedAt = updatedCall.endedAt || new Date().toISOString();
    const signalType = newStatus === "CANCELLED" ? "call:cancel" : "call:end";

    // 1. Canonical call:ended and legacy signal relays (awaited so Vercel does not terminate early)
    await Promise.allSettled([
      sendCallSignal({
        type: "call:ended",
        targetUserIds: [updatedCall.callerId, updatedCall.receiverId],
        call: updatedCall,
        reason,
        endedByUserId: authUser.userId,
        endedByRole,
        endedByName,
        endedAt
      }).catch((err) => console.error("[End API] Canonical signal relay failed:", err)),

      sendCallSignal({
        type: signalType,
        targetUserIds: [updatedCall.callerId, updatedCall.receiverId],
        call: updatedCall
      }).catch((err) => console.error("[End API] Legacy signal relay failed:", err))
    ]);

    callSignaling.emitCallEvent({
      type: "call:ended",
      call: updatedCall,
      reason,
      endedByUserId: authUser.userId,
      endedByRole,
      endedByName,
      endedAt,
      timestamp: Date.now()
    });

    // 3. Dismiss Web Push and Native Android Push notification banners for both participants (awaited)
    const pushCancelData = {
      type: "call_ended" as const,
      callId: updatedCall.id,
      bookingId: updatedCall.bookingId,
      reason,
      endedByUserId: authUser.userId,
      endedByRole,
      endedByName,
      endedAt
    };
    await Promise.allSettled([
      sendCallPushWakeUp(updatedCall.callerId, pushCancelData).catch(() => {}),
      sendCallPushWakeUp(updatedCall.receiverId, pushCancelData).catch(() => {})
    ]);

    return NextResponse.json({
      success: true,
      call: updatedCall
    });
  } catch (error: any) {
    console.error("Error ending call:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
