import { NextResponse } from "next/server";
import { getCallById, timeoutCall } from "@/lib/calls";
import { sendCallSignal } from "@/lib/socketSignaling";
import { callSignaling } from "@/lib/callSignaling";
import { getAuthenticatedUser } from "@/lib/jwt";
import { sendCallPushWakeUp, sendPushToUser } from "@/lib/pushNotifications";

export const runtime = "nodejs";

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

    const currentCall = await getCallById(callId);
    if (!currentCall) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    // Participant verification
    const isParticipant =
      authUser.userId === currentCall.callerId ||
      authUser.userId === currentCall.receiverId ||
      (process.env.DEMO_MODE === "true" && (authUser.userId.includes("prov") || authUser.userId.includes("cust")));

    if (!isParticipant) {
      return NextResponse.json({ error: "Forbidden: You are not a participant in this call" }, { status: 403 });
    }

    // If call is already terminal, return idempotent success
    if (["ENDED", "REJECTED", "CANCELLED", "MISSED", "FAILED"].includes(currentCall.status)) {
      return NextResponse.json({
        success: true,
        call: currentCall,
        alreadyEnded: true
      });
    }

    // If call is already accepted or connected, do NOT timeout
    if (["ACCEPTED", "CONNECTED"].includes(currentCall.status)) {
      return NextResponse.json({
        success: false,
        call: currentCall,
        error: "Call has already been answered and is active."
      }, { status: 409 });
    }

    // Atomically timeout the call in the database
    const updatedCall = await timeoutCall(callId);
    if (!updatedCall) {
      // Re-fetch in case a race condition answered or ended it in parallel
      const refreshed = await getCallById(callId);
      return NextResponse.json({
        success: refreshed ? ["ENDED", "REJECTED", "CANCELLED", "MISSED"].includes(refreshed.status) : false,
        call: refreshed,
        message: "Call status was modified concurrently."
      });
    }

    console.log(`[CALL_TIMEOUT] Call ${callId} successfully transitioned to MISSED (end_reason=timeout)`);
    const endedAt = updatedCall.endedAt || new Date().toISOString();

    // 1. Dispatch real-time Socket.IO signals to both caller and receiver
    await Promise.allSettled([
      sendCallSignal({
        type: "call:ended",
        targetUserIds: [updatedCall.callerId, updatedCall.receiverId],
        call: updatedCall,
        reason: "timeout",
        endedByUserId: authUser.userId,
        endedByRole: authUser.userId === updatedCall.callerId ? "customer" : "provider",
        endedByName: "System Timeout",
        endedAt
      }).catch((err) => console.error("[CALL_TIMEOUT] Signal relay failed:", err)),

      sendCallSignal({
        type: "call:timeout",
        targetUserId: updatedCall.callerId,
        call: updatedCall,
        reason: "timeout"
      }).catch((err) => console.error("[CALL_TIMEOUT] Caller timeout signal failed:", err)),

      sendCallSignal({
        type: "call:missed",
        targetUserId: updatedCall.receiverId,
        call: updatedCall,
        reason: "timeout"
      }).catch((err) => console.error("[CALL_TIMEOUT] Missed signal relay failed:", err))
    ]);

    callSignaling.emitCallEvent({
      type: "call:ended",
      call: updatedCall,
      reason: "timeout",
      endedAt,
      timestamp: Date.now()
    });

    // 2. Dispatch FCM Push: Dedicated Missed Call notification to RECEIVER ONLY
    const receiverCallerName = updatedCall.callerName || "Customer";
    const receiverServiceName = updatedCall.serviceName || "Voice Call";

    sendCallPushWakeUp(updatedCall.receiverId, {
      type: "missed_call" as const,
      callId: updatedCall.id,
      bookingId: updatedCall.bookingId,
      callerName: receiverCallerName,
      serviceName: receiverServiceName,
      reason: "timeout",
      endedAt
    }).catch((err) => console.error("[Timeout API] Receiver FCM missed call push failed:", err));

    sendPushToUser(updatedCall.receiverId, {
      title: "Missed Call",
      body: `You have a missed call from ${receiverCallerName}`,
      data: {
        type: "missed_call",
        callId: updatedCall.id,
        bookingId: updatedCall.bookingId
      }
    }).catch(() => {});

    // 3. Dismiss caller's outgoing call heads-up notification (NEVER send missed-call notification to caller)
    sendCallPushWakeUp(updatedCall.callerId, {
      type: "call_ended" as const,
      callId: updatedCall.id,
      bookingId: updatedCall.bookingId,
      reason: "timeout",
      endedAt
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      call: updatedCall,
      timedOut: true
    });
  } catch (error: any) {
    console.error("[CALL_TIMEOUT] Error timing out call:", error);
    return NextResponse.json({ error: "Internal server error during call timeout" }, { status: 500 });
  }
}
