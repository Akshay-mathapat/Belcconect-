import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAuthenticatedUser } from "@/lib/jwt";
import { query } from "@/lib/db";
import { checkIpRateLimit, checkUserRateLimit } from "@/lib/rateLimit";
import { normalizeIndianPhoneNumber, isValidIndianPhone } from "@/lib/phoneUtils";

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
      const requestId = `DEL-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

      if (role === "user" || role === "customer" as any) {
        // Check active bookings
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

        // Fetch customer info for audit log
        const custRes = await query("SELECT email, phone FROM public.customers WHERE id = $1", [userId]);
        const cust = custRes.rows[0] || {};

        // 1. Scrub/Delete push tokens and notifications
        await query("DELETE FROM public.device_push_tokens WHERE user_id = $1", [userId]);
        await query("DELETE FROM public.push_subscriptions WHERE user_id = $1", [userId]);
        await query("DELETE FROM public.notifications WHERE user_id = $1", [userId]);
        await query("DELETE FROM public.notification_logs WHERE user_id = $1", [userId]);

        // 2. Delete resumes & job applications
        await query("DELETE FROM public.job_resumes WHERE user_id = $1", [userId]);
        await query("DELETE FROM public.job_applications WHERE applicant_id = $1", [userId]);
        await query("DELETE FROM public.job_saved_jobs WHERE user_id = $1", [userId]);

        // 3. Delete addresses & password reset otps
        await query("DELETE FROM public.addresses WHERE user_id = $1", [userId]);
        await query("DELETE FROM public.password_reset_otps WHERE user_id = $1", [userId]);
        await query("DELETE FROM public.password_reset_sessions WHERE user_id = $1", [userId]);

        // 4. Anonymize completed transaction records (retained for statutory accounting compliance)
        await query(
          "UPDATE public.bookings SET customer_name = 'Deleted Customer', customer_phone = '0000000000', customer_address = 'Redacted' WHERE customer_id = $1",
          [userId]
        );

        // 5. Delete customer row
        await query("DELETE FROM public.customers WHERE id = $1", [userId]);

        // 6. Log audit entry
        await query(
          `INSERT INTO public.account_deletion_requests 
           (id, user_id, role, email, phone, reason, status, requested_via, created_at, completed_at)
           VALUES ($1, $2, 'customer', $3, $4, $5, 'completed', 'in_app', NOW(), NOW())`,
          [requestId, userId, cust.email || authUser.email, cust.phone || null, reason]
        );

        return NextResponse.json({
          success: true,
          message: "Customer account, resumes, and personal data permanently deleted.",
          requestId
        });
      }

      if (role === "provider") {
        // Check active jobs in progress
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

        // Fetch provider info for audit log
        const provRes = await query("SELECT email, phone FROM public.service_providers WHERE id = $1", [userId]);
        const prov = provRes.rows[0] || {};

        // 1. Scrub/Delete push tokens and notifications
        await query("DELETE FROM public.device_push_tokens WHERE user_id = $1", [userId]);
        await query("DELETE FROM public.push_subscriptions WHERE user_id = $1", [userId]);
        await query("DELETE FROM public.notifications WHERE user_id = $1", [userId]);
        await query("DELETE FROM public.notification_logs WHERE user_id = $1", [userId]);

        // 2. Delete provider services catalog
        await query("DELETE FROM public.services WHERE provider_id = $1", [userId]);

        // 3. Delete password reset otps
        await query("DELETE FROM public.password_reset_otps WHERE user_id = $1", [userId]);
        await query("DELETE FROM public.password_reset_sessions WHERE user_id = $1", [userId]);

        // 4. Anonymize completed transaction records
        await query(
          "UPDATE public.bookings SET provider_name = 'Former Provider' WHERE provider_id = $1",
          [userId]
        );

        // 5. Delete service provider row (removes KYC photos, phone, email, bio, name)
        await query("DELETE FROM public.service_providers WHERE id = $1", [userId]);

        // 6. Log audit entry
        await query(
          `INSERT INTO public.account_deletion_requests 
           (id, user_id, role, email, phone, reason, status, requested_via, created_at, completed_at)
           VALUES ($1, $2, 'service_provider', $3, $4, $5, 'completed', 'in_app', NOW(), NOW())`,
          [requestId, userId, prov.email || authUser.email, prov.phone || null, reason]
        );

        return NextResponse.json({
          success: true,
          message: "Service provider account, KYC documents, and catalog permanently deleted.",
          requestId
        });
      }

      if (role === "job_provider") {
        // Fetch job provider info for audit log
        const jpRes = await query("SELECT email, phone FROM public.job_providers WHERE id = $1", [userId]);
        const jp = jpRes.rows[0] || {};

        // 1. Scrub/Delete push tokens and notifications
        await query("DELETE FROM public.device_push_tokens WHERE user_id = $1", [userId]);
        await query("DELETE FROM public.push_subscriptions WHERE user_id = $1", [userId]);
        await query("DELETE FROM public.notifications WHERE user_id = $1", [userId]);
        await query("DELETE FROM public.notification_logs WHERE user_id = $1", [userId]);

        // 2. Delete business profile
        await query("DELETE FROM public.business_profiles WHERE user_id = $1", [userId]);

        // 3. Delete job applications & jobs
        await query("DELETE FROM public.job_applications WHERE job_id IN (SELECT id FROM public.jobs WHERE provider_id = $1)", [userId]);
        await query("DELETE FROM public.jobs WHERE provider_id = $1", [userId]);

        // 4. Delete password reset otps
        await query("DELETE FROM public.password_reset_otps WHERE user_id = $1", [userId]);
        await query("DELETE FROM public.password_reset_sessions WHERE user_id = $1", [userId]);

        // 5. Delete job provider row
        await query("DELETE FROM public.job_providers WHERE id = $1", [userId]);

        // 6. Log audit entry
        await query(
          `INSERT INTO public.account_deletion_requests 
           (id, user_id, role, email, phone, reason, status, requested_via, created_at, completed_at)
           VALUES ($1, $2, 'job_provider', $3, $4, $5, 'completed', 'in_app', NOW(), NOW())`,
          [requestId, userId, jp.email || authUser.email, jp.phone || null, reason]
        );

        return NextResponse.json({
          success: true,
          message: "Job provider account, business profile, and job postings permanently deleted.",
          requestId
        });
      }

      return NextResponse.json({ error: "Unsupported account role for deletion" }, { status: 400 });
    }

    // Case 2: Public Web Portal Request (Play Store Compliance)
    const { email, phone, role, reason } = body;
    if (!email && !phone) {
      return NextResponse.json(
        { error: "Please provide either the registered email address or mobile number." },
        { status: 400 }
      );
    }

    const targetRole = role === "service_provider" ? "service_provider" : role === "job_provider" ? "job_provider" : "customer";
    const normalizedPhone = phone ? normalizeIndianPhoneNumber(phone) : null;
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
    await query(
      `INSERT INTO public.account_deletion_requests 
       (id, user_id, role, email, phone, reason, status, requested_via, created_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'web_portal', NOW(), NULL)`,
      [requestId, targetUserId, targetRole, normalizedEmail, normalizedPhone, reason || "Play Store web portal deletion request"]
    );

    return NextResponse.json({
      success: true,
      message: "Your account deletion request has been registered. All personal data, resumes, and identity files will be purged within 48 hours in compliance with Google Play Store data safety guidelines.",
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

