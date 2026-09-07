import { NextResponse } from "next/server";
import { getActiveCallForUser } from "@/lib/calls";
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
