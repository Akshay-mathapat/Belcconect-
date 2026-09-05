import { NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { parseAndValidate, verifyResetOtpSchema } from "@/lib/validations";
import { hashOtpWithHmac } from "@/lib/email";

export async function POST(request: Request) {
  // 1. Rate Limiting Check (Max 5 verification attempts per 5 minutes per IP)
  const rateLimit = checkRateLimit(request, 5, 5 * 60 * 1000);
  if (!rateLimit.isAllowed && rateLimit.response) {
    return rateLimit.response;
  }

  try {
    const validation = await parseAndValidate(request, verifyResetOtpSchema);
    if (validation.response) {
      return validation.response;
    }

    const { email, otp } = validation.data;
    const cleanEmail = email.trim().toLowerCase();

    // Fetch latest active OTP record for this email
    const otpRes = await query(
      `SELECT id, user_id, user_table, otp_hash, expires_at, attempt_count, used_at, verified_at
       FROM password_reset_otps
       WHERE email = $1 AND used_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [cleanEmail]
    );

    if (otpRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired verification code." },
        { status: 400 }
      );
    }

    const otpRecord = otpRes.rows[0];

    // Check expiry
    if (new Date(otpRecord.expires_at).getTime() < Date.now()) {
      await query("UPDATE password_reset_otps SET used_at = NOW() WHERE id = $1", [otpRecord.id]);
      return NextResponse.json(
        { success: false, message: "Invalid or expired verification code." },
        { status: 400 }
      );
    }

    // Check attempt count (max 5 attempts)
    if (otpRecord.attempt_count >= 5) {
      await query("UPDATE password_reset_otps SET used_at = NOW() WHERE id = $1", [otpRecord.id]);
      return NextResponse.json(
        { success: false, message: "Invalid or expired verification code." },
        { status: 400 }
      );
    }

    // Compute HMAC hash from entered OTP and user ID
    const submittedHash = hashOtpWithHmac(otpRecord.user_id, otp);
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(submittedHash, "hex"),
      Buffer.from(otpRecord.otp_hash, "hex")
    );

    if (!isMatch) {
      const newAttemptCount = otpRecord.attempt_count + 1;
      if (newAttemptCount >= 5) {
        await query("UPDATE password_reset_otps SET attempt_count = $1, used_at = NOW() WHERE id = $2", [newAttemptCount, otpRecord.id]);
      } else {
        await query("UPDATE password_reset_otps SET attempt_count = $1 WHERE id = $2", [newAttemptCount, otpRecord.id]);
      }

      return NextResponse.json(
        { success: false, message: "Invalid or expired verification code." },
        { status: 400 }
      );
    }

    // OTP match verified! Mark OTP record as verified and used
    await query("UPDATE password_reset_otps SET verified_at = NOW(), used_at = NOW() WHERE id = $1", [otpRecord.id]);
    console.log(`[PASSWORD_RESET] verify-success userId=${otpRecord.user_id}`);

    // Invalidate existing reset sessions for this user
    await query(
      "UPDATE password_reset_sessions SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL",
      [otpRecord.user_id]
    );

    // Generate cryptographically secure random opaque reset token
    const rawResetToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawResetToken).digest("hex");

    const sessionId = `sess-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const sessionExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

    await query(
      `INSERT INTO password_reset_sessions
        (id, user_id, user_table, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, otpRecord.user_id, otpRecord.user_table, tokenHash, sessionExpiresAt]
    );

    return NextResponse.json({
      success: true,
      resetToken: rawResetToken
    });
  } catch (error: any) {
    console.error("Error in verify-reset-otp API:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
