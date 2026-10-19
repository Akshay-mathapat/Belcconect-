import { NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Strict server-side admin check
    const authUser = getAuthenticatedUser(request);
    if (!authUser || authUser.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Administrator privileges required." },
        { status: 403 }
      );
    }

    const { id } = await params;
    let body: any = {};
    try {
      body = await request.json();
    } catch (_) {}

    const reason = typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim()
      : "Requester identity could not be verified or request withdrawn";

    // 2. Query deletion request
    const reqRes = await query(
      `SELECT id, user_id, role, email, phone, status 
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
        { error: "Cannot reject a deletion request that has already been completed." },
        { status: 400 }
      );
    }

    // 3. Mark request as rejected
    await query(
      `UPDATE public.account_deletion_requests 
       SET status = 'rejected', 
           rejection_reason = $1, 
           completed_at = NOW(), 
           processed_by = $2 
       WHERE id = $3`,
      [reason, authUser.email || authUser.userId, id]
    );

    // 4. Record in admin_audit_logs
    const auditId = crypto.randomUUID();
    await query(
      `INSERT INTO admin_audit_logs (id, admin_id, action, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        auditId,
        authUser.userId,
        "REJECT_DELETION_REQUEST",
        id,
        JSON.stringify({
          adminEmail: authUser.email,
          reason,
          targetRole: reqItem.role,
          targetUserId: reqItem.user_id,
          timestamp: new Date().toISOString()
        })
      ]
    ).catch((err) => {
      console.warn("Failed to write to admin_audit_logs:", err?.message || err);
    });

    return NextResponse.json({
      success: true,
      message: `Account deletion request '${id}' has been rejected.`
    });
  } catch (error: any) {
    console.error("Admin reject deletion error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to reject account deletion request." },
      { status: 500 }
    );
  }
}

