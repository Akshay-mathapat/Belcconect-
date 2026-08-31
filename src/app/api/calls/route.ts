import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  createCallRecord,
  getActiveCallForBooking,
  getCallHistoryForUser,
  getUserRateLimitCount,
  autoExpireStaleCalls,
  checkUserBusy,
  updateCallStatus
} from "@/lib/calls";
import { sendCallSignal } from "@/lib/socketSignaling";
import { callSignaling } from "@/lib/callSignaling";
import { getAuthenticatedUser } from "@/lib/jwt";
import { sendPushToUser } from "@/lib/pushNotifications";

export async function POST(request: Request) {
  try {
    // 1. Fire-and-forget background cleanup of stale calls (non-blocking)
    (async () => {
      try {
        const expired = await autoExpireStaleCalls(45);
        for (const call of expired) {
          sendCallSignal({ type: "call:missed", call }).catch((err) =>
            console.error("[Call API] Missed call signal failed:", err)
          );
          callSignaling.emitCallEvent({ type: "call:missed", call, timestamp: Date.now() });
        }
      } catch (e) {
        console.error("[Call API] Error in background autoExpireStaleCalls:", e);
      }
    })();

    // 2. Authenticate user from JWT session token
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Please log in to start a voice call" },
        { status: 401 }
      );
    }

    const authenticatedUserId = authUser.userId;
    const body = await request.json();
    const { bookingId } = body;

    if (!bookingId) {
      return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
    }

    const maxCallsPerHour = process.env.NODE_ENV === "production" ? 20 : 1000;

    // 3. Parallel Execution: Rate limit count & Booking lookup DB queries
    const [recentCallCount, bookingRes] = await Promise.all([
      getUserRateLimitCount(authenticatedUserId, 1),
      query(
        `SELECT id, customer_id, provider_id, status, service_name
         FROM bookings 
         WHERE id = $1`,
        [bookingId]
      ).catch((e) => {
        console.warn("Database booking lookup error:", e);
        return { rows: [] };
      })
    ]);

    if (recentCallCount >= maxCallsPerHour) {
      return NextResponse.json(
        { error: `Call rate limit exceeded. Maximum ${maxCallsPerHour} call attempts per hour.` },
        { status: 429 }
      );
    }

    let booking: any = bookingRes.rows.length > 0 ? bookingRes.rows[0] : null;

    if (!booking) {
      if (process.env.DEMO_MODE === "true" && (bookingId === "B-1001" || bookingId.startsWith("B-"))) {
        const isProvider = authUser.role === "provider";
        booking = {
          id: bookingId,
          customer_id: isProvider ? "customer-1" : authenticatedUserId,
          provider_id: isProvider ? authenticatedUserId : "provider-1",
          status: "Accepted",
          service_name: "Service Booking"
        };
      } else {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }
    }

    // 4. Authorization Check: Strict exact match with booking customer or provider ID
    const isCustomer = authenticatedUserId === booking.customer_id;
    const isProvider = authenticatedUserId === booking.provider_id;

    if (!isCustomer && !isProvider) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to make a call for this booking" },
        { status: 403 }
      );
    }

    const actualCallerId = authenticatedUserId;
    
    // Determine target receiver ID (the opposite participant in the booking)
    const receiverId = isCustomer ? booking.provider_id : booking.customer_id;

    if (!receiverId || receiverId === actualCallerId) {
      return NextResponse.json({ error: "Receiver not found for this booking" }, { status: 400 });
    }

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

    // 6. Parallel Execution: Receiver Busy Check & Existing Call Session Lookup
    const [isReceiverBusy, existingCall] = await Promise.all([
      checkUserBusy(receiverId),
      getActiveCallForBooking(bookingId)
    ]);

    if (isReceiverBusy) {
      const busyCallRecord = await createCallRecord(actualCallerId, receiverId, bookingId);
      const updatedBusyCall = await updateCallStatus(busyCallRecord.id, "BUSY");
      if (updatedBusyCall) {
        sendCallSignal({ type: "call:busy", targetUserId: actualCallerId, call: updatedBusyCall }).catch((err) =>
          console.error("[Call API] Busy signal dispatch error:", err)
        );
      }
      return NextResponse.json(
        { error: "User is currently on another call.", status: "BUSY" },
        { status: 409 }
      );
    }

    if (existingCall) {
      return NextResponse.json({
        success: true,
        call: existingCall,
        message: "Existing active call session retrieved"
      });
    }

    // 7. Create Call Record & Transition to RINGING in Postgres
    const callRecord = await createCallRecord(actualCallerId, receiverId, bookingId);
    const ringingCallRecord = (await updateCallStatus(callRecord.id, "RINGING")) || callRecord;

    // 8. Fire-and-forget Socket.IO signaling broadcast (non-blocking)
    sendCallSignal({
      type: "call:ring",
      targetUserId: receiverId,
      call: ringingCallRecord
    }).catch((err) => {
      console.error("[Call API] Ring signal dispatch error:", err);
    });

    callSignaling.emitCallEvent({
      type: "call:ring",
      call: ringingCallRecord,
      timestamp: Date.now()
    });

    // 8b. Trigger Web Push Notification to receiver (non-blocking)
    const callerName = isProvider ? (booking.provider_name || "Service Partner") : "Customer";
    sendPushToUser(receiverId, {
      title: "Incoming Voice Call 📞",
      body: `Incoming call from ${callerName} for ${booking.service_name || "BelConnect Service"}`,
      data: {
        type: "call:incoming",
        callId: ringingCallRecord.id,
        bookingId,
        url: `/?activeCall=true&callId=${ringingCallRecord.id}`
      }
    }).catch((err: any) => console.error("[Call API] Web Push dispatch error:", err));

    // 9. Immediate response to caller client (<50ms)
    return NextResponse.json({
      success: true,
      call: ringingCallRecord
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
