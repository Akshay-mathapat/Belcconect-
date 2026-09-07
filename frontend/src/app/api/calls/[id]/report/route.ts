import { NextResponse } from "next/server";
import { createCallReport, getCallById } from "@/lib/calls";
import { getAuthenticatedUser } from "@/lib/jwt";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: callId } = await params;
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const reporterId = authUser.userId;
    const { reason } = body;

    if (!reason) {
      return NextResponse.json({ error: "reason is required" }, { status: 400 });
    }

    const call = await getCallById(callId);
    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    await createCallReport(callId, reporterId, reason.trim());

    return NextResponse.json({
      success: true,
      message: "Call reported successfully for safety investigation"
    });
  } catch (error: any) {
    console.error("Error reporting call:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
