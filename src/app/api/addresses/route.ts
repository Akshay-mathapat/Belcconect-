import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { userId, type, text } = await request.json();
    if (!userId || !type || !text) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const addrId = `addr-${Date.now()}`;
    await query(
      "INSERT INTO addresses (id, user_id, type, text) VALUES ($1, $2, $3, $4)",
      [addrId, userId, type, text]
    );

    return NextResponse.json({ success: true, address: { id: addrId, type, text } });
  } catch (error: any) {
    console.error("Error creating address:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
