import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Missing notification id" }, { status: 400 });
    }

    await query(`UPDATE notifications SET is_read = TRUE WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("PATCH /api/notifications/[id]/read error:", error);
    return NextResponse.json({ error: error.message || "Failed to mark notification as read" }, { status: 500 });
  }
}
