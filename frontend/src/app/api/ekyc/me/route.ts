import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

export async function GET(request: Request) {
  try {
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized: Missing authentication session" }, { status: 401 });
    }

    if (authUser.role !== "provider" && authUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Provider account required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const paramProviderId = searchParams.get("providerId");
    const providerId = (authUser.role === "admin" && paramProviderId) ? paramProviderId : authUser.userId;

    // Fetch primary KYC application
    const kycRes = await query(
      `SELECT 
        pk.id, pk.provider_id, pk.status, pk.current_step, pk.rejection_reason, pk.action_notes,
        pk.submitted_at, pk.reviewed_at, pk.reviewed_by, pk.created_at, pk.updated_at,
        sp.name, sp.email, sp.phone, sp.is_verified, sp.verification_status, sp.kyc_status,
        sp.kyc_document_type, sp.kyc_document_last4, sp.aadhaar_last4, sp.pan_last4, sp.kyc_document_photo
      FROM service_providers sp
      LEFT JOIN provider_kyc pk ON pk.provider_id = sp.id
      WHERE sp.id = $1`,
      [providerId]
    );

    if (kycRes.rows.length === 0) {
      return NextResponse.json({ error: "Provider profile not found" }, { status: 404 });
    }

    const row = kycRes.rows[0];
    const kycId = row.id;

    let document = null;
    let selfie = null;
    let consent = null;

    if (kycId) {
      const docRes = await query(
        `SELECT id, document_type, document_last4, document_photo_url, document_back_photo_url, extracted_name, is_valid_format, created_at 
         FROM provider_kyc_documents WHERE kyc_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [kycId]
      );
      if (docRes.rows.length > 0) document = docRes.rows[0];

      const selfieRes = await query(
        `SELECT id, selfie_url, liveness_score, face_match_score, capture_metadata, created_at 
         FROM provider_kyc_selfies WHERE kyc_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [kycId]
      );
      if (selfieRes.rows.length > 0) selfie = selfieRes.rows[0];

      const consentRes = await query(
        `SELECT id, consent_version, consent_text, consented_at 
         FROM provider_kyc_consents WHERE kyc_id = $1 ORDER BY consented_at DESC LIMIT 1`,
        [kycId]
      );
      if (consentRes.rows.length > 0) consent = consentRes.rows[0];
    }

    const isVerified = row.verification_status === "verified" || row.status === "APPROVED";

    return NextResponse.json({
      success: true,
      providerId: row.provider_id || providerId,
      name: row.name,
      email: row.email,
      phone: row.phone,
      isVerified,
      verificationStatus: row.verification_status || (isVerified ? "verified" : "unverified"),
      kyc: {
        id: kycId || null,
        status: row.status || (isVerified ? "APPROVED" : (row.verification_status === "pending" ? "UNDER_REVIEW" : "NOT_STARTED")),
        currentStep: row.current_step || (isVerified ? 6 : (row.verification_status === "pending" ? 5 : 1)),
        rejectionReason: row.rejection_reason || null,
        actionNotes: row.action_notes || null,
        submittedAt: row.submitted_at || null,
        reviewedAt: row.reviewed_at || null,
        document: document || (row.kyc_document_type ? {
          document_type: row.kyc_document_type,
          document_last4: row.kyc_document_last4 || row.aadhaar_last4 || row.pan_last4,
          document_photo_url: row.kyc_document_photo
        } : null),
        selfie: selfie || null,
        consent: consent || null
      }
    });
  } catch (error: any) {
    console.error("[EKYC_ME_ERROR]", error?.message || error);
    return NextResponse.json({ error: "Failed to fetch KYC session" }, { status: 500 });
  }
}

