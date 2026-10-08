import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

// Helper to map DB row to frontend address object
function mapRowToAddress(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type || "Home",
    text: row.text || "",
    latitude: row.latitude ? parseFloat(row.latitude) : null,
    longitude: row.longitude ? parseFloat(row.longitude) : null,
    placeId: row.place_id || null,
    locationAccuracy: row.location_accuracy
      ? parseFloat(row.location_accuracy)
      : null,
    houseNumber: row.house_number || null,
    buildingName: row.building_name || null,
    floor: row.floor || null,
    landmark: row.landmark || null,
    locality: row.locality || null,
    city: row.city || null,
    state: row.state || null,
    pincode: row.pincode || null,
    deliveryInstructions: row.delivery_instructions || null,
    createdAt: row.created_at
      ? new Date(row.created_at).toISOString()
      : new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    const authUser = getAuthenticatedUser(request);

    if (!authUser || !authUser.userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = authUser.userId;

    const res = await query(
      "SELECT * FROM addresses WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );

    const addresses = res.rows.map(mapRowToAddress);

    return NextResponse.json(addresses);
  } catch (error: any) {
    console.error("Error retrieving addresses:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authUser = getAuthenticatedUser(request);

    if (!authUser || !authUser.userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const {
      type,
      text,
      latitude,
      longitude,
      placeId,
      locationAccuracy,
      houseNumber,
      buildingName,
      floor,
      landmark,
      locality,
      city,
      state,
      pincode,
      deliveryInstructions,
    } = body;

    // Identity must always come from verified auth
    const userId = authUser.userId;

    if (!type) {
      return NextResponse.json(
        { error: "Address type is required" },
        { status: 400 }
      );
    }

    // Validate coordinates
    let validLatitude: number | null = null;
    let validLongitude: number | null = null;

    if (
      latitude !== undefined &&
      latitude !== null &&
      latitude !== ""
    ) {
      const latNum = Number(latitude);

      if (
        !Number.isFinite(latNum) ||
        latNum < -90 ||
        latNum > 90
      ) {
        return NextResponse.json(
          { error: "Invalid latitude value" },
          { status: 400 }
        );
      }

      validLatitude = latNum;
    }

    if (
      longitude !== undefined &&
      longitude !== null &&
      longitude !== ""
    ) {
      const lngNum = Number(longitude);

      if (
        !Number.isFinite(lngNum) ||
        lngNum < -180 ||
        lngNum > 180
      ) {
        return NextResponse.json(
          { error: "Invalid longitude value" },
          { status: 400 }
        );
      }

      validLongitude = lngNum;
    }

    // Construct readable address text if missing
    let fullText =
      typeof text === "string" ? text.trim() : "";

    if (!fullText) {
      const parts = [
        houseNumber ? `Flat ${houseNumber}` : null,
        buildingName || null,
        floor ? `Floor ${floor}` : null,
        locality || null,
        landmark ? `Near ${landmark}` : null,
        city || null,
        state || null,
        pincode || null,
      ].filter(Boolean);

      fullText = parts.join(", ") || "Pinned Location";
    }

    // Concurrency-safe primary key
    const addrId = `addr-${randomUUID()}`;

    const insertRes = await query(
      `INSERT INTO addresses (
        id,
        user_id,
        type,
        text,
        latitude,
        longitude,
        place_id,
        location_accuracy,
        house_number,
        building_name,
        floor,
        landmark,
        locality,
        city,
        state,
        pincode,
        delivery_instructions
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16, $17
      )
      RETURNING *`,
      [
        addrId,
        userId,
        type,
        fullText,
        validLatitude,
        validLongitude,
        placeId || null,
        locationAccuracy ?? null,
        houseNumber || null,
        buildingName || null,
        floor || null,
        landmark || null,
        locality || null,
        city || null,
        state || null,
        pincode || null,
        deliveryInstructions || null,
      ]
    );

    return NextResponse.json({
      success: true,
      address: mapRowToAddress(insertRes.rows[0]),
    });
  } catch (error: any) {
    console.error("Error creating address:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}