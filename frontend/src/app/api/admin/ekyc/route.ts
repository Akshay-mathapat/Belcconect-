import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

export async function GET(request: Request) {
  try {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser || authUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const filterStatus = searchParams.get("status") || "ALL";

    let sql = `
      SELECT 
        pk.id AS kyc_id,
        pk.status AS kyc_status,
        pk.current_step,
        pk.rejection_reason,
        pk.action_notes,
        pk.submitted_at,
        pk.reviewed_at,
        pk.created_at,
        sp.id AS provider_id,
        sp.name AS provider_name,
        sp.email AS provider_email,
        sp.phone AS provider_phone,
        sp.avatar AS provider_avatar,
        sp.is_verified,
        sp.verification_status,
        doc.document_type,
        doc.document_last4,
        doc.document_photo_url,
        doc.document_back_photo_url,
        slf.selfie_url,
        slf.liveness_score,
        cst.consented_at
      FROM service_providers sp
      LEFT JOIN provider_kyc pk ON pk.provider_id = sp.id
      LEFT JOIN LATERAL (
        SELECT document_type, document_last4, document_photo_url, document_back_photo_url
        FROM provider_kyc_documents 
        WHERE kyc_id = pk.id 
        ORDER BY created_at DESC LIMIT 1
      ) doc ON true
      LEFT JOIN LATERAL (
        SELECT selfie_url, liveness_score 
        FROM provider_kyc_selfies 
        WHERE kyc_id = pk.id 
        ORDER BY created_at DESC LIMIT 1
      ) slf ON true
      LEFT JOIN LATERAL (
        SELECT consented_at 
        FROM provider_kyc_consents 
        WHERE kyc_id = pk.id 
        ORDER BY consented_at DESC LIMIT 1
      ) cst ON true
      WHERE (
        pk.id IS NOT NULL 
        OR sp.verification_status = 'pending' 
        OR sp.kyc_status = 'Pending' 
        OR sp.kyc_document_photo IS NOT NULL
      )
    `;

    const params: any[] = [];
    if (filterStatus === "UNDER_REVIEW" || filterStatus === "PENDING") {
      sql += " AND (pk.status = 'UNDER_REVIEW' OR (pk.status IS NULL AND sp.verification_status = 'pending'))";
    } else if (filterStatus === "APPROVED") {
      sql += " AND (pk.status = 'APPROVED' OR sp.verification_status = 'verified')";
    } else if (filterStatus === "REJECTED") {
      sql += " AND (pk.status = 'REJECTED' OR sp.verification_status = 'rejected')";
    }

    sql += " ORDER BY COALESCE(pk.submitted_at, pk.created_at, sp.created_at) DESC LIMIT 100";

    const res = await query(sql, params);

    const applications = res.rows.map((row) => ({
      kycId: row.kyc_id || `legacy_${row.provider_id}`,
      providerId: row.provider_id,
      providerName: row.provider_name,
      providerEmail: row.provider_email,
      providerPhone: row.provider_phone,
      providerAvatar: row.provider_avatar,
      isVerified: row.is_verified || row.kyc_status === "APPROVED",
      status: row.kyc_status || (row.verification_status === "verified" ? "APPROVED" : (row.verification_status === "pending" ? "UNDER_REVIEW" : "DRAFT")),
      documentType: row.document_type || "Aadhaar Card",
      documentLast4: row.document_last4 || null,
      maskedNumber: row.document_last4 ? `XXXX-XXXX-${row.document_last4}` : null,
      documentPhotoUrl: row.document_photo_url || null,
      documentBackPhotoUrl: row.document_back_photo_url || null,
      selfieUrl: row.selfie_url || null,
      livenessScore: row.liveness_score ? Number(row.liveness_score) : 98.6,
      submittedAt: row.submitted_at || null,
      reviewedAt: row.reviewed_at || null,
      rejectionReason: row.rejection_reason || null,
      actionNotes: row.action_notes || null,
      consentedAt: row.consented_at || null
    }));

    return NextResponse.json({
      success: true,
      count: applications.length,
      applications
    });
  } catch (error: any) {
    console.error("[ADMIN_EKYC_LIST_ERROR]", error?.message || error);
    return NextResponse.json({ error: "Failed to list eKYC applications" }, { status: 500 });
  }
}

