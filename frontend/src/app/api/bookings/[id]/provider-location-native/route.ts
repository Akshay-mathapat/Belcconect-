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
      console.log(`[BOOKING_LOOKUP] route=/api/bookings/[id]/provider-location-native method=POST rawId=${rawId} cleanId=${cleanId} authenticated=false`);
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authentication token" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { latitude, longitude, accuracy, speed, heading, timestamp } = body;

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
      `SELECT id, status, provider_id 
       FROM bookings 
       WHERE (id = $1 OR LOWER(id) = LOWER($1) OR id = $2 OR LOWER(id) = LOWER($2)) 
       LIMIT 1`,
      [cleanId, rawId]
    );

    if (bookingRes.rows.length === 0) {
      console.log(`[BOOKING_LOOKUP] route=/api/bookings/[id]/provider-location-native method=POST rawId=${rawId} cleanId=${cleanId} userId=${authUser.userId} role=${authUser.role} found=false`);
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const booking = bookingRes.rows[0];
    const canonicalId = booking.id;

    // 2. Authorize provider: authenticated user ID must match assigned provider_id strictly
    const isAssignedProvider = authUser.userId === booking.provider_id;
    console.log(`[BOOKING_LOOKUP] route=/api/bookings/[id]/provider-location-native method=POST bookingId=${canonicalId} userId=${authUser.userId} role=${authUser.role} found=true authorized=${isAssignedProvider}`);

    if (!isAssignedProvider) {
      return NextResponse.json(
        { error: "Forbidden: Only the assigned service provider can update provider location for this booking" },
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

    // Fast asynchronous update of provider location using canonical ID
    await query(
      `UPDATE bookings 
       SET provider_current_latitude = $1,
           provider_current_longitude = $2,
           provider_location_updated_at = NOW(),
           provider_location_accuracy = $3
       WHERE id = $4`,
      [lat, lng, accValue, canonicalId]
    );

    // Broadcast to Socket.IO signaling server
    const serverTimestamp = Date.now();
    const clientTs = Number(timestamp);
    const safeClientTs = Number.isFinite(clientTs) && clientTs > 0 ? clientTs : null;

    const payload = {
      bookingId: canonicalId,
      latitude: lat,
      longitude: lng,
      accuracy: accValue,
      heading: typeof heading === "number" && !isNaN(heading) ? heading : null,
      speed: typeof speed === "number" && !isNaN(speed) ? speed : null,
      timestamp: serverTimestamp,
      clientTimestamp: safeClientTs,
      source: "android-native"
    };

    let signalingUrl = process.env.SIGNALING_SERVER_URL || process.env.NEXT_PUBLIC_SIGNALING_URL || "https://belcconect-backend.onrender.com";
    if (process.env.NODE_ENV === "production" && (signalingUrl.includes("localhost") || signalingUrl.includes("127.0.0.1"))) {
      signalingUrl = "https://belcconect-backend.onrender.com";
    }
    const internalSecret = process.env.SIGNALING_INTERNAL_SECRET || process.env.INTERNAL_API_SECRET || "cityconnect_signaling_secret_key_2026";

    if (internalSecret) {
        fetch(`${signalingUrl}/api/location/broadcast`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                secret: internalSecret,
                bookingId: canonicalId,
                event: "provider:location:update",
                payload
            })
        })
        .then(() => {
          console.log(`[Native Location] Broadcasted lat=${lat} lng=${lng} to signaling server for booking ${canonicalId}`);
        })
        .catch(err => console.error("[Native Location] Failed to broadcast to signaling server", err));
    }

    return NextResponse.json({
      success: true,
      bookingId: canonicalId,
      latitude,
      longitude,
      accuracy: accValue,
      updatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error(`[Provider Native Location API] Error updating provider location for ${id}:`, error);
    return NextResponse.json(
      { error: error.message || "Failed to update provider location" },
      { status: 500 }
    );
  }
}
