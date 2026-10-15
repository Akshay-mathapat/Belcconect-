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
        id, 
        name, 
        email, 
        phone, 
        kyc_document_type, 
        kyc_document_last4, 
        aadhaar_last4, 
        pan_last4, 
        kyc_document_photo, 
        kyc_status, 
        is_verified, 
        verification_status, 
        rejection_reason, 
        created_at, 
        verified_at, 
        verified_by
      FROM service_providers
    `;
    const params: any[] = [];

    if (statusFilter && ["pending", "verified", "rejected", "unverified"].includes(statusFilter)) {
      if (statusFilter === "pending") {
        sql += " WHERE (verification_status = 'pending' OR verification_status = 'unverified' OR verification_status IS NULL)";
      } else {
        sql += " WHERE verification_status = $1";
        params.push(statusFilter);
      }
    }

    sql += " ORDER BY created_at DESC NULLS LAST, id DESC";

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
      kycStatus: row.kyc_status || "Unverified",
      isVerified: Boolean(row.is_verified),
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

