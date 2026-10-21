import { NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = getAuthenticatedUser(request);
    if (!authUser || authUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    const { id } = await params;
    const cleanId = decodeURIComponent(id || "").trim();

    if (!cleanId) {
      return NextResponse.json({ error: "KYC Application ID or Provider ID is required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { decision, rejectionReason, notes } = body;

    const validDecisions = ["APPROVED", "REJECTED", "ACTION_REQUIRED"];
    if (!decision || !validDecisions.includes(decision.toUpperCase())) {
      return NextResponse.json(
        { error: "Invalid decision. Must be APPROVED, REJECTED, or ACTION_REQUIRED." },
        { status: 400 }
      );
    }

    const cleanDecision = decision.toUpperCase();

    // 1. Resolve kycId and providerId (supports passing kyc.id or legacy_providerId or providerId)
    let kycRecord = null;
    let providerId = cleanId;

    if (cleanId.startsWith("kyc_")) {
      const kycRes = await query("SELECT id, provider_id FROM provider_kyc WHERE id = $1", [cleanId]);
      if (kycRes.rows.length > 0) {
        kycRecord = kycRes.rows[0];
        providerId = kycRecord.provider_id;
      }
    } else if (cleanId.startsWith("legacy_")) {
      providerId = cleanId.replace(/^legacy_/, "");
    }

    // Check if provider exists
    const provRes = await query("SELECT id, name, email FROM service_providers WHERE id = $1", [providerId]);
    if (provRes.rows.length === 0) {
      return NextResponse.json({ error: "Service provider not found in database" }, { status: 404 });
    }

    const adminId = authUser.userId || "admin-system";
    const reviewId = `rev_${crypto.randomUUID()}`;

    // 2. Execute decision transaction
    if (cleanDecision === "APPROVED") {
      // Approve KYC
      await query(
        `UPDATE service_providers
         SET 
           is_verified = TRUE,
           verification_status = 'verified',
           kyc_status = 'Verified',
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [providerId]
      );

      await query(
        `INSERT INTO provider_kyc (id, provider_id, status, current_step, reviewed_at, reviewed_by, updated_at)
         VALUES ($1, $2, 'APPROVED', 6, CURRENT_TIMESTAMP, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (provider_id) DO UPDATE
         SET status = 'APPROVED', current_step = 6, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $3, rejection_reason = NULL, action_notes = NULL, updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [`kyc_${crypto.randomUUID()}`, providerId, adminId]
      );
    } else if (cleanDecision === "REJECTED") {
      const reason = rejectionReason || "Identity document or live selfie does not meet BelConnect compliance standards.";

      await query(
        `UPDATE service_providers
         SET 
           is_verified = FALSE,
           verification_status = 'rejected',
           kyc_status = 'Rejected',
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [providerId]
      );

      await query(
        `INSERT INTO provider_kyc (id, provider_id, status, current_step, rejection_reason, reviewed_at, reviewed_by, updated_at)
         VALUES ($1, $2, 'REJECTED', 1, $3, CURRENT_TIMESTAMP, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (provider_id) DO UPDATE
         SET status = 'REJECTED', current_step = 1, rejection_reason = $3, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $4, updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [`kyc_${crypto.randomUUID()}`, providerId, reason, adminId]
      );
    } else if (cleanDecision === "ACTION_REQUIRED") {
      const actionNotes = notes || "Please re-upload a clear front photo of your government document.";

      await query(
        `UPDATE service_providers
         SET 
           is_verified = FALSE,
           verification_status = 'unverified',
           kyc_status = 'Action Required',
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [providerId]
      );

      await query(
        `INSERT INTO provider_kyc (id, provider_id, status, current_step, action_notes, reviewed_at, reviewed_by, updated_at)
         VALUES ($1, $2, 'ACTION_REQUIRED', 2, $3, CURRENT_TIMESTAMP, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (provider_id) DO UPDATE
         SET status = 'ACTION_REQUIRED', current_step = 2, action_notes = $3, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $4, updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [`kyc_${crypto.randomUUID()}`, providerId, actionNotes, adminId]
      );
    }

    // 3. Write audit log to provider_kyc_reviews
    const currentKyc = await query("SELECT id FROM provider_kyc WHERE provider_id = $1", [providerId]);
    if (currentKyc.rows.length > 0) {
      await query(
        `INSERT INTO provider_kyc_reviews (id, kyc_id, admin_id, decision, rejection_reason, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [reviewId, currentKyc.rows[0].id, adminId, cleanDecision, rejectionReason || null, notes || null]
      );
    }

    return NextResponse.json({
      success: true,
      message: `eKYC application successfully ${cleanDecision.toLowerCase()}.`,
      decision: cleanDecision,
      providerId
    });
  } catch (error: any) {
    console.error("[ADMIN_EKYC_DECISION_ERROR]", error?.message || error);
    return NextResponse.json({ error: "Failed to process eKYC decision" }, { status: 500 });
  }
}

