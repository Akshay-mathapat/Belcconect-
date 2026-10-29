import { NextResponse } from "next/server";
import crypto from "crypto";
import { query, getClient } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";
import { performAccountDeletionTx } from "@/lib/accountDeletion";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Strict server-side admin check
    const authUser = await getAuthenticatedUser(request);
    if (!authUser || authUser.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Administrator privileges required." },
        { status: 403 }
      );
    }

    const { id } = await params;

    // 2. Query deletion request
    const reqRes = await query(
      `SELECT id, user_id, role, email, phone, reason, status, requested_via 
       FROM public.account_deletion_requests 
       WHERE id = $1`,
      [id]
    );

    if (reqRes.rows.length === 0) {
      return NextResponse.json(
        { error: "Account deletion request not found." },
        { status: 404 }
      );
    }

    const reqItem = reqRes.rows[0];
    if (reqItem.status === "completed") {
      return NextResponse.json(
        { error: "This deletion request has already been marked as completed." },
        { status: 400 }
      );
    }

    const targetRole = reqItem.role;
    const normalizedEmail = reqItem.email ? reqItem.email.trim().toLowerCase() : null;
    const normalizedPhone = reqItem.phone ? reqItem.phone.trim() : null;

    // 3. Resolve target user in database
    let targetUser: any = null;
    if (targetRole === "customer" || targetRole === "user") {
      const uRes = await query(
        `SELECT id, name, email, phone FROM public.customers 
         WHERE ($1::text IS NOT NULL AND id = $1)
            OR ($2::text IS NOT NULL AND LOWER(email) = LOWER($2))
            OR ($3::text IS NOT NULL AND phone = $3)
         LIMIT 1`,
        [reqItem.user_id || null, normalizedEmail, normalizedPhone]
      );
      if (uRes.rows.length > 0) targetUser = uRes.rows[0];
    } else if (targetRole === "service_provider" || targetRole === "provider") {
      const uRes = await query(
        `SELECT id, name, email, phone FROM public.service_providers 
         WHERE ($1::text IS NOT NULL AND id = $1)
            OR ($2::text IS NOT NULL AND LOWER(email) = LOWER($2))
            OR ($3::text IS NOT NULL AND phone = $3)
         LIMIT 1`,
        [reqItem.user_id || null, normalizedEmail, normalizedPhone]
      );
      if (uRes.rows.length > 0) targetUser = uRes.rows[0];
    } else if (targetRole === "job_provider") {
      const uRes = await query(
        `SELECT id, name, email, phone FROM public.job_providers 
         WHERE ($1::text IS NOT NULL AND id = $1)
            OR ($2::text IS NOT NULL AND LOWER(email) = LOWER($2))
            OR ($3::text IS NOT NULL AND phone = $3)
         LIMIT 1`,
        [reqItem.user_id || null, normalizedEmail, normalizedPhone]
      );
      if (uRes.rows.length > 0) targetUser = uRes.rows[0];
    }

    // 4. If user exists, check active bookings in progress
    if (targetUser && (targetRole === "customer" || targetRole === "user")) {
      const bRes = await query(
        `SELECT id FROM public.bookings 
         WHERE customer_id = $1 AND status IN ('Pending', 'Accepted', 'OnTheWay', 'Arrived', 'Started') 
         LIMIT 5`,
        [targetUser.id]
      );
      if (bRes.rows.length > 0) {
        return NextResponse.json(
          {
            error: "Cannot complete deletion: Customer still has active service bookings in progress. Cancel or complete them first."
          },
          { status: 400 }
        );
      }
    } else if (targetUser && (targetRole === "service_provider" || targetRole === "provider")) {
      const bRes = await query(
        `SELECT id FROM public.bookings 
         WHERE provider_id = $1 AND status IN ('Accepted', 'OnTheWay', 'Arrived', 'Started') 
         LIMIT 5`,
        [targetUser.id]
      );
      if (bRes.rows.length > 0) {
        return NextResponse.json(
          {
            error: "Cannot complete deletion: Service provider has active service bookings in progress."
          },
          { status: 400 }
        );
      }
    }

    // 5. Execute deletion in atomic transaction
    const client = await getClient();
    try {
      await client.query("BEGIN");

      if (targetUser) {
        await performAccountDeletionTx(
          client,
          targetUser.id,
          targetRole,
          targetUser.email || reqItem.email,
          targetUser.phone || reqItem.phone,
          `Admin verified and completed web-portal deletion request #${id}`
        );
      }

      await client.query(
        `UPDATE public.account_deletion_requests 
         SET status = 'completed', 
             completed_at = NOW(), 
             processed_by = $1 
         WHERE id = $2`,
        [authUser.email || authUser.userId, id]
      );

      await client.query("COMMIT");
    } catch (txError: any) {
      await client.query("ROLLBACK");
      console.error("[Admin Complete Deletion Transaction Error]:", txError?.message || txError);
      throw txError;
    } finally {
      client.release();
    }

    // 6. Record in admin_audit_logs
    const auditId = crypto.randomUUID();
    await query(
      `INSERT INTO admin_audit_logs (id, admin_id, action, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        auditId,
        authUser.userId,
        "COMPLETE_DELETION_REQUEST",
        id,
        JSON.stringify({
          adminEmail: authUser.email,
          targetRole,
          targetUserId: targetUser?.id || null,
          userExisted: !!targetUser,
          timestamp: new Date().toISOString()
        })
      ]
    ).catch((err) => {
      console.warn("Failed to write to admin_audit_logs:", err?.message || err);
    });

    return NextResponse.json({
      success: true,
      message: `Account deletion request '${id}' has been verified and permanently processed.`
    });
  } catch (error: any) {
    console.error("Admin complete deletion error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to complete account deletion request." },
      { status: 500 }
    );
  }
}

