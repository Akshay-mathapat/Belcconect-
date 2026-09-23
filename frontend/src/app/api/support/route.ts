import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

export async function POST(request: Request) {
  try {
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized: Missing authentication token" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { subject, message, bookingId } = body;

    if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
      return NextResponse.json(
        { error: "Subject is required" },
        { status: 400 }
      );
    }

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    let verifiedBookingId: string | null = null;
    if (bookingId && typeof bookingId === "string" && bookingId.trim().length > 0) {
      const cleanBookingId = bookingId.trim().replace(/^#+/, "");
      const bRes = await query(
        `SELECT id, customer_id, provider_id FROM bookings WHERE id = $1 LIMIT 1`,
        [cleanBookingId]
      );

      if (bRes.rows.length === 0) {
        return NextResponse.json(
          { error: "Specified booking was not found" },
          { status: 404 }
        );
      }

      const booking = bRes.rows[0];
      const isParticipant =
        authUser.userId === booking.customer_id ||
        authUser.userId === booking.provider_id ||
        authUser.role === "admin";
        authUser.userId === booking.provider_id;

      if (!isParticipant) {
        return NextResponse.json(
          { error: "Forbidden: You cannot attach a booking that does not belong to your account" },
          { status: 403 }
        );
      }

      verifiedBookingId = booking.id;
    }

    const ticketId = `supp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const cleanSubject = subject.trim().slice(0, 255);
    const cleanMessage = message.trim().slice(0, 3000);

    await query(
      `INSERT INTO support_requests (id, user_id, user_role, booking_id, subject, message, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'open')`,
      [
        ticketId,
        authUser.userId,
        authUser.role,
        authUser.role || "user",
        verifiedBookingId,
        cleanSubject,
        cleanMessage
      ]
    );

    return NextResponse.json({
      success: true,
      ticketId,
      message: "Support request created. Our support team will review your inquiry."
    });
  } catch (error: any) {
    console.error("Error submitting support request:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
