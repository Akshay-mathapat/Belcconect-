import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

// DEPRECATED: Legacy generic endpoint. Applications should use /api/bookings/:id/provider-location or /api/bookings/:id/customer-location.
const ACTIVE_TRACKING_STATUSES = ["OnTheWay", "Started"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // 1. Authenticate user from session token
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authentication token" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { latitude, longitude } = body;

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

    // Retrieve booking to validate existence & status
    const bookingRes = await query(
      "SELECT id, status, customer_id, provider_id FROM bookings WHERE id = $1 LIMIT 1",
      [id]
    );

    if (bookingRes.rows.length === 0) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const booking = bookingRes.rows[0];

    // 2. Authorize: authenticated user ID must match assigned provider_id or customer_id strictly
    const isAssignedProvider = authUser.userId === booking.provider_id;
    const isAssignedCustomer = authUser.userId === booking.customer_id;

    if (!isAssignedProvider && !isAssignedCustomer) {
      return NextResponse.json(
        { error: "Forbidden: You are not an authorized participant in this booking" },
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

    const accValue = typeof body.accuracy === "number" && !isNaN(body.accuracy) ? body.accuracy : null;

    if (isAssignedProvider) {
      // Fast asynchronous update of provider location
      await query(
        `UPDATE bookings 
         SET provider_current_latitude = $1,
             provider_current_longitude = $2,
             provider_location_updated_at = NOW(),
             provider_location_accuracy = $3
         WHERE id = $4`,
        [lat, lng, accValue, id]
      );
    } else {
      // Fast asynchronous update of customer live location
      await query(
        `UPDATE bookings 
         SET customer_current_latitude = $1,
             customer_current_longitude = $2,
             customer_location_updated_at = NOW(),
             customer_location_accuracy = $3
         WHERE id = $4`,
        [lat, lng, accValue, id]
      );
    }

    return NextResponse.json({
      success: true,
      bookingId: id,
      latitude,
      longitude,
      role: isAssignedProvider ? "provider" : "customer",
      updatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error(`[Location API] Error updating provider location for ${id}:`, error);
    return NextResponse.json(
      { error: error.message || "Failed to update location" },
      { status: 500 }
    );
  }
}
