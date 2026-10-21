import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

function formatMaskedNumber(type: string | null, last4: string | null): string | null {
  if (!last4) return null;
  if (type === "Aadhaar Card") {
    return `XXXX-XXXX-${last4}`;
  }
  if (type === "PAN Card") {
    return `XXXXXX${last4}`;
  }
  return `XXXX-${last4}`;
}

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
        sp.id, 
        sp.name, 
        sp.email, 
        sp.phone, 
        COALESCE(doc.document_type, sp.kyc_document_type) AS kyc_document_type, 
        COALESCE(doc.document_last4, sp.kyc_document_last4) AS kyc_document_last4, 
        sp.aadhaar_last4, 
        sp.pan_last4, 
        COALESCE(doc.document_photo_url, sp.kyc_document_photo) AS kyc_document_photo, 
        COALESCE(pk.status, sp.kyc_status) AS kyc_status, 
        sp.is_verified, 
        sp.verification_status, 
        sp.rejection_reason, 
        sp.created_at, 
        sp.verified_at, 
        sp.verified_by,
        pk.id AS kyc_id,
        pk.action_notes,
        slf.selfie_url AS selfie_photo,
        slf.liveness_score
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
    `;
    const params: any[] = [];

    if (statusFilter && ["pending", "verified", "rejected", "unverified"].includes(statusFilter)) {
      if (statusFilter === "pending") {
        sql += " WHERE (sp.verification_status = 'pending' OR sp.verification_status = 'unverified' OR sp.verification_status IS NULL OR pk.status = 'UNDER_REVIEW' OR pk.status = 'SUBMITTED')";
      } else if (statusFilter === "verified") {
        sql += " WHERE (sp.verification_status = 'verified' OR pk.status = 'APPROVED')";
      } else if (statusFilter === "rejected") {
        sql += " WHERE (sp.verification_status = 'rejected' OR pk.status = 'REJECTED' OR pk.status = 'ACTION_REQUIRED')";
      } else {
        sql += " WHERE sp.verification_status = $1";
        params.push(statusFilter);
      }
    }

    sql += " ORDER BY sp.created_at DESC NULLS LAST, sp.id DESC";

    const result = await query(sql, params);

    const providers = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      kycDocumentType: row.kyc_document_type || null,
      kycDocumentNumber: formatMaskedNumber(row.kyc_document_type, row.kyc_document_last4),
      kycDocumentLast4: row.kyc_document_last4 || null,
      aadhaarLast4: row.aadhaar_last4 || null,
      aadhaarNumber: row.aadhaar_last4 ? `XXXX-XXXX-${row.aadhaar_last4}` : null,
      panLast4: row.pan_last4 || null,
      panNumber: row.pan_last4 ? `XXXXXX${row.pan_last4}` : null,
      kycDocumentPhoto: row.kyc_document_photo || null,
      selfiePhoto: row.selfie_photo || null,
      livenessScore: row.liveness_score ? Number(row.liveness_score) : null,
      kycId: row.kyc_id || null,
      actionNotes: row.action_notes || null,
      kycStatus: row.kyc_status || "Unverified",
      isVerified: Boolean(row.is_verified || row.kyc_status === "APPROVED"),
      verificationStatus: row.verification_status || "unverified",
      rejectionReason: row.rejection_reason || null,
      createdAt: row.created_at,
      verifiedAt: row.verified_at,
      verifiedBy: row.verified_by
    }));

    return NextResponse.json({
      success: true,
      count: providers.length,
      providers
    });
  } catch (error: any) {
    console.error("Admin list providers error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to list service providers." },
      { status: 500 }
    );
  }
}

