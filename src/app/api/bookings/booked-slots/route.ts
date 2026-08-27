import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const providerId = searchParams.get("providerId");

    if (!date) {
      return NextResponse.json({ bookedSlots: [] });
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrowStr = tomorrowObj.toISOString().split("T")[0];

    let dateCondition = "date = $1";
    if (date === todayStr) {
      dateCondition = "(date = $1 OR date = 'Today')";
    } else if (date === tomorrowStr) {
      dateCondition = "(date = $1 OR date = 'Tomorrow')";
    }

    let sql = `
      SELECT DISTINCT time 
      FROM bookings 
      WHERE ${dateCondition}
        AND (status IS NULL OR LOWER(status) NOT IN ('cancelled', 'rejected'))
    `;
    const params: any[] = [date];

    if (providerId && providerId !== "null" && providerId !== "undefined") {
      sql += ` AND provider_id = $2`;
      params.push(providerId);
    }

    const res = await query(sql, params);
    const bookedSlots = res.rows.map((row: any) => row.time).filter(Boolean);

    return NextResponse.json({ bookedSlots });
  } catch (error: any) {
    console.error("Error fetching booked slots:", error);
    return NextResponse.json({ bookedSlots: [], error: error.message }, { status: 500 });
  }
}
