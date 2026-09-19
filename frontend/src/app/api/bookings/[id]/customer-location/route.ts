import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

const ACTIVE_TRACKING_STATUSES = ["OnTheWay", "Started"];

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { raw: rawId, clean: cleanId } = normalizeBookingId(id);

  try {
    // 1. Authenticate user from session token
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      console.log(`[BOOKING_LOOKUP] route=/api/bookings/[id]/customer-location method=POST rawId=${rawId} cleanId=${cleanId} authenticated=false`);
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authentication token" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { latitude, longitude, accuracy } = body;

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return NextResponse.json(
        { error: "Invalid latitude or longitude coordinate values" },
        { status: 400 }
      );
    }

    // Retrieve booking to validate existence & status with case-insensitive / normalized lookup
    const bookingRes = await query(
      `SELECT id, status, customer_id 
       FROM bookings 
       WHERE (id = $1 OR LOWER(id) = LOWER($1) OR id = $2 OR LOWER(id) = LOWER($2)) 
       LIMIT 1`,
      [cleanId, rawId]
    );

    if (bookingRes.rows.length === 0) {
      console.log(`[BOOKING_LOOKUP] route=/api/bookings/[id]/customer-location method=POST rawId=${rawId} cleanId=${cleanId} userId=${authUser.userId} role=${authUser.role} found=false`);
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const booking = bookingRes.rows[0];
    const canonicalId = booking.id;

    // 2. Authorize customer: authenticated user ID must match assigned customer_id strictly
    const isAssignedCustomer = authUser.userId === booking.customer_id;
    console.log(`[BOOKING_LOOKUP] route=/api/bookings/[id]/customer-location method=POST bookingId=${canonicalId} userId=${authUser.userId} role=${authUser.role} found=true authorized=${isAssignedCustomer}`);

    if (!isAssignedCustomer) {
      return NextResponse.json(
        { error: "Forbidden: Only the assigned customer can update customer location for this booking" },
        { status: 403 }
      );
    }

    // Validate that booking is in active tracking window
    if (!ACTIVE_TRACKING_STATUSES.includes(booking.status)) {
      return NextResponse.json(
        {
          error: `Location updates rejected: booking status '${booking.status}' is not in active tracking window`,
          status: booking.status
        },
        { status: 400 }
      );
    }

    const accValue = typeof accuracy === "number" && !isNaN(accuracy) ? accuracy : null;

    // Fast asynchronous update of customer live location using canonical ID
    await query(
      `UPDATE bookings 
       SET customer_current_latitude = $1,
           customer_current_longitude = $2,
           customer_location_updated_at = NOW(),
           customer_location_accuracy = $3
       WHERE id = $4`,
      [lat, lng, accValue, canonicalId]
    );

    return NextResponse.json({
      success: true,
      bookingId: canonicalId,
      latitude: lat,
      longitude: lng,
      accuracy: accValue,
      updatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error(`[Customer Location API] Error updating customer location for ${id}:`, error);
    return NextResponse.json(
      { error: error.message || "Failed to update customer location" },
      { status: 500 }
    );
  }
}
