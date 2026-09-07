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
        kyc_document_number, 
        kyc_document_photo, 
        kyc_status, 
        is_verified, 
        pan_number, 
        aadhaar_number
      FROM service_providers 
      WHERE id = $1`,
      [providerId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ kyc: null }, { status: 404 });
    }

    const row = res.rows[0];
    return NextResponse.json({
      success: true,
      kyc: {
        providerId: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        kycDocumentType: row.kyc_document_type || null,
        kycDocumentNumber: row.kyc_document_number || null,
        kycDocumentPhoto: row.kyc_document_photo || null,
        kycStatus: row.kyc_status || "Unverified",
        isVerified: Boolean(row.is_verified),
        panNumber: row.pan_number || null,
        aadhaarNumber: row.aadhaar_number || null
      }
    });
  } catch (error: any) {
    console.error("Error fetching provider KYC from database:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authUser = getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized: Missing authentication session" }, { status: 401 });
    }

    if (authUser.role !== "provider" && authUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Provider account required for KYC submission" }, { status: 403 });
    }

    const body = await request.json();
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

    if (!documentNumber) {
      return NextResponse.json({ error: "Government Document Number is required." }, { status: 400 });
    }

    // Upsert or Update service_providers KYC details
    const panNumber = documentType === "PAN Card" ? documentNumber : null;
    const aadhaarNumber = documentType === "Aadhaar Card" ? documentNumber : null;

    const res = await query(
      `UPDATE service_providers
       SET 
         name = COALESCE(NULLIF($1, ''), name),
         kyc_document_type = $2,
         kyc_document_number = $3,
         kyc_document_photo = COALESCE(NULLIF($4, ''), kyc_document_photo),
         kyc_status = 'Pending',
         is_verified = FALSE,
         pan_number = COALESCE($5, pan_number),
         aadhaar_number = COALESCE($6, aadhaar_number)
       WHERE id = $7
       RETURNING 
         id, name, email, phone, 
         kyc_document_type, kyc_document_number, kyc_document_photo, 
         kyc_status, is_verified, pan_number, aadhaar_number`,
      [
        fullName || null,
        documentType || "Aadhaar Card",
        documentNumber,
        documentPhoto || null,
        panNumber,
        aadhaarNumber,
        providerId
      ]
    );

    let kycRecord = res.rows[0];

    // If provider row didn't exist yet, insert a new record
    if (!kycRecord) {
      const insertRes = await query(
        `INSERT INTO service_providers (
          id, name, email, phone, kyc_document_type, kyc_document_number, 
          kyc_document_photo, kyc_status, is_verified, pan_number, aadhaar_number
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 'Pending', FALSE, $8, $9
        )
        RETURNING 
          id, name, email, phone, 
          kyc_document_type, kyc_document_number, kyc_document_photo, 
          kyc_status, is_verified, pan_number, aadhaar_number`,
        [
          providerId,
          fullName || "Service Provider",
          `${providerId}@belconnect.in`,
          "+91 98765 43210",
          documentType || "Aadhaar Card",
          documentNumber,
          documentPhoto || null,
          panNumber,
          aadhaarNumber
        ]
      );
      kycRecord = insertRes.rows[0];
    }

    return NextResponse.json({
      success: true,
      message: "KYC document saved successfully to PostgreSQL database",
      kyc: {
        providerId: kycRecord.id,
        name: kycRecord.name,
        kycDocumentType: kycRecord.kyc_document_type,
        kycDocumentNumber: kycRecord.kyc_document_number,
        kycDocumentPhoto: kycRecord.kyc_document_photo,
        kycStatus: kycRecord.kyc_status,
        isVerified: Boolean(kycRecord.is_verified),
        panNumber: kycRecord.pan_number,
        aadhaarNumber: kycRecord.aadhaar_number
      }
    });
  } catch (error: any) {
    console.error("Error saving provider KYC to database:", error);
    return NextResponse.json({ error: error.message || "Failed to save KYC to database" }, { status: 500 });
  }
}
