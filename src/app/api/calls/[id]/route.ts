import { NextResponse } from "next/server";
import { getCallById } from "@/lib/calls";
import { generateAgoraRtcToken } from "@/lib/agoraToken";
import { getAuthenticatedUser } from "@/lib/jwt";

function getNumericUid(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 90000000 + 10000000;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: callId } = await params;
    const { searchParams } = new URL(request.url);
    const authUser = getAuthenticatedUser(request);
    const userId = searchParams.get("userId") || authUser?.userId || request.headers.get("x-user-id");

    const call = await getCallById(callId);
    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    let agora = null;
    if (userId && (call.status === "ACCEPTED" || call.status === "CONNECTED")) {
      const isCaller = userId === call.callerId;
      let callerUid = getNumericUid(call.callerId);
      let receiverUid = getNumericUid(call.receiverId);
      if (callerUid === receiverUid) {
        receiverUid += 1000;
      }
      const targetUid = isCaller ? callerUid : receiverUid;
      agora = generateAgoraRtcToken(call.id, targetUid);
    }

    return NextResponse.json({
      success: true,
      call,
      agora
    });
  } catch (error: any) {
    console.error("Error getting call details:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
