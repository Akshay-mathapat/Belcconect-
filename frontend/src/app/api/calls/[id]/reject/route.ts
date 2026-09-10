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

    const updatedCall = await updateCallStatus(callId, "REJECTED");
    if (!updatedCall) {
      return NextResponse.json({ error: "Failed to update call" }, { status: 500 });
    }

    // Non-blocking fire-and-forget Socket.IO signal dispatch
    sendCallSignal({
      type: "call:reject",
      targetUserIds: [updatedCall.callerId, updatedCall.receiverId],
      call: updatedCall
    }).catch((err) => console.error("[Reject API] Signal relay failed:", err));

    callSignaling.emitCallEvent({
      type: "call:reject",
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
    console.error("Error rejecting call:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
