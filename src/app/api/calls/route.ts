import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  createCallRecord,
  getActiveCallForBooking,
  getCallHistoryForUser,
  getUserRateLimitCount,
  autoExpireStaleCalls
} from "@/lib/calls";
import { callSignaling } from "@/lib/callSignaling";
import { getAuthenticatedUser } from "@/lib/jwt";

export async function POST(request: Request) {
  try {
    // Auto-expire stale ringing or hanging calls older than 60s
    const expired = await autoExpireStaleCalls(60);
    expired.forEach((call) => {
      callSignaling.emitCallEvent({ type: "call:missed", call, timestamp: Date.now() });
    });

    // 1. Authenticate user from JWT Session Token or x-user-id fallback
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized: Invalid or missing authentication session" }, { status: 401 });
    }

    const authenticatedUserId = authUser.userId;
    const body = await request.json();
    const { bookingId } = body;

    if (!bookingId) {
      return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
    }

    // 2. Rate Limiting Check (Configured to 20 calls per hour in production, 1000 in dev)
    const maxCallsPerHour = process.env.NODE_ENV === "production" ? 20 : 1000;
    const recentCallCount = await getUserRateLimitCount(authenticatedUserId, 1);
    if (recentCallCount >= maxCallsPerHour) {
      return NextResponse.json(
        { error: `Call rate limit exceeded. Maximum ${maxCallsPerHour} call attempts per hour.` },
        { status: 429 }
      );
    }

    // 3. Look up booking from PostgreSQL with fallback for client/demo bookings
    let booking = null;
    try {
      const bookingRes = await query(
        `SELECT id, customer_id, provider_id, status, service_name
         FROM bookings 
         WHERE id = $1`,
        [bookingId]
      );
      if (bookingRes.rows.length > 0) {
        booking = bookingRes.rows[0];
      }
    } catch (e) {
      console.warn("Database lookup failed, fallback to in-memory call context:", e);
    }

    if (!booking) {
      const isCallerProvider =
        authenticatedUserId === "provider-1" ||
        authenticatedUserId.includes("provider") ||
        authenticatedUserId.includes("prov") ||
        authUser.role === "provider";

      booking = {
        id: bookingId,
        customer_id: isCallerProvider ? "customer-1" : authenticatedUserId,
        provider_id: isCallerProvider ? authenticatedUserId : "provider-1",
        status: "Accepted",
        service_name: "Service Booking"
      };
    }

    // 4. Determine caller and receiver (Supports Customer -> Provider & Provider -> Customer)
    const effectiveCustomerId = booking.customer_id || "customer-1";
    const effectiveProviderId = booking.provider_id || "provider-1";

    const isProviderCaller =
      authenticatedUserId === effectiveProviderId ||
      authUser.role === "provider" ||
      authenticatedUserId.includes("provider") ||
      authenticatedUserId.includes("prov");

    const actualCallerId = isProviderCaller ? effectiveProviderId : (authenticatedUserId || effectiveCustomerId);
    const receiverId = isProviderCaller ? effectiveCustomerId : effectiveProviderId;

    // 5. Verify Booking Status
    const activeStatuses = [
      "Requested",
      "Accepted",
      "OnTheWay",
      "Started",
      "Completed",
      "Upcoming",
      "ReviewSubmitted"
    ];

    if (booking.status && !activeStatuses.includes(booking.status)) {
      return NextResponse.json(
        { error: `Calling unavailable: Booking status is '${booking.status}'` },
        { status: 400 }
      );
    }

    // 6. Check if there is already an active call session for this booking
    const existingCall = await getActiveCallForBooking(bookingId);
    if (existingCall) {
      return NextResponse.json({
        success: true,
        call: existingCall,
        message: "Existing active call session retrieved"
      });
    }

    // 7. Create Call Record & Emit Signaling
    const callRecord = await createCallRecord(actualCallerId, receiverId, bookingId);

    callSignaling.emitCallEvent({
      type: "call:initiate",
      call: callRecord,
      timestamp: Date.now()
    });

    callSignaling.emitCallEvent({
      type: "call:ring",
      call: callRecord,
      timestamp: Date.now()
    });

    return NextResponse.json({
      success: true,
      call: callRecord
    });
  } catch (error: any) {
    console.error("Error initiating call:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized: Invalid or missing authentication session" }, { status: 401 });
    }

    const history = await getCallHistoryForUser(authUser.userId);
    return NextResponse.json({ success: true, calls: history });
  } catch (error: any) {
    console.error("Error fetching call history:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
