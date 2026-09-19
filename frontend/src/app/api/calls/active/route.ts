import { NextResponse } from "next/server";
import { getActiveCallForUser, getRecentTerminalCallForUser } from "@/lib/calls";
import { generateLiveKitToken } from "@/lib/livekitToken";
import { getAuthenticatedUser } from "@/lib/jwt";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ activeCall: null, call: null });
    }

    const userId = authUser.userId;
    const call = await getActiveCallForUser(userId);
    if (!call) {
      // Fast polling synchronization fallback: check if user had a call terminated in the last 15 seconds
      const recentTerminalCall = await getRecentTerminalCallForUser(userId, 15);
      if (recentTerminalCall) {
        return NextResponse.json({
          success: true,
          call: recentTerminalCall,
          isTerminal: true
        });
      }
      return NextResponse.json({ activeCall: null, call: null });
    }

    return NextResponse.json({
      success: true,
      call,
      livekit: null
    });
  } catch (error: any) {
    return NextResponse.json({ activeCall: null, call: null });
  }
}
