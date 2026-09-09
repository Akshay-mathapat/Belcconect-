import { NextResponse } from "next/server";
import { query } from "@/lib/db";

import { getAuthenticatedUser } from "@/lib/jwt";

// Helper to map DB row to Frontend Booking type
function mapRowToBooking(row: any) {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name || "Customer",
    customerPhone: row.customer_phone || "",
    customerPhoto: row.customer_photo || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    serviceName: row.service_name,
    category: row.category,
    date: row.date,
    time: row.time,
    address: row.destination_address || row.address || "No address provided",
    status: row.status,
    providerName: row.provider_name || "Verified Expert",
    providerId: row.provider_id || (process.env.DEMO_MODE === "true" ? "provider-1" : null),
    uploadedImages: [],
    rating: row.rating,
    reviewComment: row.review_comment || "",
    serviceAddressId: row.service_address_id || null,
    destinationLatitude: row.destination_latitude != null ? parseFloat(row.destination_latitude) : null,
    destinationLongitude: row.destination_longitude != null ? parseFloat(row.destination_longitude) : null,
    destinationPlaceId: row.destination_place_id || null,
    destinationAddress: row.destination_address || null,
    destinationLandmark: row.destination_landmark || null,
    destinationInstructions: row.destination_instructions || null,
    providerCurrentLatitude: row.provider_current_latitude != null ? parseFloat(row.provider_current_latitude) : null,
    providerCurrentLongitude: row.provider_current_longitude != null ? parseFloat(row.provider_current_longitude) : null,
    providerLocationUpdatedAt: row.provider_location_updated_at ? new Date(row.provider_location_updated_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

export async function GET(request: Request) {
  try {
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.userId;

    // Retrieve bookings strictly for this specific customer or provider
    const bookingsRes = await query(
      `SELECT 
        b.id, 
        b.customer_id, 
        b.provider_id, 
        b.provider_name,
        b.service_name, 
        b.category, 
        b.date, 
        b.time, 
        b.status, 
        b.rating,
        b.review_comment,
        b.created_at,
        b.service_address_id,
        b.destination_latitude,
        b.destination_longitude,
        b.destination_place_id,
        b.destination_address,
        b.destination_landmark,
        b.destination_instructions,
        b.provider_current_latitude,
        b.provider_current_longitude,
        b.provider_location_updated_at,
        COALESCE(c.name, 'Customer') AS customer_name,
        COALESCE(c.phone, '') AS customer_phone,
        COALESCE(c.avatar, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80') AS customer_photo,
        COALESCE(b.destination_address, addr.text, 'No address provided') AS address
      FROM bookings b
      LEFT JOIN customers c ON b.customer_id = c.id
      LEFT JOIN (
        SELECT DISTINCT ON (user_id) user_id, text 
        FROM addresses 
        ORDER BY user_id, created_at ASC
      ) addr ON b.customer_id = addr.user_id
      WHERE b.customer_id = $1 OR b.provider_id = $1
      ORDER BY b.created_at DESC NULLS LAST, b.id DESC`,
      [userId]
    );

    const bookings = bookingsRes.rows.map(mapRowToBooking);
    return NextResponse.json(bookings);
  } catch (error: any) {
    console.error("Error retrieving bookings:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate requester exclusively using centralized auth helper
    const authUser = getAuthenticatedUser(request);

    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const requesterId = authUser.userId;

    const body = await request.json();
    const {
      customerId,
      providerId,
      providerName,
      serviceName,
      category,
      date,
      time,
      address,
      serviceAddressId,
      destinationLatitude,
      destinationLongitude,
      destinationPlaceId,
      destinationAddress,
      destinationLandmark,
      destinationInstructions
    } = body;

    // Enforce that authenticated user ID is used as customer_id (cannot spoof customerId)
    const validCustomerId = requesterId;

    if (customerId && customerId !== requesterId && authUser?.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Cannot create a booking on behalf of another customer" },
        { status: 403 }
      );
    }

    if (!providerId || !serviceName || !date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Canonical provider validation: do not trust client-supplied or demo placeholder IDs.
    // A booking must always reference a real service_providers row, otherwise the provider
    // dashboard will never be able to find it by the same provider_id used at login.
    const requestedProviderId = typeof providerId === "string" ? providerId.trim() : "";
    const blockedProviderIds = new Set(["provider-1", "1", "demo-provider", "demo-pro"]);

    if (!requestedProviderId || blockedProviderIds.has(requestedProviderId)) {
      return NextResponse.json(
        { error: "Invalid service provider selection. Please choose a real provider from the marketplace." },
        { status: 400 }
      );
    }

    let validProviderId = requestedProviderId;
    try {
      const proCheck = await query("SELECT id FROM service_providers WHERE id = $1 LIMIT 1", [providerId]);
      if (proCheck.rows.length === 0) {
        return NextResponse.json({ error: "Invalid service provider account" }, { status: 400 });
      }
    } catch (e) {
      return NextResponse.json({ error: "Invalid service provider account" }, { status: 400 });
    }

    // Validate destination coordinates strictly if supplied (-90 <= lat <= 90, -180 <= lng <= 180)
    let validDestLat: number | null = null;
    let validDestLng: number | null = null;

    if (destinationLatitude !== undefined && destinationLatitude !== null && destinationLatitude !== "") {
      const nLat = Number(destinationLatitude);
      if (!Number.isFinite(nLat) || nLat < -90 || nLat > 90) {
        return NextResponse.json({ error: "Invalid destination latitude coordinate (-90 to 90)" }, { status: 400 });
      }
      validDestLat = nLat;
    }

    if (destinationLongitude !== undefined && destinationLongitude !== null && destinationLongitude !== "") {
      const nLng = Number(destinationLongitude);
      if (!Number.isFinite(nLng) || nLng < -180 || nLng > 180) {
        return NextResponse.json({ error: "Invalid destination longitude coordinate (-180 to 180)" }, { status: 400 });
      }
      validDestLng = nLng;
    }

    // Check if the requested time slot is already booked for this date & provider
    if (date && time) {
      const existingCheck = await query(
        `SELECT id FROM bookings 
         WHERE date = $1 
           AND (time = $2 OR time ILIKE $3)
           AND provider_id = $4
           AND (status IS NULL OR LOWER(status) NOT IN ('cancelled', 'rejected'))
         LIMIT 1`,
        [date, time, `%${time}%`, validProviderId]
      );

      if (existingCheck.rows.length > 0) {
        return NextResponse.json(
          { error: "This time slot has already been booked. Please select a different timing." },
          { status: 409 }
        );
      }
    }

    let finalCategory = category || "General";

    try {
      const serviceLookup = await query(
        "SELECT category FROM services WHERE name = $1 OR name ILIKE $2 LIMIT 1",
        [serviceName, serviceName]
      );
      if (serviceLookup.rows.length > 0) {
        finalCategory = serviceLookup.rows[0].category;
      } else {
        const lowerName = serviceName.toLowerCase();
        if (lowerName.includes("electric") || lowerName.includes("fan") || lowerName.includes("wiring") || lowerName.includes("switch")) {
          finalCategory = "electrical";
        } else if (lowerName.includes("plumb") || lowerName.includes("leak") || lowerName.includes("pipe") || lowerName.includes("tap") || lowerName.includes("water")) {
          finalCategory = "plumbing";
        } else if (lowerName.includes("clean") || lowerName.includes("dust") || lowerName.includes("sofa") || lowerName.includes("sweep") || lowerName.includes("maid")) {
          finalCategory = "cleaning";
        } else if (lowerName.includes("ac ") || lowerName.includes("air condition") || lowerName.includes("filter")) {
          finalCategory = "ac repair";
        } else {
          finalCategory = "general";
        }
      }
    } catch (e) {
      console.error("Error looking up service category:", e);
    }

    const bookingId = `B-${Math.floor(1000 + Math.random() * 9000)}`;

    const finalDestAddress = destinationAddress || address || "No address provided";

    await query(
      `INSERT INTO bookings (
        id, customer_id, provider_id, provider_name, service_name, category, 
        date, time, status, service_address_id, destination_latitude, destination_longitude,
        destination_place_id, destination_address, destination_landmark, destination_instructions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        bookingId,
        validCustomerId,
        validProviderId,
        providerName || "Ramesh Sharma",
        serviceName,
        finalCategory,
        date,
        time || "10:00 AM",
        "Requested",
        serviceAddressId || null,
        validDestLat,
        validDestLng,
        destinationPlaceId || null,
        finalDestAddress,
        destinationLandmark || null,
        destinationInstructions || null
      ]
    );

    // Auto-create a brand new clean conversation for this booking
    const convId = `conv-${bookingId}`;
    await query(
      `INSERT INTO conversations (id, customer_id, provider_id, booking_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [convId, validCustomerId, validProviderId, bookingId]
    ).catch((e) => console.warn("Failed to pre-create conversation for booking:", e));

    const insertedRes = await query(
      `SELECT 
        b.id, 
        b.customer_id, 
        b.provider_id, 
        b.provider_name,
        b.service_name, 
        b.category, 
        b.date, 
        b.time, 
        b.status, 
        b.rating,
        b.review_comment,
        b.created_at,
        b.service_address_id,
        b.destination_latitude,
        b.destination_longitude,
        b.destination_place_id,
        b.destination_address,
        b.destination_landmark,
        b.destination_instructions,
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.avatar AS customer_photo,
        COALESCE(b.destination_address, addr.text, 'No address provided') AS address
      FROM bookings b
      LEFT JOIN customers c ON b.customer_id = c.id
      LEFT JOIN (
        SELECT DISTINCT ON (user_id) user_id, text 
        FROM addresses 
        ORDER BY user_id, created_at ASC
      ) addr ON b.customer_id = addr.user_id
      WHERE b.id = $1`,
      [bookingId]
    );

    return NextResponse.json({ success: true, booking: mapRowToBooking(insertedRes.rows[0]) });
  } catch (error: any) {
    console.error("Error creating booking:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
