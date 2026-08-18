import { NextResponse } from "next/server";
import { createCallReport, getCallById } from "@/lib/calls";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: callId } = await params;
    const body = await request.json();
    const headerUserId = request.headers.get("x-user-id");
    const reporterId = body.reporterId || headerUserId;
    const { reason } = body;

    if (!reporterId || !reason) {
      return NextResponse.json({ error: "reporterId and reason are required" }, { status: 400 });
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
