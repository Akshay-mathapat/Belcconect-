import { NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";
import { sendPushToUser } from "@/lib/pushNotifications";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Enforce admin role
    const authUser = getAuthenticatedUser(request);
    if (!authUser || authUser.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Administrator privileges required." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return NextResponse.json(
        { error: "Rejection reason is required." },
        { status: 400 }
      );
    }

    const cleanReason = reason.trim();

    // 2. Update provider verification status to rejected
    const updateRes = await query(
      `UPDATE service_providers
       SET 
         verification_status = 'rejected',
         is_verified = FALSE,
         kyc_status = 'Rejected',
         rejection_reason = $1,
         verified_at = CURRENT_TIMESTAMP,
         verified_by = $2
       WHERE id = $3
       RETURNING id, name, email, phone, verification_status, is_verified, rejection_reason, verified_at, verified_by`,
      [cleanReason, authUser.email || authUser.userId, id]
    );

    if (updateRes.rows.length === 0) {
      return NextResponse.json(
        { error: "Service provider not found." },
        { status: 404 }
      );
    }

    const provider = updateRes.rows[0];

    // Sync provider_kyc table if a KYC record exists
    await query(
      `UPDATE provider_kyc
       SET status = 'REJECTED', rejection_reason = $1, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $2, updated_at = CURRENT_TIMESTAMP
       WHERE provider_id = $3`,
      [cleanReason, authUser.email || authUser.userId, id]
    ).catch(() => {});

    // 3. Record in admin_audit_logs
    const auditId = crypto.randomUUID();
    await query(
      `INSERT INTO admin_audit_logs (id, admin_id, action, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        auditId,
        authUser.userId,
        "REJECT_PROVIDER",
        id,
        JSON.stringify({
          adminEmail: authUser.email,
          reason: cleanReason,
          previousStatus: "pending",
          newStatus: "rejected",
          timestamp: new Date().toISOString()
        })
      ]
    ).catch((err) => {
      console.warn("Failed to write to admin_audit_logs:", err?.message || err);
    });

    // 4. Notify provider via in-app notifications
    const notificationId = crypto.randomUUID();
    const notificationTitle = "Verification Update";
    const notificationBody = `Your service provider profile verification could not be approved. Reason: ${cleanReason}`;

    await query(
      `INSERT INTO notifications (id, user_id, type, title, body)
       VALUES ($1, $2, $3, $4, $5)`,
      [notificationId, id, "kyc_rejected", notificationTitle, notificationBody]
    ).catch((err) => {
      console.warn("Failed to insert provider rejection notification:", err?.message || err);
    });

    // Dispatch push notification if subscribed
    sendPushToUser(id, {
      title: notificationTitle,
      body: notificationBody
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Provider '${provider.name}' has been rejected with reason: ${cleanReason}`,
      provider
    });
  } catch (error: any) {
    console.error("Admin reject provider error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to reject provider." },
      { status: 500 }
    );
  }
}

