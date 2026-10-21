import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

export async function GET(request: Request) {
  try {
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized: Missing authentication session" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const paramProviderId = searchParams.get("providerId");
    const providerId = (authUser.role === "admin" && paramProviderId) ? paramProviderId : authUser.userId;

    const res = await query(
      `SELECT 
        pk.id, pk.status, pk.current_step, pk.rejection_reason, pk.action_notes, pk.submitted_at, pk.reviewed_at,
        sp.id AS provider_id, sp.name, sp.email, sp.phone, sp.is_verified, sp.verification_status, sp.kyc_status,
        doc.document_type, doc.document_last4, doc.document_photo_url,
        slf.selfie_url, slf.liveness_score
       FROM service_providers sp
       LEFT JOIN provider_kyc pk ON pk.provider_id = sp.id
       LEFT JOIN LATERAL (
         SELECT document_type, document_last4, document_photo_url 
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
       WHERE sp.id = $1`,
      [providerId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const row = res.rows[0];
    const isVerified = row.verification_status === "verified" || row.status === "APPROVED";
    const status = isVerified ? "APPROVED" : (row.status || (row.verification_status === "pending" ? "UNDER_REVIEW" : "DRAFT"));

    return NextResponse.json({
      success: true,
      providerId: row.provider_id,
      name: row.name,
      isVerified,
      verificationStatus: row.verification_status || (isVerified ? "verified" : "unverified"),
      kyc: {
        id: row.id,
        status,
        currentStep: isVerified ? 6 : (row.current_step || (status === "UNDER_REVIEW" ? 5 : 1)),
        rejectionReason: row.rejection_reason || null,
        actionNotes: row.action_notes || null,
        submittedAt: row.submitted_at || null,
        reviewedAt: row.reviewed_at || null,
        documentType: row.document_type || "Aadhaar Card",
        maskedNumber: row.document_last4 ? `XXXX-XXXX-${row.document_last4}` : null,
        documentPhoto: row.document_photo_url || null,
        selfiePhoto: row.selfie_url || null,
        livenessScore: row.liveness_score ? Number(row.liveness_score) : null
      }
    });
  } catch (error: any) {
    console.error("[EKYC_STATUS_ERROR]", error?.message || error);
    return NextResponse.json({ error: "Failed to fetch KYC status" }, { status: 500 });
  }
}

