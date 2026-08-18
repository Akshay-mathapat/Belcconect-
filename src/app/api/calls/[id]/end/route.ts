import { NextResponse } from "next/server";
import { getCallById, updateCallStatus } from "@/lib/calls";
import { callSignaling } from "@/lib/callSignaling";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: callId } = await params;
    const body = await request.json().catch(() => ({}));
    const headerUserId = request.headers.get("x-user-id");
    const userId = body.userId || headerUserId;

    const call = await getCallById(callId);
    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    if (userId && userId !== call.receiverId && userId !== call.callerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Determine status: if call was never answered, it's CANCELLED (if caller ended) or MISSED (if timeout)
    let newStatus: any = "ENDED";
    if (call.status === "INITIATED" || call.status === "RINGING") {
      newStatus = userId === call.callerId ? "CANCELLED" : "MISSED";
    }

    const updatedCall = await updateCallStatus(callId, newStatus);
    if (!updatedCall) {
      return NextResponse.json({ error: "Failed to end call" }, { status: 500 });
    }

    callSignaling.emitCallEvent({
      type: newStatus === "CANCELLED" ? "call:cancel" : "call:end",
      call: updatedCall,
      timestamp: Date.now()
    });

    return NextResponse.json({
      success: true,
      call: updatedCall
    });
  } catch (error: any) {
    console.error("Error ending call:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
