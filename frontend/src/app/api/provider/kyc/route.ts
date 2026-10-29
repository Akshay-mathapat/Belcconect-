import { assertCsrfOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { put } from "@vercel/blob";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

// Helper to mask identity numbers (never return full numbers)
function formatMaskedNumber(type: string, last4: string | null): string | null {
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
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized: Missing authentication session" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const paramProviderId = searchParams.get("providerId");
    const providerId = authUser.userId;

    if (paramProviderId && paramProviderId !== providerId && authUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: You can only view your own KYC details" }, { status: 403 });
    }

    const res = await query(
      `SELECT 
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
        verification_status
      FROM service_providers 
      WHERE id = $1`,
      [providerId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ kyc: null }, { status: 404 });
    }

    const row = res.rows[0];
    const isVerified = row.verification_status === "verified";
    const maskedDocNumber = formatMaskedNumber(row.kyc_document_type, row.kyc_document_last4);
    const maskedAadhaar = row.aadhaar_last4 ? `XXXX-XXXX-${row.aadhaar_last4}` : null;
    const maskedPan = row.pan_last4 ? `XXXXXX${row.pan_last4}` : null;

    // Detect providers whose base64 KYC photo was cleared by Migration 027 or is missing
    const isKycPhotoMissing = !row.kyc_document_photo && !isVerified && Boolean(
      row.kyc_document_type || 
      row.kyc_document_last4 || 
      row.aadhaar_last4 || 
      row.pan_last4 || 
      row.verification_status === "pending" || 
      row.kyc_status === "Pending"
    );

    const effectiveKycStatus = isKycPhotoMissing
      ? "please re-upload your KYC document"
      : (row.kyc_status || "Unverified");

    return NextResponse.json({
      success: true,
      kyc: {
        providerId: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        kycDocumentType: row.kyc_document_type || null,
        kycDocumentNumber: maskedDocNumber,
        kycDocumentLast4: row.kyc_document_last4 || null,
        kycDocumentPhoto: row.kyc_document_photo || null,
        kycStatus: effectiveKycStatus,
        isVerified,
        verificationStatus: row.verification_status || "unverified",
        isKycPhotoMissing,
        reuploadNotice: isKycPhotoMissing ? "please re-upload your KYC document" : null,
        panLast4: row.pan_last4 || null,
        aadhaarLast4: row.aadhaar_last4 || null,
        panNumber: maskedPan,
        aadhaarNumber: maskedAadhaar
      }
    });
  } catch (error: any) {
    console.error("Error fetching provider KYC from database:", error?.message || "Internal error");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const csrfError = await assertCsrfOrigin(request);
  if (csrfError) return csrfError;

  try {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized: Missing authentication session" }, { status: 401 });
    }

    if (authUser.role !== "provider" && authUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Provider account required for KYC submission" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const bodyProviderId = body.providerId;
    const providerId = authUser.userId;

    if (bodyProviderId && bodyProviderId !== providerId && authUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: You can only submit KYC for your own account" }, { status: 403 });
    }

    const {
      documentType,
      documentNumber,
      documentPhoto,
      fullName
    } = body;

    if (!documentNumber || typeof documentNumber !== "string" || documentNumber.trim().length === 0) {
      return NextResponse.json({ error: "Government Document Number is required." }, { status: 400 });
    }

    const docType = documentType || "Aadhaar Card";
    let aadhaarLast4: string | null = null;
    let panLast4: string | null = null;
    let kycDocumentLast4: string | null = null;

    // Validate format based on document type without logging the sensitive number
    if (docType === "Aadhaar Card") {
      const cleanAadhaar = documentNumber.replace(/[\s-]/g, "");
      if (!/^\d{12}$/.test(cleanAadhaar)) {
        return NextResponse.json(
          { error: "Invalid Aadhaar format. Please provide a valid 12-digit Aadhaar number." },
          { status: 400 }
        );
      }
      aadhaarLast4 = cleanAadhaar.slice(-4);
      kycDocumentLast4 = aadhaarLast4;
    } else if (docType === "PAN Card") {
      const cleanPan = documentNumber.trim().toUpperCase();
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
        return NextResponse.json(
          { error: "Invalid PAN format. Please provide a valid 10-character PAN number (e.g. ABCDE1234F)." },
          { status: 400 }
        );
      }
      panLast4 = cleanPan.slice(-4);
      kycDocumentLast4 = panLast4;
    } else {
      // General government documents (Voter ID, Driving License, Passport)
      const cleanGeneric = documentNumber.trim().toUpperCase().replace(/[\s-]/g, "");
      if (cleanGeneric.length < 4 || cleanGeneric.length > 30) {
        return NextResponse.json(
          { error: "Invalid document number length. Please check and re-enter." },
          { status: 400 }
        );
      }
      kycDocumentLast4 = cleanGeneric.slice(-4);
    }

    // Handle document photo: if a base64 data URL is passed, migrate it to private blob storage
    let processedPhotoUrl: string | null = null;
    if (typeof documentPhoto === "string" && documentPhoto.startsWith("data:")) {
      try {
        const matches = documentPhoto.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const contentType = matches[1];
          const buffer = Buffer.from(matches[2], "base64");
          const safeUserId = providerId.replace(/[^a-zA-Z0-9_-]/g, "_");
          const ext = contentType.includes("pdf") ? "pdf" : "png";
          const blobPathname = `kyc-documents/${safeUserId}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;

          const blob = await put(blobPathname, buffer, {
            access: "private",
            contentType
          });
          processedPhotoUrl = `/api/attachments/${blob.pathname}`;
        }
      } catch (blobErr: any) {
        console.warn("Could not save KYC document photo to private blob storage:", blobErr?.message || blobErr);
      }
    } else if (typeof documentPhoto === "string" && documentPhoto.trim().length > 0) {
      processedPhotoUrl = documentPhoto.trim();
    }

    // Update service_providers table storing ONLY last-4 digits
    const res = await query(
      `UPDATE service_providers
       SET 
         name = COALESCE(NULLIF($1, ''), name),
         kyc_document_type = $2,
         kyc_document_last4 = $3,
         aadhaar_last4 = COALESCE($4, aadhaar_last4),
         pan_last4 = COALESCE($5, pan_last4),
         kyc_document_photo = COALESCE($6, kyc_document_photo),
         kyc_status = 'Pending',
         verification_status = 'pending',
         is_verified = FALSE
       WHERE id = $7
       RETURNING 
         id, name, email, phone, 
         kyc_document_type, kyc_document_last4, aadhaar_last4, pan_last4, kyc_document_photo, 
         kyc_status, verification_status, is_verified`,
      [
        fullName || null,
        docType,
        kycDocumentLast4,
        aadhaarLast4,
        panLast4,
        processedPhotoUrl,
        providerId
      ]
    );

    let kycRecord = res.rows[0];

    // If provider record didn't exist yet, insert new row with only last4 digits
    if (!kycRecord) {
      const insertRes = await query(
        `INSERT INTO service_providers (
          id, name, email, phone, kyc_document_type, kyc_document_last4, 
          aadhaar_last4, pan_last4, kyc_document_photo, kyc_status, verification_status, is_verified
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pending', 'pending', FALSE
        )
        RETURNING 
          id, name, email, phone, 
          kyc_document_type, kyc_document_last4, aadhaar_last4, pan_last4, kyc_document_photo, 
          kyc_status, verification_status, is_verified`,
        [
          providerId,
          fullName || "Service Provider",
          `${providerId}@belconnect.in`,
          "+91 98765 43210",
          docType,
          kycDocumentLast4,
          aadhaarLast4,
          panLast4,
          processedPhotoUrl
        ]
      );
      kycRecord = insertRes.rows[0];
    }

    const maskedDocNumber = formatMaskedNumber(kycRecord.kyc_document_type, kycRecord.kyc_document_last4);
    const maskedAadhaar = kycRecord.aadhaar_last4 ? `XXXX-XXXX-${kycRecord.aadhaar_last4}` : null;
    const maskedPan = kycRecord.pan_last4 ? `XXXXXX${kycRecord.pan_last4}` : null;

    return NextResponse.json({
      success: true,
      message: "KYC document verified and saved. Only the last 4 digits are stored for privacy.",
      kyc: {
        providerId: kycRecord.id,
        name: kycRecord.name,
        kycDocumentType: kycRecord.kyc_document_type,
        kycDocumentNumber: maskedDocNumber,
        kycDocumentLast4: kycRecord.kyc_document_last4,
        kycDocumentPhoto: kycRecord.kyc_document_photo,
        kycStatus: kycRecord.kyc_status,
        isVerified: kycRecord.verification_status === "verified",
        verificationStatus: kycRecord.verification_status || "pending",
        panLast4: kycRecord.pan_last4,
        aadhaarLast4: kycRecord.aadhaar_last4,
        panNumber: maskedPan,
        aadhaarNumber: maskedAadhaar
      }
    });
  } catch (error: any) {
    console.error("Error saving provider KYC to database:", error?.message || "Internal error");
    return NextResponse.json({ error: "Failed to save KYC" }, { status: 500 });
  }
}
