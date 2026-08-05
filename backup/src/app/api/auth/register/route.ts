import { NextResponse } from "next/server";
import { query, hashPassword } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { email, password, name, phone, role, avatar } = await request.json();

    if (!email || !password || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists in any table in PostgreSQL
    const custCheck = await query("SELECT id FROM customers WHERE email = $1", [cleanEmail]);
    const provCheck = await query("SELECT id FROM service_providers WHERE email = $1", [cleanEmail]);
    const empCheck = await query("SELECT id FROM job_providers WHERE email = $1", [cleanEmail]);

    if (custCheck.rows.length > 0 || provCheck.rows.length > 0 || empCheck.rows.length > 0) {
      return NextResponse.json(
        { error: "An account with this email address already exists. Please login instead." },
        { status: 409 }
      );
    }

    // Role-prefixed UID generation
    let prefix = "cust";
    if (role === "provider") prefix = "prov";
    if (role === "job_provider") prefix = "emp";

    const userId = `${prefix}-${Date.now()}`;
    const hashedPassword = hashPassword(password);
    const defaultAvatar = avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || cleanEmail)}`;

    let targetTable = "customers";
    if (role === "provider") targetTable = "service_providers";
    if (role === "job_provider") targetTable = "job_providers";

    await query(
      `INSERT INTO ${targetTable} (id, email, name, phone, avatar, password_hash) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        cleanEmail,
        name || cleanEmail.split("@")[0],
        phone || "+91 98765 00000",
        defaultAvatar,
        hashedPassword
      ]
    );

    const userRes = await query(`SELECT id, email, name, phone, avatar FROM ${targetTable} WHERE id = $1`, [userId]);
    const userObj = { ...userRes.rows[0], role };
    userObj.addresses = [];

    return NextResponse.json({ success: true, user: userObj });
  } catch (error: any) {
    console.error("Error in register API:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
