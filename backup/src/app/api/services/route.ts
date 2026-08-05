import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get("providerId");
    const category = searchParams.get("category");
    const searchQuery = searchParams.get("query");

    let sql = `
      SELECT s.*, u.name as provider_name, u.avatar as provider_avatar, u.phone as provider_phone 
      FROM services s 
      JOIN service_providers u ON s.provider_id = u.id
      WHERE s.is_available = TRUE
    `;
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (providerId) {
      sql += ` AND s.provider_id = $${paramIndex++}`;
      queryParams.push(providerId);
    }

    if (category) {
      sql += ` AND LOWER(s.category) = LOWER($${paramIndex++})`;
      queryParams.push(category);
    }

    if (searchQuery) {
      const formattedSearch = `%${searchQuery}%`;
      sql += ` AND (LOWER(s.name) LIKE LOWER($${paramIndex}) OR LOWER(u.name) LIKE LOWER($${paramIndex}) OR LOWER(s.description) LIKE LOWER($${paramIndex}))`;
      queryParams.push(formattedSearch);
      paramIndex++;
    }

    sql += " ORDER BY s.created_at DESC";

    const res = await query(sql, queryParams);
    
    // Map DB rows to Frontend ServiceItem type
    const services = res.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      subcategory: row.subcategory || "",
      description: row.description || "",
      basePrice: Number(row.base_price),
      isAvailable: row.is_available,
      providerId: row.provider_id,
      providerName: row.provider_name,
      providerAvatar: row.provider_avatar,
      providerPhone: row.provider_phone,
      bookingsCount: 0,
      rating: 5.0
    }));

    return NextResponse.json(services);
  } catch (error: any) {
    console.error("Error fetching services:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { providerId, name, category, subcategory, description, basePrice } = body;

    if (!providerId || !name || !category || basePrice === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const serviceId = `SRV-${Date.now()}`;
    await query(
      `INSERT INTO services (id, provider_id, name, category, subcategory, description, base_price, is_available) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [serviceId, providerId, name, category, subcategory || null, description || null, basePrice, true]
    );

    // Fetch the newly created service with joined provider details
    const res = await query(
      `SELECT s.*, u.name as provider_name, u.avatar as provider_avatar, u.phone as provider_phone 
       FROM services s 
       JOIN service_providers u ON s.provider_id = u.id
       WHERE s.id = $1`,
      [serviceId]
    );

    const row = res.rows[0];
    const createdService = {
      id: row.id,
      name: row.name,
      category: row.category,
      subcategory: row.subcategory || "",
      description: row.description || "",
      basePrice: Number(row.base_price),
      isAvailable: row.is_available,
      providerId: row.provider_id,
      providerName: row.provider_name,
      providerAvatar: row.provider_avatar,
      providerPhone: row.provider_phone,
      bookingsCount: 0,
      rating: 5.0
    };

    return NextResponse.json({ success: true, service: createdService });
  } catch (error: any) {
    console.error("Error creating service:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
