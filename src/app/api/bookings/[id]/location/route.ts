import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const ACTIVE_TRACKING_STATUSES = ["Accepted", "OnTheWay", "Started"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { latitude, longitude } = body;

    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      isNaN(latitude) ||
      isNaN(longitude)
    ) {
      return NextResponse.json(
        { error: "Invalid latitude or longitude" },
        { status: 400 }
      );
    }

    // Retrieve booking to validate existence & status
    const bookingRes = await query(
      "SELECT id, status, provider_id FROM bookings WHERE id = $1 LIMIT 1",
      [id]
    );

    if (bookingRes.rows.length === 0) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const booking = bookingRes.rows[0];

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

    // Optional provider authentication check
    const userIdHeader = request.headers.get("x-user-id");
    if (userIdHeader && booking.provider_id) {
      const lowerUser = userIdHeader.toLowerCase();
      const lowerProv = booking.provider_id.toLowerCase();
      // Allow provider match or fallback demo provider
      if (lowerUser !== lowerProv && !lowerUser.startsWith("prov")) {
        return NextResponse.json({ error: "Unauthorized provider" }, { status: 403 });
      }
    }

    // Fast asynchronous update of provider location
    await query(
      `UPDATE bookings 
       SET provider_current_latitude = $1,
           provider_current_longitude = $2,
           provider_location_updated_at = NOW()
       WHERE id = $3`,
      [latitude, longitude, id]
    );

    return NextResponse.json({
      success: true,
      bookingId: id,
      latitude,
      longitude,
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
