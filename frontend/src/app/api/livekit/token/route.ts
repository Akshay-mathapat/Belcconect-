import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";
import { generateLiveKitToken } from "@/lib/livekitToken";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const authUser = getAuthenticatedUser(request);
    if (!authUser || !authUser.userId) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authentication session" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { bookingId } = body;

    const cleanBookingId = typeof bookingId === "string" ? bookingId.trim() : "";
    if (!cleanBookingId) {
      return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
    }

    // Lookup booking from PostgreSQL database
    const bookingRes = await query(
      `SELECT id, customer_id, provider_id, status FROM bookings WHERE id = $1 LIMIT 1`,
      [cleanBookingId]
    );

    if (bookingRes.rows.length === 0) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const booking = bookingRes.rows[0];

    // Authorization Check: Must be customer or provider of this booking
    const isCustomer = authUser.userId === booking.customer_id;
    const isProvider = authUser.userId === booking.provider_id;

    if (!isCustomer && !isProvider) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to join call for this booking" },
        { status: 403 }
      );
    }

    const session = await generateLiveKitToken(cleanBookingId, authUser.userId);

    return NextResponse.json({
      success: true,
      serverUrl: session.serverUrl,
      participantToken: session.participantToken,
      roomName: session.roomName
    });
  } catch (error: any) {
    console.error("[LiveKit Token API] Error generating token:", error);
    return NextResponse.json({ error: "Failed to generate call token" }, { status: 500 });
  }
}
