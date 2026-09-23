import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

// Helper to normalize and sanitize booking IDs
function normalizeBookingId(rawId: string): { raw: string; clean: string } {
  const raw = rawId ? String(rawId) : "";
  let clean = raw;
  try {
    clean = decodeURIComponent(raw);
  } catch {}
  clean = clean.trim().replace(/^#+/, "");
  return { raw, clean };
}

const ALLOWED_REPORT_REASONS = [
  "Safety concern",
  "Harassment",
  "Fraud/scam concern",
  "Incorrect service information",
  "No-show",
  "Inappropriate behavior",
  "Other"
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { raw: rawId, clean: cleanId } = normalizeBookingId(id);

  try {
    // 1. Authenticate user
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized: Missing authentication token" },
        { status: 401 }
      );
    }

    // 2. Fetch booking record
    const bookingRes = await query(
      `SELECT id, customer_id, provider_id, status FROM bookings
       WHERE (id = $1 OR LOWER(id) = LOWER($1) OR id = $2 OR LOWER(id) = LOWER($2))
       LIMIT 1`,
      [cleanId, rawId]
    );

    if (bookingRes.rows.length === 0) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const booking = bookingRes.rows[0];
    const canonicalBookingId = booking.id;

    // 3. Authorization: Caller must be a participant of the booking
    const isCustomer = authUser.userId === booking.customer_id;
    const isProvider = authUser.userId === booking.provider_id;

    if (!isCustomer && !isProvider) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to report on this booking" },
        { status: 403 }
      );
    }

    // 4. Derive reported user from booking (never trust arbitrary input from client)
    const reporterId = authUser.userId;
    const reportedUserId = isCustomer ? booking.provider_id : booking.customer_id;

    if (!reportedUserId) {
      return NextResponse.json(
        { error: "Incomplete booking record: missing counterpart participant" },
        { status: 400 }
      );
    }

    // 5. Input validation
    const body = await request.json();
    const { reason, description } = body;

    if (!reason || typeof reason !== "string" || !ALLOWED_REPORT_REASONS.includes(reason.trim())) {
      return NextResponse.json(
        { error: `Invalid report reason. Allowed reasons: ${ALLOWED_REPORT_REASONS.join(", ")}` },
        { status: 400 }
      );
    }

    if (description && typeof description === "string" && description.length > 5000) {
      return NextResponse.json(
        { error: "Description exceeds maximum length limit" },
        { status: 400 }
      );
    }

    const cleanDescription = typeof description === "string" ? description.trim().slice(0, 1500) : "";

    // 6. Insert into booking_reports
    // 6. Duplicate prevention: Check if reporter already has an open report with same reason
    const existingReport = await query(
      `SELECT id FROM booking_reports
       WHERE booking_id = $1 AND reporter_id = $2 AND reason = $3 AND status = 'open'
       LIMIT 1`,
      [canonicalBookingId, reporterId, reason.trim()]
    );

    if (existingReport.rows.length > 0) {
      return NextResponse.json(
        { error: "You have already submitted an open report for this booking. Our safety team is reviewing it." },
        { status: 409 }
      );
    }

    // 7. Insert into booking_reports
    const reportId = `rep-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    await query(
      `INSERT INTO booking_reports (
        id, booking_id, reporter_id, reported_user_id, reason, description, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'open')`,
      [
        reportId,
        canonicalBookingId,
        reporterId,
        reportedUserId,
        reason.trim(),
        cleanDescription || null
      ]
    );

    return NextResponse.json({
      success: true,
      message: "Report submitted safely. Our trust & safety team will review this interaction."
    });
  } catch (error: any) {
    console.error(`Error reporting booking ${cleanId}:`, error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
