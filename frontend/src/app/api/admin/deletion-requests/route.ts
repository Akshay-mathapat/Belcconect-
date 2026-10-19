import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

export async function GET(request: Request) {
  try {
    // 1. Strict server-side admin check
    const authUser = getAuthenticatedUser(request);
    if (!authUser || authUser.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Administrator privileges required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status")?.toLowerCase()?.trim();

    let sql = `
      SELECT 
        id, 
        user_id, 
        role, 
        email, 
        phone, 
        reason, 
        status, 
        requested_via, 
        created_at, 
        completed_at,
        rejection_reason,
        processed_by
      FROM public.account_deletion_requests
    `;
    const params: any[] = [];

    if (statusFilter && ["pending", "completed", "rejected"].includes(statusFilter)) {
      sql += " WHERE status = $1";
      params.push(statusFilter);
    }

    sql += " ORDER BY created_at DESC LIMIT 100";

    const res = await query(sql, params);

    // 2. Enrich each request with Requester Verification Details
    const requestsWithVerification = await Promise.all(
      res.rows.map(async (row: any) => {
        const targetRole = row.role;
        const normalizedEmail = row.email ? row.email.trim().toLowerCase() : null;
        const normalizedPhone = row.phone ? row.phone.trim() : null;
        const targetUserId = row.user_id;

        let matchedUser: any = null;
        let activeBookingsCount = 0;

        if (targetRole === "customer" || targetRole === "user") {
          const userRes = await query(
            `SELECT id, name, email, phone, created_at 
             FROM public.customers 
             WHERE ($1::text IS NOT NULL AND id = $1)
                OR ($2::text IS NOT NULL AND LOWER(email) = LOWER($2))
                OR ($3::text IS NOT NULL AND phone = $3)
             LIMIT 1`,
            [targetUserId || null, normalizedEmail, normalizedPhone]
          );
          if (userRes.rows.length > 0) {
            matchedUser = userRes.rows[0];
            const bookingsRes = await query(
              `SELECT COUNT(*)::int as count 
               FROM public.bookings 
               WHERE customer_id = $1 
                 AND status IN ('Pending', 'Accepted', 'OnTheWay', 'Arrived', 'Started')`,
              [matchedUser.id]
            );
            activeBookingsCount = bookingsRes.rows[0]?.count || 0;
          }
        } else if (targetRole === "service_provider" || targetRole === "provider") {
          const userRes = await query(
            `SELECT id, name, email, phone, verification_status, created_at 
             FROM public.service_providers 
             WHERE ($1::text IS NOT NULL AND id = $1)
                OR ($2::text IS NOT NULL AND LOWER(email) = LOWER($2))
                OR ($3::text IS NOT NULL AND phone = $3)
             LIMIT 1`,
            [targetUserId || null, normalizedEmail, normalizedPhone]
          );
          if (userRes.rows.length > 0) {
            matchedUser = userRes.rows[0];
            const bookingsRes = await query(
              `SELECT COUNT(*)::int as count 
               FROM public.bookings 
               WHERE provider_id = $1 
                 AND status IN ('Accepted', 'OnTheWay', 'Arrived', 'Started')`,
              [matchedUser.id]
            );
            activeBookingsCount = bookingsRes.rows[0]?.count || 0;
          }
        } else if (targetRole === "job_provider") {
          const userRes = await query(
            `SELECT id, name, email, phone, created_at 
             FROM public.job_providers 
             WHERE ($1::text IS NOT NULL AND id = $1)
                OR ($2::text IS NOT NULL AND LOWER(email) = LOWER($2))
                OR ($3::text IS NOT NULL AND phone = $3)
             LIMIT 1`,
            [targetUserId || null, normalizedEmail, normalizedPhone]
          );
          if (userRes.rows.length > 0) {
            matchedUser = userRes.rows[0];
          }
        }

        return {
          id: row.id,
          userId: row.user_id,
          role: row.role,
          email: row.email,
          phone: row.phone,
          reason: row.reason,
          status: row.status,
          requestedVia: row.requested_via,
          createdAt: row.created_at,
          completedAt: row.completed_at,
          rejectionReason: row.rejection_reason,
          processedBy: row.processed_by,
          verification: {
            userFound: !!matchedUser,
            matchedUserId: matchedUser?.id || null,
            matchedName: matchedUser?.name || null,
            matchedEmail: matchedUser?.email || null,
            matchedPhone: matchedUser?.phone || null,
            activeBookingsCount
          }
        };
      })
    );

    return NextResponse.json({
      success: true,
      requests: requestsWithVerification
    });
  } catch (error: any) {
    console.error("Admin fetch deletion requests error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to load account deletion requests." },
      { status: 500 }
    );
  }
}

