import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";
import { generateLiveKitToken } from "@/lib/livekitToken";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authentication session" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { bookingId } = body;

    if (!bookingId) {
      return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
    }

    // Lookup booking from PostgreSQL database
    const bookingRes = await query(
      `SELECT id, customer_id, provider_id, status FROM bookings WHERE id = $1`,
      [bookingId]
    ).catch((e) => {
      console.warn("[LiveKit Token API] Database booking lookup error:", e);
      return { rows: [] };
    });

    let booking: any = bookingRes.rows.length > 0 ? bookingRes.rows[0] : null;

    if (!booking) {
      if (process.env.DEMO_MODE === "true" && (bookingId === "B-1001" || bookingId.startsWith("B-"))) {
        const isProvider = authUser.role === "provider";
        booking = {
          id: bookingId,
          customer_id: isProvider ? "customer-1" : authUser.userId,
          provider_id: isProvider ? authUser.userId : "provider-1",
          status: "Accepted"
        };
      } else {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }
    }

    // Authorization Check: Must be customer or provider of this booking
    const isCustomer = authUser.userId === booking.customer_id;
    const isProvider = authUser.userId === booking.provider_id;

    if (!isCustomer && !isProvider) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to join call for this booking" },
        { status: 403 }
      );
    }

    const session = await generateLiveKitToken(bookingId, authUser.userId);

    return NextResponse.json({
      success: true,
      serverUrl: session.serverUrl,
      participantToken: session.participantToken,
      roomName: session.roomName
    });
  } catch (error: any) {
    console.error("[LiveKit Token API] Error generating token:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
