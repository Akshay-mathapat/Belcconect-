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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { status, date, time } = body;

    // Check if booking exists
    const checkRes = await query("SELECT * FROM bookings WHERE id = $1", [id]);
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Build update parameters dynamically
    let updateFields: string[] = [];
    let queryParams: any[] = [id];
    let paramIndex = 2;

    if (status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      queryParams.push(status);
    }

    if (date !== undefined) {
      updateFields.push(`date = $${paramIndex++}`);
      queryParams.push(date);
    }

    if (time !== undefined) {
      updateFields.push(`time = $${paramIndex++}`);
      queryParams.push(time);
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updateQuery = `
      UPDATE bookings 
      SET ${updateFields.join(", ")} 
      WHERE id = $1 
      RETURNING *
    `;

    await query(updateQuery, queryParams);

    const finalRes = await query(
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
      [id]
    );

    return NextResponse.json({ success: true, booking: mapRowToBooking(finalRes.rows[0]) });
  } catch (error: any) {
    console.error(`Error updating booking ${id}:`, error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
