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
    const authUser = await getAuthenticatedUser(request);
    if (!authUser || authUser.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Administrator privileges required." },
        { status: 403 }
      );
    }

    const { id } = await params;

    // 2. Update provider verification status to verified
    const updateRes = await query(
      `UPDATE service_providers
       SET 
         verification_status = 'verified',
         is_verified = TRUE,
         kyc_status = 'Verified',
         rejection_reason = NULL,
         verified_at = CURRENT_TIMESTAMP,
         verified_by = $1
       WHERE id = $2
       RETURNING id, name, email, phone, verification_status, is_verified, verified_at, verified_by`,
      [authUser.email || authUser.userId, id]
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
       SET status = 'APPROVED', current_step = 6, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $1, updated_at = CURRENT_TIMESTAMP
       WHERE provider_id = $2`,
      [authUser.email || authUser.userId, id]
    ).catch(() => {});

    // 3. Record in admin_audit_logs
    const auditId = crypto.randomUUID();
    await query(
      `INSERT INTO admin_audit_logs (id, admin_id, action, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        auditId,
        authUser.userId,
        "APPROVE_PROVIDER",
        id,
        JSON.stringify({
          adminEmail: authUser.email,
          previousStatus: "pending",
          newStatus: "verified",
          timestamp: new Date().toISOString()
        })
      ]
    ).catch((err) => {
      console.warn("Failed to write to admin_audit_logs:", err?.message || err);
    });

    // 4. Notify provider via in-app notifications
    const notificationId = crypto.randomUUID();
    const notificationTitle = "Account Verified!";
    const notificationBody = "Congratulations! Your service provider profile has been approved and verified. You can now receive customer bookings in Belagavi.";

    await query(
      `INSERT INTO notifications (id, user_id, type, title, body)
       VALUES ($1, $2, $3, $4, $5)`,
      [notificationId, id, "kyc_verified", notificationTitle, notificationBody]
    ).catch((err) => {
      console.warn("Failed to insert provider approval notification:", err?.message || err);
    });

    // Dispatch push notification if subscribed
    sendPushToUser(id, {
      title: notificationTitle,
      body: notificationBody
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Provider '${provider.name}' has been successfully approved and verified.`,
      provider
    });
  } catch (error: any) {
    console.error("Admin approve provider error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to approve provider." },
      { status: 500 }
    );
  }
}

