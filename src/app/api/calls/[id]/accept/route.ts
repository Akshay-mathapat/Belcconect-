import { NextResponse } from "next/server";
import { getCallById, updateCallStatus } from "@/lib/calls";
import { generateAgoraRtcToken, resolveUserAgoraUid } from "@/lib/agoraToken";
import { callSignaling } from "@/lib/callSignaling";
import { getAuthenticatedUser } from "@/lib/jwt";

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

    const updatedCall = await updateCallStatus(callId, "ACCEPTED");
    if (!updatedCall) {
      return NextResponse.json({ error: "Failed to update call status" }, { status: 500 });
    }

    const { callerUid, receiverUid, targetUid } = resolveUserAgoraUid(authUser.userId, updatedCall);

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

    const currentAgora = generateAgoraRtcToken(updatedCall.id, targetUid);

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
