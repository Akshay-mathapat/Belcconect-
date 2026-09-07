import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get("providerId");
    const category = searchParams.get("category");
    const searchQuery = searchParams.get("query");

    let sql = `
      SELECT s.*, u.name as provider_name, u.avatar as provider_avatar, u.phone as provider_phone,
             (SELECT COUNT(*) FROM bookings b WHERE b.service_name = s.name AND b.provider_id = s.provider_id) as bookings_count,
             (SELECT ROUND(AVG(b.rating), 1) FROM bookings b WHERE b.service_name = s.name AND b.provider_id = s.provider_id AND b.rating IS NOT NULL) as avg_rating
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

    sql += " ORDER BY s.created_at DESC, s.id DESC";

    const res = await query(sql, queryParams);
    
    // Map DB rows to Frontend ServiceItem type
    const services = res.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      subcategory: row.subcategory || "",
      description: row.description || "",
      isAvailable: row.is_available,
      providerId: row.provider_id,
      providerName: row.provider_name,
      providerAvatar: row.provider_avatar,
      providerPhone: row.provider_phone,
      bookingsCount: Number(row.bookings_count || 0),
      rating: row.avg_rating ? Number(row.avg_rating) : 0.0
    }));

    return NextResponse.json(services);
  } catch (error: any) {
    console.error("Error fetching services:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized: Missing authentication token" }, { status: 401 });
    }

    if (authUser.role !== "provider" && authUser.role !== "admin") {
      return NextResponse.json({ error: "Provider account required" }, { status: 403 });
    }

    const body = await request.json();
    const { name, category, subcategory, description } = body;
    const providerId = authUser.userId;

    if (!name || !category) {
      return NextResponse.json({ error: "Service name and category are required" }, { status: 400 });
    }

    const serviceId = `SRV-${Date.now()}`;
    await query(
      `INSERT INTO services (id, provider_id, name, category, subcategory, description, is_available) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [serviceId, providerId, name, category, subcategory || null, description || null, true]
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
      isAvailable: row.is_available,
      providerId: row.provider_id,
      providerName: row.provider_name,
      providerAvatar: row.provider_avatar,
      providerPhone: row.provider_phone,
      bookingsCount: 0,
      rating: 0.0
    };

    return NextResponse.json({ success: true, service: createdService });
  } catch (error: any) {
    console.error("Error creating service:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
