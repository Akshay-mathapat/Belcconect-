import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// Helper to map DB row to Frontend Booking type
function mapRowToBooking(row: any) {
  return {
    id: row.id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone || "",
    customerPhoto: row.customer_photo || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    serviceName: row.service_name,
    category: row.category,
    date: row.date,
    time: row.time,
    address: row.address,
    distance: row.distance || "1.2 km",
    price: Number(row.price),
    status: row.status,
    problemDescription: row.problem_description || "",
    providerName: row.provider_name || "Verified Expert",
    beforeImages: row.before_images || [],
    afterImages: row.after_images || [],
    internalNotes: row.internal_notes || "",
    createdAt: row.created_at,
  };
}

export async function GET(request: Request) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Retrieve bookings where this user is either customer or provider
    const bookingsRes = await query(
      "SELECT * FROM bookings WHERE customer_id = $1 OR provider_id = $2 ORDER BY created_at DESC",
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
      customerName,
      customerPhone,
      customerPhoto,
      date,
      time,
      address,
      price,
      problemDescription,
    } = body;

    if (!customerId || !providerId || !serviceName || !date || !address) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const bookingId = `B-${Math.floor(1000 + Math.random() * 9000)}`;

    await query(
      `INSERT INTO bookings (
        id, customer_id, provider_id, provider_name, service_name, category, 
        customer_name, customer_phone, customer_photo, date, time, 
        address, price, status, problem_description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        bookingId,
        customerId,
        providerId,
        providerName || "Ramesh Sharma",
        serviceName,
        category || "General",
        customerName || "Customer",
        customerPhone || "",
        customerPhoto || "",
        date,
        time || "10:00 AM",
        address,
        price || 199.00,
        "Requested", // initial status
        problemDescription || "",
      ]
    );

    const insertedRes = await query("SELECT * FROM bookings WHERE id = $1", [bookingId]);
    return NextResponse.json({ success: true, booking: mapRowToBooking(insertedRes.rows[0]) });
  } catch (error: any) {
    console.error("Error creating booking:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
