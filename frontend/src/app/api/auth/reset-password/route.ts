import { NextResponse } from "next/server";
import crypto from "crypto";
import { getClient, hashPassword } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { parseAndValidate, resetPasswordSchema } from "@/lib/validations";

export async function POST(request: Request) {
  // 1. Rate Limiting Check (Max 3 attempts per 5 minutes per IP)
  const rateLimit = checkRateLimit(request, 3, 5 * 60 * 1000);
  if (!rateLimit.isAllowed && rateLimit.response) {
    return rateLimit.response;
  }

  let dbClient;

  try {
    const validation = await parseAndValidate(request, resetPasswordSchema);
    if (validation.response) {
      return validation.response;
    }

    const { resetToken, newPassword } = validation.data;

    // Hash incoming reset token to compare against database store
    const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");

    dbClient = await getClient();
    await dbClient.query("BEGIN");

    // Lock and fetch reset session record
    const sessionRes = await dbClient.query(
      `SELECT id, user_id, user_table, expires_at, used_at
       FROM password_reset_sessions
       WHERE token_hash = $1 AND used_at IS NULL
       FOR UPDATE`,
      [tokenHash]
    );

    if (sessionRes.rows.length === 0) {
      await dbClient.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "Unable to reset password. Invalid or expired token." },
        { status: 400 }
      );
    }

    const session = sessionRes.rows[0];

    // Check expiry
    if (new Date(session.expires_at).getTime() < Date.now()) {
      await dbClient.query(
        "UPDATE password_reset_sessions SET used_at = NOW() WHERE id = $1",
        [session.id]
      );
      await dbClient.query("COMMIT");
      return NextResponse.json(
        { success: false, message: "Unable to reset password. Invalid or expired token." },
        { status: 400 }
      );
    }

    // Verify user table valid (customers, service_providers, job_providers)
    const validTables = ["customers", "service_providers", "job_providers"];
    if (!validTables.includes(session.user_table)) {
      await dbClient.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "Unable to reset password. Invalid target user table." },
        { status: 400 }
      );
    }

    // Hash new password using canonical Argon2id implementation
    const newPasswordHash = await hashPassword(newPassword);

    // Update user password in PostgreSQL
    await dbClient.query(
      `UPDATE ${session.user_table} SET password_hash = $1 WHERE id = $2`,
      [newPasswordHash, session.user_id]
    );

    // Mark reset session used
    await dbClient.query(
      "UPDATE password_reset_sessions SET used_at = NOW() WHERE id = $1",
      [session.id]
    );

    // Invalidate remaining OTPs and reset sessions for this user
    await dbClient.query(
      "UPDATE password_reset_otps SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL",
      [session.user_id]
    );
    await dbClient.query(
      "UPDATE password_reset_sessions SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL",
      [session.user_id]
    );

    await dbClient.query("COMMIT");

    console.log("[PASSWORD_RESET] Password successfully updated for user:", session.user_id);

    return NextResponse.json({
      success: true,
      message: "Password reset successfully."
    });
  } catch (error: any) {
    if (dbClient) {
      try {
        await dbClient.query("ROLLBACK");
      } catch (_) {}
    }
    console.error("Error in reset-password API:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  } finally {
    if (dbClient) {
      dbClient.release();
    }
  }
}
