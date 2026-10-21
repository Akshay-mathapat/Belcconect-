import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAuthenticatedUser } from "@/lib/jwt";
import { query, getClient, verifyPassword } from "@/lib/db";
import { checkIpRateLimit, checkUserRateLimit } from "@/lib/rateLimit";
import { normalizeIndianPhone } from "@/lib/phone";
import { hashOtpWithHmac, sendPasswordResetOtpEmail } from "@/lib/email";
import { performAccountDeletionTx } from "@/lib/accountDeletion";

export async function POST(request: Request) {
  try {
    // Rate limit: 20 requests per hour per IP
    const ipRate = await checkIpRateLimit(request, 20, 3600);
    if (!ipRate.isAllowed) {
      return NextResponse.json(
        { error: "Too many deletion requests. Please try again later." },
        { status: 429 }
      );
    }

    const authUser = getAuthenticatedUser(request);
    let body: any = {};
    try {
      body = await request.json();
    } catch (_) {}

    // Case 1: In-App Authenticated User Deletion
    if (authUser) {
      const userRate = await checkUserRateLimit(authUser.userId, 5, 3600);
      if (!userRate.isAllowed) {
        return NextResponse.json(
          { error: "Too many deletion attempts for this user. Please try again later." },
          { status: 429 }
        );
      }

      const userId = authUser.userId;
      const role = authUser.role; // "user" (customer), "provider", "job_provider"
      const reason = body.reason || "User requested in-app account deletion";

      // 1. Fetch user account details
      let userRecord: any = null;
      let userTable = "";

      if (role === "user" || role === "customer" as any) {
        userTable = "customers";
        const res = await query("SELECT id, email, phone, password_hash, google_id FROM public.customers WHERE id = $1", [userId]);
        userRecord = res.rows[0];
      } else if (role === "provider" || role === "service_provider" as any) {
        userTable = "service_providers";
        const res = await query("SELECT id, email, phone, password_hash, google_id FROM public.service_providers WHERE id = $1", [userId]);
        userRecord = res.rows[0];
      } else if (role === "job_provider") {
        userTable = "job_providers";
        const res = await query("SELECT id, email, phone, password_hash, google_id FROM public.job_providers WHERE id = $1", [userId]);
        userRecord = res.rows[0];
      }

      if (!userRecord) {
        return NextResponse.json({ error: "User account not found." }, { status: 404 });
      }

      // Handle requesting a verification OTP for Google / passwordless accounts
      if (body.action === "send_otp") {
        const cleanEmail = (userRecord.email || authUser.email || "").trim().toLowerCase();
        if (!cleanEmail) {
          return NextResponse.json(
            { error: "No email address found on file to send verification code." },
            { status: 400 }
          );
        }
        const rawOtp = crypto.randomInt(100000, 1000000).toString();
        const otpHash = hashOtpWithHmac(userId, rawOtp);
        await query(
          "UPDATE public.password_reset_otps SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL",
          [userId]
        );
        const otpId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await query(
          `INSERT INTO public.password_reset_otps (id, user_id, email, otp_hash, expires_at, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [otpId, userId, cleanEmail, otpHash, expiresAt]
        );
        try {
          await sendPasswordResetOtpEmail({ to: cleanEmail, otp: rawOtp, expiresInMinutes: 15 });
        } catch (mailErr: any) {
          console.warn("[DELETE_ACCOUNT_OTP_MAIL_WARN]", mailErr?.message || mailErr);
        }
        return NextResponse.json({
          success: true,
          message: `Verification code sent to ${cleanEmail}. Check your inbox.`
        });
      }

      // 2. Authentication Verification: Require current password or fresh OTP for Google-only accounts
      if (userRecord.password_hash) {
        const password = typeof body.password === "string" ? body.password : "";
        if (!password.trim()) {
          return NextResponse.json(
            { error: "Current password is required to delete your account." },
            { status: 400 }
          );
        }
        const isPasswordValid = await verifyPassword(password, userRecord.password_hash);
        if (!isPasswordValid) {
          return NextResponse.json(
            { error: "Incorrect password. Please enter your valid current password." },
            { status: 401 }
          );
        }
      } else if (userRecord.google_id) {
        // Google-authenticated user without a password: verify fresh OTP
        const otp = typeof body.otp === "string" ? body.otp.trim() : "";
        if (!otp) {
          return NextResponse.json(
            { 
              error: "A verification code is required to delete a Google-authenticated account. Please enter the OTP sent to your email.",
              requiresOtp: true,
              isGoogleAccount: true,
              email: userRecord.email
            },
            { status: 400 }
          );
        }

        const cleanEmail = (userRecord.email || authUser.email || "").trim().toLowerCase();
        const otpRes = await query(
          `SELECT id, user_id, otp_hash, expires_at, attempt_count, used_at, verified_at
           FROM public.password_reset_otps
           WHERE (user_id = $1 OR email = $2) AND used_at IS NULL
           ORDER BY created_at DESC
           LIMIT 1`,
          [userId, cleanEmail]
        );

        if (otpRes.rows.length === 0) {
          return NextResponse.json(
            { error: "Invalid or expired verification code. Please request a new code." },
            { status: 400 }
          );
        }

        const otpRecord = otpRes.rows[0];
        if (new Date(otpRecord.expires_at).getTime() < Date.now()) {
          await query("UPDATE public.password_reset_otps SET used_at = NOW() WHERE id = $1", [otpRecord.id]);
          return NextResponse.json(
            { error: "Verification code has expired. Please request a new code." },
            { status: 400 }
          );
        }

        if (otpRecord.attempt_count >= 5) {
          await query("UPDATE public.password_reset_otps SET used_at = NOW() WHERE id = $1", [otpRecord.id]);
          return NextResponse.json(
            { error: "Too many failed verification attempts. Please request a new code." },
            { status: 400 }
          );
        }

        const submittedHash = hashOtpWithHmac(otpRecord.user_id, otp);
        const isMatch =
          submittedHash.length === otpRecord.otp_hash.length &&
          crypto.timingSafeEqual(Buffer.from(submittedHash, "hex"), Buffer.from(otpRecord.otp_hash, "hex"));

        if (!isMatch) {
          const newAttemptCount = otpRecord.attempt_count + 1;
          await query("UPDATE public.password_reset_otps SET attempt_count = $1 WHERE id = $2", [
            newAttemptCount,
            otpRecord.id
          ]);
          return NextResponse.json(
            { error: "Invalid verification code." },
            { status: 400 }
          );
        }

        // Mark OTP as verified and used
        await query("UPDATE public.password_reset_otps SET verified_at = NOW(), used_at = NOW() WHERE id = $1", [
          otpRecord.id
        ]);
      } else {
        // Fallback: require confirmation password or explicit consent
        const password = typeof body.password === "string" ? body.password : "";
        const otp = typeof body.otp === "string" ? body.otp : "";
        if (!password.trim() && !otp.trim()) {
          return NextResponse.json(
            { error: "Security verification is required to delete your account." },
            { status: 400 }
          );
        }
      }

      // 3. Active bookings check
      if (role === "user" || role === "customer" as any) {
        const activeBookings = await query(
          "SELECT id, status FROM public.bookings WHERE customer_id = $1 AND status IN ('Pending', 'Accepted', 'OnTheWay', 'Arrived', 'Started') LIMIT 5",
          [userId]
        );
        if (activeBookings.rows.length > 0) {
          return NextResponse.json(
            {
              error: "Cannot delete account while you have active bookings in progress. Please complete or cancel them first.",
              activeCount: activeBookings.rows.length
            },
            { status: 400 }
          );
        }
      } else if (role === "provider" || role === "service_provider" as any) {
        const activeBookings = await query(
          "SELECT id, status FROM public.bookings WHERE provider_id = $1 AND status IN ('Accepted', 'OnTheWay', 'Arrived', 'Started') LIMIT 5",
          [userId]
        );
        if (activeBookings.rows.length > 0) {
          return NextResponse.json(
            {
              error: "Cannot delete account while you have active service bookings in progress. Please complete them first.",
              activeCount: activeBookings.rows.length
            },
            { status: 400 }
          );
        }
      }

      // 4. Run entire deletion within ONE database transaction (atomic, ROLLBACK on error)
      const client = await getClient();
      try {
        await client.query("BEGIN");

        const result = await performAccountDeletionTx(
          client,
          userId,
          role,
          userRecord.email || authUser.email,
          userRecord.phone || null,
          reason
        );

        await client.query("COMMIT");

        return NextResponse.json({
          success: true,
          message: result.message,
          requestId: result.requestId
        });
      } catch (txError: any) {
        await client.query("ROLLBACK");
        console.error("[Account Deletion Transaction Error]:", txError?.message || txError);
        throw txError;
      } finally {
        client.release();
      }
    }

    // Case 2: Public Web Portal Request (Play Store Compliance)
    const { email, phone, role, reason } = body;
    if (!email && !phone) {
      return NextResponse.json(
        { error: "Please provide either the registered email address or mobile number." },
        { status: 400 }
      );
    }

    const targetRole =
      role === "service_provider" || role === "provider"
        ? "service_provider"
        : role === "job_provider"
        ? "job_provider"
        : "customer";
    const normalizedPhone = phone ? normalizeIndianPhone(phone) : null;
    const normalizedEmail = email ? email.trim().toLowerCase() : null;

    let targetUserId: string | null = null;
    if (targetRole === "customer") {
      const res = await query(
        "SELECT id FROM public.customers WHERE (email = $1 AND $1 IS NOT NULL) OR (phone = $2 AND $2 IS NOT NULL) LIMIT 1",
        [normalizedEmail, normalizedPhone]
      );
      if (res.rows.length > 0) targetUserId = res.rows[0].id;
    } else if (targetRole === "service_provider") {
      const res = await query(
        "SELECT id FROM public.service_providers WHERE (email = $1 AND $1 IS NOT NULL) OR (phone = $2 AND $2 IS NOT NULL) LIMIT 1",
        [normalizedEmail, normalizedPhone]
      );
      if (res.rows.length > 0) targetUserId = res.rows[0].id;
    } else if (targetRole === "job_provider") {
      const res = await query(
        "SELECT id FROM public.job_providers WHERE (email = $1 AND $1 IS NOT NULL) OR (phone = $2 AND $2 IS NOT NULL) LIMIT 1",
        [normalizedEmail, normalizedPhone]
      );
      if (res.rows.length > 0) targetUserId = res.rows[0].id;
    }

    const requestId = `DEL-PUB-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

    const client = await getClient();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO public.account_deletion_requests 
         (id, user_id, role, email, phone, reason, status, requested_via, created_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'web_portal', NOW(), NULL)`,
        [requestId, targetUserId, targetRole, normalizedEmail, normalizedPhone, reason || "Play Store web portal deletion request"]
      );

      await client.query("COMMIT");
    } catch (txError: any) {
      await client.query("ROLLBACK");
      console.error("[Public Deletion Request Transaction Error]:", txError?.message || txError);
      throw txError;
    } finally {
      client.release();
    }

    return NextResponse.json({
      success: true,
      message:
        "Your account deletion request has been registered. All personal data, resumes, and identity files will be purged within 48 hours in compliance with Google Play Store data safety guidelines.",
      requestId
    });
  } catch (error: any) {
    console.error("[Account Deletion Error]:", error);
    return NextResponse.json(
      { error: "Failed to process account deletion request. Please contact support." },
      { status: 500 }
    );
  }
}

export { POST as DELETE };
