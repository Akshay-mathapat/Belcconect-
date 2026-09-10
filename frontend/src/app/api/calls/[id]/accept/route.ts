import { NextResponse } from "next/server";
import { getCallById, updateCallStatus } from "@/lib/calls";
import { generateLiveKitToken } from "@/lib/livekitToken";
import { sendCallSignal } from "@/lib/socketSignaling";
import { callSignaling } from "@/lib/callSignaling";
import { getAuthenticatedUser } from "@/lib/jwt";

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

    const call = await getCallById(callId);
    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    // Authorization: strict recipient match (with demo mode support)
    const isDemo = process.env.DEMO_MODE === "true";
    const isReceiver =
      call.receiverId === authUser.userId ||
      (isDemo && (
        (authUser.userId.includes("prov") || authUser.role === "provider") && (call.receiverId.includes("prov") || call.receiverId === "provider-1") ||
        (authUser.userId.includes("cust") || authUser.role === "user" || (authUser.role as string) === "customer") && (call.receiverId.includes("cust") || call.receiverId === "customer-1")
      ));

    if (!isReceiver) {
      return NextResponse.json({ error: "Forbidden: Only the call receiver can accept this call" }, { status: 403 });
    }

    // Idempotent recovery if already ACCEPTED or CONNECTED by this receiver
    if (call.status === "ACCEPTED" || call.status === "CONNECTED") {
      const [callerLiveKit, receiverLiveKit] = await Promise.all([
        generateLiveKitToken(call.bookingId, call.callerId),
        generateLiveKitToken(call.bookingId, call.receiverId)
      ]);
      const currentLiveKit = authUser.userId === call.callerId ? callerLiveKit : receiverLiveKit;
      return NextResponse.json({
        success: true,
        call,
        livekit: currentLiveKit,
        idempotent: true
      });
    }

    // Call status check: must be INITIATED or RINGING
    if (call.status !== "INITIATED" && call.status !== "RINGING") {
      return NextResponse.json(
        { error: `Cannot accept call in status '${call.status}'` },
        { status: 400 }
      );
    }

    const updatedCall = await updateCallStatus(callId, "ACCEPTED");
    if (!updatedCall) {
      return NextResponse.json({ error: "Failed to update call status" }, { status: 500 });
    }

    const [callerLiveKit, receiverLiveKit] = await Promise.all([
      generateLiveKitToken(updatedCall.bookingId, updatedCall.callerId),
      generateLiveKitToken(updatedCall.bookingId, updatedCall.receiverId)
    ]);

    // Non-blocking fire-and-forget signal broadcast to caller and receiver
    Promise.all([
      sendCallSignal({
        type: "call:accept",
        targetUserId: updatedCall.callerId,
        call: updatedCall,
        livekit: callerLiveKit
      }),
      sendCallSignal({
        type: "call:accept",
        targetUserId: updatedCall.receiverId,
        call: updatedCall,
        livekit: receiverLiveKit
      })
    ]).catch((err) => {
      console.error("[Accept API] Signal relay failed:", err);
    });

    // Backward compatibility local event emitter
    callSignaling.broadcastToUser(updatedCall.callerId, {
      type: "call:accept",
      call: updatedCall,
      livekit: callerLiveKit,
      timestamp: Date.now()
    });

    callSignaling.broadcastToUser(updatedCall.receiverId, {
      type: "call:accept",
      call: updatedCall,
      livekit: receiverLiveKit,
      timestamp: Date.now()
    });

    const currentLiveKit = authUser.userId === updatedCall.callerId ? callerLiveKit : receiverLiveKit;

    // Immediate fast return to client (<30ms)
    return NextResponse.json({
      success: true,
      call: updatedCall,
      livekit: currentLiveKit
    });
  } catch (error: any) {
    console.error("Error accepting call:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
