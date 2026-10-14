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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = getAuthenticatedUser(request);
    if (!authUser || authUser.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Administrator privileges required." },
        { status: 403 }
      );
    }

    const { id } = await params;

    // 1. Fetch provider details
    const providerRes = await query(
      `SELECT 
        id, 
        name, 
        email, 
        phone, 
        avatar, 
        is_available, 
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
      WHERE id = $1`,
      [id]
    );

    if (providerRes.rows.length === 0) {
      return NextResponse.json(
        { error: "Service provider not found." },
        { status: 404 }
      );
    }

    const row = providerRes.rows[0];

    // 2. Fetch provider's registered services
    const servicesRes = await query(
      "SELECT id, name, category, subcategory, description, is_available FROM services WHERE provider_id = $1 ORDER BY created_at DESC",
      [id]
    );

    // 3. Fetch audit logs for this provider
    let auditLogs: any[] = [];
    try {
      const logsRes = await query(
        "SELECT id, admin_id, action, details, created_at FROM admin_audit_logs WHERE target_id = $1 ORDER BY created_at DESC",
        [id]
      );
      auditLogs = logsRes.rows;
    } catch (_) {
      // Graceful fallback if table not ready
    }

    const maskedDocNumber = formatMaskedNumber(row.kyc_document_type, row.kyc_document_last4);
    const maskedAadhaar = row.aadhaar_last4 ? `XXXX-XXXX-${row.aadhaar_last4}` : null;
    const maskedPan = row.pan_last4 ? `XXXXXX${row.pan_last4}` : null;

    return NextResponse.json({
      success: true,
      provider: {
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        avatar: row.avatar,
        isAvailable: Boolean(row.is_available),
        kycDocumentType: row.kyc_document_type || null,
        kycDocumentNumber: maskedDocNumber,
        kycDocumentLast4: row.kyc_document_last4 || null,
        aadhaarLast4: row.aadhaar_last4 || null,
        aadhaarNumber: maskedAadhaar,
        panLast4: row.pan_last4 || null,
        panNumber: maskedPan,
        kycDocumentPhoto: row.kyc_document_photo || null,
        kycStatus: row.kyc_status || "Unverified",
        isVerified: Boolean(row.is_verified),
        verificationStatus: row.verification_status || "unverified",
        rejectionReason: row.rejection_reason || null,
        createdAt: row.created_at,
        verifiedAt: row.verified_at,
        verifiedBy: row.verified_by
      },
      services: servicesRes.rows,
      auditLogs
    });
  } catch (error: any) {
    console.error("Admin provider detail error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to retrieve provider details." },
      { status: 500 }
    );
  }
}

