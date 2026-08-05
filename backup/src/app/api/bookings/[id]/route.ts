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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { status, date, time, beforeImage, afterImage, internalNotes } = body;

    // Check if booking exists
    const checkRes = await query("SELECT * FROM bookings WHERE id = $1", [id]);
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const currentBooking = checkRes.rows[0];

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

    if (internalNotes !== undefined) {
      updateFields.push(`internal_notes = $${paramIndex++}`);
      queryParams.push(internalNotes);
    }

    if (beforeImage !== undefined) {
      // Append to before_images array
      updateFields.push(`before_images = array_append(COALESCE(before_images, ARRAY[]::text[]), $${paramIndex++})`);
      queryParams.push(beforeImage);
    }

    if (afterImage !== undefined) {
      // Append to after_images array
      updateFields.push(`after_images = array_append(COALESCE(after_images, ARRAY[]::text[]), $${paramIndex++})`);
      queryParams.push(afterImage);
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

    const result = await query(updateQuery, queryParams);
    return NextResponse.json({ success: true, booking: mapRowToBooking(result.rows[0]) });
  } catch (error: any) {
    console.error(`Error updating booking ${id}:`, error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
