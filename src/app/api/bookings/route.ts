import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// Helper to map DB row to Frontend Booking type
function mapRowToBooking(row: any) {
  return {
    id: row.id,
    customerName: row.customer_name || "Customer",
    customerPhone: row.customer_phone || "",
    customerPhoto: row.customer_photo || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    serviceName: row.service_name,
    category: row.category,
    date: row.date,
    time: row.time,
    address: row.address || "No address provided",
    status: row.status,
    providerName: row.provider_name || "Verified Expert",
    uploadedImages: [],
  };
}

export async function GET(request: Request) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Retrieve bookings where this user is either customer or provider using JOINs to fetch normalized data
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
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.avatar AS customer_photo,
        addr.text AS address
      FROM bookings b
      LEFT JOIN customers c ON b.customer_id = c.id
      LEFT JOIN (
        SELECT DISTINCT ON (user_id) user_id, text 
        FROM addresses 
        ORDER BY user_id, created_at ASC
      ) addr ON b.customer_id = addr.user_id
      WHERE b.customer_id = $1 OR b.provider_id = $2
      ORDER BY b.id DESC`,
      [userId, userId]
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
    const body = await request.json();
    const {
      customerId,
      providerId,
      providerName,
      serviceName,
      category,
      date,
      time,
    } = body;

    if (!customerId || !providerId || !serviceName || !date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const bookingId = `B-${Math.floor(1000 + Math.random() * 9000)}`;

    await query(
      `INSERT INTO bookings (
        id, customer_id, provider_id, provider_name, service_name, category, 
        date, time, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        bookingId,
        customerId,
        providerId,
        providerName || "Ramesh Sharma",
        serviceName,
        category || "General",
        date,
        time || "10:00 AM",
        "Requested", // initial status
      ]
    );

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
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.avatar AS customer_photo,
        addr.text AS address
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
