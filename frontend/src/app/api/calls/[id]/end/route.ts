import { NextResponse } from "next/server";
import { getCallById, updateCallStatus } from "@/lib/calls";
import { sendCallSignal } from "@/lib/socketSignaling";
import { callSignaling } from "@/lib/callSignaling";
import { getAuthenticatedUser } from "@/lib/jwt";
import { sendPushToUser, sendCallPushWakeUp } from "@/lib/pushNotifications";

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

    const call = await getCallById(callId);
    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    if (authUser.userId !== call.receiverId && authUser.userId !== call.callerId) {
      return NextResponse.json({ error: "Forbidden: You are not a participant in this call" }, { status: 403 });
    }

    // Determine status transition
    let newStatus: any = "ENDED";
    if (call.status === "INITIATED" || call.status === "RINGING") {
      newStatus = authUser.userId === call.callerId ? "CANCELLED" : "MISSED";
    }

    const updatedCall = await updateCallStatus(callId, newStatus);
    if (!updatedCall) {
      return NextResponse.json({ error: "Failed to end call" }, { status: 500 });
    }

    const signalType = newStatus === "CANCELLED" ? "call:cancel" : "call:end";

    // Non-blocking fire-and-forget signal relay to caller and receiver
    sendCallSignal({
      type: signalType,
      targetUserIds: [updatedCall.callerId, updatedCall.receiverId],
      call: updatedCall
    }).catch((err) => console.error("[End API] Signal relay failed:", err));

    callSignaling.emitCallEvent({
      type: signalType,
      call: updatedCall,
      timestamp: Date.now()
    });

    // Dismiss Web Push and Native Android Push notification banners for both participants
    const pushCancelData = {
      type: "call:cancelled" as const,
      callId: updatedCall.id
    };
    sendCallPushWakeUp(updatedCall.callerId, pushCancelData).catch(() => {});
    sendCallPushWakeUp(updatedCall.receiverId, pushCancelData).catch(() => {});

    return NextResponse.json({
      success: true,
      call: updatedCall
    });
  } catch (error: any) {
    console.error("Error ending call:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
