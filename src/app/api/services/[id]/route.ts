import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { name, category, subcategory, description, basePrice, isAvailable } = body;

    // Check if service exists
    const checkRes = await query("SELECT * FROM services WHERE id = $1", [id]);
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    let updateFields: string[] = [];
    let queryParams: any[] = [id];
    let paramIndex = 2;

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      queryParams.push(name);
    }
    if (category !== undefined) {
      updateFields.push(`category = $${paramIndex++}`);
      queryParams.push(category);
    }
    if (subcategory !== undefined) {
      updateFields.push(`subcategory = $${paramIndex++}`);
      queryParams.push(subcategory);
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      queryParams.push(description);
    }
    if (basePrice !== undefined) {
      updateFields.push(`base_price = $${paramIndex++}`);
      queryParams.push(basePrice);
    }
    if (isAvailable !== undefined) {
      updateFields.push(`is_available = $${paramIndex++}`);
      queryParams.push(isAvailable);
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updateQuery = `
      UPDATE services 
      SET ${updateFields.join(", ")} 
      WHERE id = $1 
      RETURNING *
    `;

    await query(updateQuery, queryParams);

    // Fetch updated service with joined provider details
    const res = await query(
      `SELECT s.*, u.name as provider_name, u.avatar as provider_avatar, u.phone as provider_phone 
       FROM services s 
       JOIN service_providers u ON s.provider_id = u.id
       WHERE s.id = $1`,
      [id]
    );

    const row = res.rows[0];
    const updatedService = {
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

    return NextResponse.json({ success: true, service: updatedService });
  } catch (error: any) {
    console.error("Error updating service:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Check if service exists
    const checkRes = await query("SELECT * FROM services WHERE id = $1", [id]);
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    await query("DELETE FROM services WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting service:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
