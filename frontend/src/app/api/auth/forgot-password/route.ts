import { NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { parseAndValidate, forgotPasswordSchema } from "@/lib/validations";
import { sendPasswordResetOtpEmail, hashOtpWithHmac } from "@/lib/email";

export async function POST(request: Request) {
  console.log("[PASSWORD_RESET] request-received");

  // 1. Rate Limiting Check (Max 5 requests per 15 minutes per IP)
  const rateLimit = checkRateLimit(request, 5, 15 * 60 * 1000);
  if (!rateLimit.isAllowed && rateLimit.response) {
    return rateLimit.response;
  }

  const genericResponse = NextResponse.json({
    success: true,
    message: "If an account exists for this email, a verification code has been sent."
  });

  try {
    const validation = await parseAndValidate(request, forgotPasswordSchema);
    if (validation.response) {
      return validation.response;
    }

    const { email } = validation.data;
    const cleanEmail = email.trim().toLowerCase();

    // Find user across customers, service_providers, job_providers by EXACT normalized email
    let foundUser: { id: string; email: string; user_table: string } | null = null;

    const custRes = await query("SELECT id, email FROM customers WHERE email = $1 LIMIT 1", [cleanEmail]);
    if (custRes.rows.length > 0) {
      foundUser = { id: custRes.rows[0].id, email: custRes.rows[0].email, user_table: "customers" };
    } else {
      const provRes = await query("SELECT id, email FROM service_providers WHERE email = $1 LIMIT 1", [cleanEmail]);
      if (provRes.rows.length > 0) {
        foundUser = { id: provRes.rows[0].id, email: provRes.rows[0].email, user_table: "service_providers" };
      } else {
        const empRes = await query("SELECT id, email FROM job_providers WHERE email = $1 LIMIT 1", [cleanEmail]);
        if (empRes.rows.length > 0) {
          foundUser = { id: empRes.rows[0].id, email: empRes.rows[0].email, user_table: "job_providers" };
        }
      }
    }

    // Account enumeration protection: Return generic success even if user not found (do not send mail)
    if (!foundUser) {
      return genericResponse;
    }

    // 1. Generate cryptographically secure 6-digit OTP using Node crypto
    const rawOtp = crypto.randomInt(100000, 1000000).toString();

    // 2. Hash OTP using HMAC SHA-256 with server secret
    const otpHash = hashOtpWithHmac(foundUser.id, rawOtp);

    // 3. Invalidate any existing active OTPs for this user
    await query(
      "UPDATE password_reset_otps SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL",
      [foundUser.id]
    );

    // 4. Insert new OTP record in PostgreSQL
    const otpId = `otp-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const ttlMinutes = parseInt(process.env.PASSWORD_RESET_OTP_TTL_MINUTES || "10", 10);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await query(
      `INSERT INTO password_reset_otps 
        (id, user_id, user_table, email, otp_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [otpId, foundUser.id, foundUser.user_table, foundUser.email, otpHash, expiresAt]
    );

    console.log(`[PASSWORD_RESET] otp-record-created userId=${foundUser.id}`);

    // 5. Send raw OTP via Brevo SMTP to EXACT registered user email
    const emailResult = await sendPasswordResetOtpEmail({
      to: foundUser.email,
      otp: rawOtp,
      expiresInMinutes: ttlMinutes,
    });

    if (!emailResult.success) {
      console.error(`[PASSWORD_RESET_EMAIL_FAILED] Could not deliver email to registered user: ${emailResult.error}`);
      // Clean up newly created OTP record so user is not left with an un-received active OTP
      await query("DELETE FROM password_reset_otps WHERE id = $1", [otpId]);
    }

    return genericResponse;
  } catch (error: any) {
    console.error("Error in forgot-password API:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
