import { assertCsrfOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/jwt";

export async function POST(request: Request) {
  const csrfError = await assertCsrfOrigin(request);
  if (csrfError) return csrfError;

  try {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized: Missing authentication session" }, { status: 401 });
    }

    if (authUser.role !== "provider" && authUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Provider account required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { consentText, documentType } = body;

    const providerId = authUser.userId;
    const rawIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";
    const ipAddress = rawIp.split(",")[0].trim().slice(0, 45);
    const userAgent = request.headers.get("user-agent") || "Unknown";

    // 1. Get or create provider_kyc record
    const kycRes = await query("SELECT id, status, current_step FROM provider_kyc WHERE provider_id = $1", [providerId]);
    let kycId: string;

    if (kycRes.rows.length === 0) {
      kycId = `kyc_${crypto.randomUUID()}`;
      await query(
        `INSERT INTO provider_kyc (id, provider_id, status, current_step, created_at, updated_at)
         VALUES ($1, $2, 'DRAFT', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [kycId, providerId]
      );
    } else {
      kycId = kycRes.rows[0].id;
      // If previous application was rejected or in draft, reset to DRAFT step 1
      if (kycRes.rows[0].status === "REJECTED" || kycRes.rows[0].status === "ACTION_REQUIRED" || kycRes.rows[0].status === "DRAFT") {
        await query(
          `UPDATE provider_kyc
           SET status = 'DRAFT', current_step = 1, rejection_reason = NULL, action_notes = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [kycId]
        );
      }
    }

    // 2. Record consent
    const consentId = `cst_${crypto.randomUUID()}`;
    const standardConsent = consentText || 
      "I explicitly consent to BelConnect collecting and verifying my government identity documents and live facial selfie solely for provider onboarding, trust & safety validation under India DPDP statutory provisions.";

    await query(
      `INSERT INTO provider_kyc_consents (id, kyc_id, consent_version, consent_text, ip_address, user_agent, consented_at)
       VALUES ($1, $2, 'v1.0', $3, $4, $5, CURRENT_TIMESTAMP)`,
      [consentId, kycId, standardConsent, ipAddress.slice(0, 45), userAgent]
    );

    // 3. Update service_provider record if documentType passed
    if (documentType) {
      await query(
        `UPDATE service_providers 
         SET kyc_document_type = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [documentType, providerId]
      );
    }

    return NextResponse.json({
      success: true,
      message: "DPDP consent recorded and eKYC session initiated.",
      kycId,
      currentStep: 1,
      status: "DRAFT"
    });
  } catch (error: any) {
    console.error("[EKYC_START_ERROR]", error?.message || error);
    return NextResponse.json({ error: error?.message || "Failed to initialize eKYC session" }, { status: 500 });
  }
}

