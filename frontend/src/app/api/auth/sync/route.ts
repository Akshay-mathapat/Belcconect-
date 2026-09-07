import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { user } = await request.json();
    if (!user || !user.email) {
      return NextResponse.json({ error: "Invalid user data" }, { status: 400 });
    }

    const { id, email, name, role, phone, avatar } = user;
    const cleanEmail = email.trim().toLowerCase();

    let targetTable = "customers";
    if (role === "provider") targetTable = "service_providers";
    if (role === "job_provider") targetTable = "job_providers";

    // Check if user already exists in respective table
    const userRes = await query(`SELECT * FROM ${targetTable} WHERE email = $1`, [cleanEmail]);

    if (userRes.rows.length > 0) {
      const existingUser = userRes.rows[0];
      // Update fields if they changed
      await query(
        `UPDATE ${targetTable} SET name = COALESCE($1, name), phone = COALESCE($2, phone), avatar = COALESCE($3, avatar) WHERE id = $4`,
        [name, phone, avatar, existingUser.id]
      );
      const updatedRes = await query(`SELECT id, email, name, phone, avatar FROM ${targetTable} WHERE id = $1`, [existingUser.id]);
      const userObj = { ...updatedRes.rows[0], role };

      if (role === "user") {
        const addrRes = await query("SELECT id, type, text FROM addresses WHERE user_id = $1", [userObj.id]);
        userObj.addresses = addrRes.rows || [];
      } else {
        userObj.addresses = [];
      }

      return NextResponse.json({ success: true, user: userObj });
    } else {
      // Insert new user
      let prefix = "cust";
      if (role === "provider") prefix = "prov";
      if (role === "job_provider") prefix = "emp";

      const newUserId = id || `${prefix}-${Date.now()}`;
      await query(
        `INSERT INTO ${targetTable} (id, email, name, phone, avatar) VALUES ($1, $2, $3, $4, $5)`,
        [newUserId, cleanEmail, name || cleanEmail.split("@")[0], phone || null, avatar || null]
      );
      const insertedRes = await query(`SELECT id, email, name, phone, avatar FROM ${targetTable} WHERE id = $1`, [newUserId]);
      const userObj = { ...insertedRes.rows[0], role };
      userObj.addresses = [];

      return NextResponse.json({ success: true, user: userObj });
    }
  } catch (error: any) {
    console.error("Error syncing auth user:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
