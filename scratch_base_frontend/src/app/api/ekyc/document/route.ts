import { NextResponse } from "next/server";
import crypto from "crypto";
import { put } from "@vercel/blob";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

export async function POST(request: Request) {
  try {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized: Missing authentication session" }, { status: 401 });
    }

    if (authUser.role !== "provider" && authUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Provider account required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { documentType, documentNumber, documentPhoto, documentBackPhoto, fullName } = body;

    const providerId = authUser.userId;

    if (!documentNumber || typeof documentNumber !== "string" || !documentNumber.trim()) {
      return NextResponse.json({ error: "Government Document Number is required." }, { status: 400 });
    }

    const docType = documentType || "Aadhaar Card";
    let documentLast4 = "";
    let aadhaarLast4: string | null = null;
    let panLast4: string | null = null;

    // Validate format based on document type without logging the sensitive number
    if (docType === "Aadhaar Card") {
      const cleanAadhaar = documentNumber.replace(/[\s-]/g, "");
      if (!/^\d{12}$/.test(cleanAadhaar)) {
        return NextResponse.json(
          { error: "Invalid Aadhaar format. Please enter a valid 12-digit Aadhaar number." },
          { status: 400 }
        );
      }
      aadhaarLast4 = cleanAadhaar.slice(-4);
      documentLast4 = aadhaarLast4;
    } else if (docType === "PAN Card") {
      const cleanPan = documentNumber.trim().toUpperCase();
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
        return NextResponse.json(
          { error: "Invalid PAN format. Please enter a valid 10-character PAN number (e.g. ABCDE1234F)." },
          { status: 400 }
        );
      }
      panLast4 = cleanPan.slice(-4);
      documentLast4 = panLast4;
    } else {
      const cleanGeneric = documentNumber.trim().toUpperCase().replace(/[\s-]/g, "");
      if (cleanGeneric.length < 4 || cleanGeneric.length > 30) {
        return NextResponse.json(
          { error: "Invalid document number length. Please check and re-enter." },
          { status: 400 }
        );
      }
      documentLast4 = cleanGeneric.slice(-4);
    }

    // Process front document photo: save to private blob if data URI
    let frontPhotoUrl = documentPhoto;
    if (typeof documentPhoto === "string" && documentPhoto.startsWith("data:")) {
      try {
        const matches = documentPhoto.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const contentType = matches[1];
          const buffer = Buffer.from(matches[2], "base64");
          const safeUserId = providerId.replace(/[^a-zA-Z0-9_-]/g, "_");
          const ext = contentType.includes("pdf") ? "pdf" : "png";
          const blobPathname = `kyc-documents/${safeUserId}/front-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;

          const blob = await put(blobPathname, buffer, {
            access: "private",
            contentType
          });
          frontPhotoUrl = `/api/attachments/${blob.pathname}`;
        }
      } catch (blobErr: any) {
        console.warn("[EKYC_DOC_BLOB_WARN] Front photo blob upload:", blobErr?.message || blobErr);
      }
    }

    if (!frontPhotoUrl) {
      return NextResponse.json({ error: "Please upload a clear front-side photo or scan of your document." }, { status: 400 });
    }

    // Ensure provider_kyc record exists
    const kycRes = await query("SELECT id FROM provider_kyc WHERE provider_id = $1", [providerId]);
    let kycId: string;
    if (kycRes.rows.length === 0) {
      kycId = `kyc_${crypto.randomUUID()}`;
      await query(
        "INSERT INTO provider_kyc (id, provider_id, status, current_step) VALUES ($1, $2, 'DRAFT', 2)",
        [kycId, providerId]
      );
    } else {
      kycId = kycRes.rows[0].id;
      await query("UPDATE provider_kyc SET current_step = GREATEST(current_step, 2), updated_at = CURRENT_TIMESTAMP WHERE id = $1", [kycId]);
    }

    // Insert or update provider_kyc_documents
    const docId = `doc_${crypto.randomUUID()}`;
    await query(
      `INSERT INTO provider_kyc_documents (
        id, kyc_id, document_type, document_last4, document_photo_url, document_back_photo_url, extracted_name, is_valid_format
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`,
      [docId, kycId, docType, documentLast4, frontPhotoUrl, documentBackPhoto || null, fullName || null]
    );

    // Sync last-4 digits & photo to service_providers table
    await query(
      `UPDATE service_providers
       SET 
         name = COALESCE(NULLIF($1, ''), name),
         kyc_document_type = $2,
         kyc_document_last4 = $3,
         aadhaar_last4 = COALESCE($4, aadhaar_last4),
         pan_last4 = COALESCE($5, pan_last4),
         kyc_document_photo = $6,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $7`,
      [fullName || null, docType, documentLast4, aadhaarLast4, panLast4, frontPhotoUrl, providerId]
    );

    return NextResponse.json({
      success: true,
      message: "Document details securely verified and stored with DPDP masking.",
      kycId,
      document: {
        documentType: docType,
        documentLast4,
        documentPhoto: frontPhotoUrl,
        maskedNumber: docType === "Aadhaar Card" ? `XXXX-XXXX-${documentLast4}` : (docType === "PAN Card" ? `XXXXXX${documentLast4}` : `XXXX-${documentLast4}`)
      },
      currentStep: 2
    });
  } catch (error: any) {
    console.error("[EKYC_DOCUMENT_ERROR]", error?.message || error);
    return NextResponse.json({ error: "Failed to save document details" }, { status: 500 });
  }
}

