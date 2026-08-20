import { NextResponse } from "next/server";
import { getActiveCallForUser } from "@/lib/calls";
import { generateAgoraRtcToken, resolveUserAgoraUid } from "@/lib/agoraToken";
import { getAuthenticatedUser } from "@/lib/jwt";

function getNumericUid(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 90000000 + 10000000;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const authUser = getAuthenticatedUser(request);
    const userId = searchParams.get("userId") || authUser?.userId || request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ activeCall: null });
    }

    const call = await getActiveCallForUser(userId);
    if (!call) {
      return NextResponse.json({ activeCall: null });
    }

    let agora = null;
    if (call.status === "ACCEPTED" || call.status === "CONNECTED") {
      const { targetUid } = resolveUserAgoraUid(userId, call);
      agora = generateAgoraRtcToken(call.id, targetUid);
    }

    return NextResponse.json({
      success: true,
      call,
      agora
    });
  } catch (error: any) {
    return NextResponse.json({ activeCall: null });
  }
}
