import { NextResponse } from "next/server";
import { getCallById, updateCallStatus } from "@/lib/calls";
import { generateAgoraRtcToken } from "@/lib/agoraToken";
import { callSignaling } from "@/lib/callSignaling";
import { getAuthenticatedUser } from "@/lib/jwt";

function getNumericUid(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 90000000 + 10000000;
}

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

    const userId = authUser.userId;

    // Verify authorized call participant
    const isCaller = userId === call.callerId;
    const isReceiver = userId === call.receiverId || (userId.includes("provider") && call.receiverId.includes("provider")) || (userId.includes("customer") && call.receiverId.includes("customer"));

    if (!isCaller && !isReceiver && userId !== call.callerId && userId !== call.receiverId) {
      return NextResponse.json({ error: "Forbidden: You are not authorized to accept this call" }, { status: 403 });
    }

    const updatedCall = await updateCallStatus(callId, "ACCEPTED");
    if (!updatedCall) {
      return NextResponse.json({ error: "Failed to update call status" }, { status: 500 });
    }

    // Generate Agora Credentials with guaranteed distinct UIDs
    let callerUid = getNumericUid(updatedCall.callerId);
    let receiverUid = getNumericUid(updatedCall.receiverId);
    if (callerUid === receiverUid) {
      receiverUid += 1000;
    }

    const callerAgora = generateAgoraRtcToken(updatedCall.id, callerUid);
    const receiverAgora = generateAgoraRtcToken(updatedCall.id, receiverUid);

    // Broadcast call:accept to both users
    callSignaling.broadcastToUser(updatedCall.callerId, {
      type: "call:accept",
      call: updatedCall,
      agora: callerAgora,
      timestamp: Date.now()
    });

    callSignaling.broadcastToUser(updatedCall.receiverId, {
      type: "call:accept",
      call: updatedCall,
      agora: receiverAgora,
      timestamp: Date.now()
    });

    const currentAgora = isCaller ? callerAgora : receiverAgora;

    return NextResponse.json({
      success: true,
      call: updatedCall,
      agora: currentAgora
    });
  } catch (error: any) {
    console.error("Error accepting call:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
