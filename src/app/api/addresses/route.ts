import { NextResponse } from "next/server";
import { query } from "@/lib/db";

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
    locationAccuracy: row.location_accuracy ? parseFloat(row.location_accuracy) : null,
    houseNumber: row.house_number || null,
    buildingName: row.building_name || null,
    floor: row.floor || null,
    landmark: row.landmark || null,
    locality: row.locality || null,
    city: row.city || null,
    state: row.state || null,
    pincode: row.pincode || null,
    deliveryInstructions: row.delivery_instructions || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

export async function GET(request: Request) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = await query(
      "SELECT * FROM addresses WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );

    const addresses = res.rows.map(mapRowToAddress);
    return NextResponse.json(addresses);
  } catch (error: any) {
    console.error("Error retrieving addresses:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      userId,
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
      deliveryInstructions
    } = body;

    if (!userId || !type) {
      return NextResponse.json({ error: "userId and type are required" }, { status: 400 });
    }

    // Validate coordinates range if present
    if (latitude !== undefined && latitude !== null) {
      const latNum = Number(latitude);
      if (isNaN(latNum) || latNum < -90 || latNum > 90) {
        return NextResponse.json({ error: "Invalid latitude value" }, { status: 400 });
      }
    }
    if (longitude !== undefined && longitude !== null) {
      const lngNum = Number(longitude);
      if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
        return NextResponse.json({ error: "Invalid longitude value" }, { status: 400 });
      }
    }

    // Construct text representation if text is empty
    let fullText = text?.trim() || "";
    if (!fullText) {
      const parts = [
        houseNumber ? `Flat ${houseNumber}` : null,
        buildingName,
        floor ? `Floor ${floor}` : null,
        locality,
        landmark ? `Near ${landmark}` : null,
        city,
        state,
        pincode
      ].filter(Boolean);
      fullText = parts.join(", ") || "Pinned Location";
    }

    const addrId = `addr-${Date.now()}`;

    await query(
      `INSERT INTO addresses (
        id, user_id, type, text, latitude, longitude, place_id, location_accuracy,
        house_number, building_name, floor, landmark, locality, city, state, pincode, delivery_instructions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        addrId,
        userId,
        type,
        fullText,
        latitude ?? null,
        longitude ?? null,
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
        deliveryInstructions || null
      ]
    );

    const insertedRes = await query("SELECT * FROM addresses WHERE id = $1", [addrId]);
    return NextResponse.json({ success: true, address: mapRowToAddress(insertedRes.rows[0]) });
  } catch (error: any) {
    console.error("Error creating address:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
