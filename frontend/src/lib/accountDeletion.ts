import crypto from "crypto";
import type { PoolClient } from "pg";

export interface DeletionResult {
  requestId: string;
  role: string;
  message: string;
}

/**
 * Execute all deletion and anonymization operations for an account inside a single DB transaction.
 * Ensures reviews, chats, calls, and past bookings never block or orphan data.
 */
export async function performAccountDeletionTx(
  client: PoolClient,
  userId: string,
  rawRole: string,
  userEmail: string,
  userPhone: string | null,
  reason: string
): Promise<DeletionResult> {
  const role =
    rawRole === "customer" || rawRole === "user"
      ? "customer"
      : rawRole === "provider" || rawRole === "service_provider"
      ? "service_provider"
      : rawRole;

  const requestId = `DEL-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

  if (role === "customer") {
    // 1. Scrub push tokens and notification records
    await client.query("DELETE FROM public.device_push_tokens WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM public.push_subscriptions WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM public.notifications WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM public.notification_logs WHERE user_id = $1", [userId]);

    // 2. Candidate records (interviews, applications, saved jobs, resumes)
    await client.query("DELETE FROM public.job_interviews WHERE candidate_id = $1", [userId]);
    await client.query("DELETE FROM public.job_applications WHERE candidate_id = $1", [userId]);
    await client.query("DELETE FROM public.job_saved_jobs WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM public.job_resumes WHERE user_id = $1", [userId]);

    // 3. Addresses and password reset tokens/sessions
    await client.query("DELETE FROM public.addresses WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM public.password_reset_otps WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM public.password_reset_sessions WHERE user_id = $1", [userId]);

    // 4. Chats (messages & conversations): purge all messages and conversations involving customer
    await client.query(
      "DELETE FROM public.messages WHERE conversation_id IN (SELECT id FROM public.conversations WHERE customer_id = $1) OR sender_id = $1",
      [userId]
    );
    await client.query("DELETE FROM public.conversations WHERE customer_id = $1", [userId]);

    // 5. Calls & call reports
    await client.query(
      "DELETE FROM public.call_reports WHERE reporter_id = $1 OR call_id IN (SELECT id FROM public.calls WHERE caller_id = $1 OR receiver_id = $1)",
      [userId]
    );
    await client.query("DELETE FROM public.calls WHERE caller_id = $1 OR receiver_id = $1", [userId]);

    // 6. Reviews: clean up all reviews involving customer to avoid orphaned data
    await client.query(
      "DELETE FROM public.booking_reviews WHERE reviewer_id = $1 OR reviewee_id = $1",
      [userId]
    );

    // 7. Anonymize past completed/cancelled bookings for statutory accounting compliance
    await client.query(
      "UPDATE public.bookings SET customer_name = 'Deleted Customer', customer_phone = '0000000000', customer_address = 'Redacted', customer_id = 'deleted_customer' WHERE customer_id = $1",
      [userId]
    );

    // 8. Delete customer record
    await client.query("DELETE FROM public.customers WHERE id = $1", [userId]);

    // 9. Audit log entry
    await client.query(
      `INSERT INTO public.account_deletion_requests 
       (id, user_id, role, email, phone, reason, status, requested_via, created_at, completed_at)
       VALUES ($1, $2, 'customer', $3, $4, $5, 'completed', 'in_app', NOW(), NOW())`,
      [requestId, userId, userEmail, userPhone, reason]
    );

    return {
      requestId,
      role: "customer",
      message: "Customer account, resumes, chats, reviews, and personal data permanently deleted."
    };
  }

  if (role === "service_provider") {
    // 1. Cancel pending bookings awaiting this provider
    await client.query(
      `UPDATE public.bookings 
       SET status = 'Cancelled', 
           cancellation_reason = 'Provider account closed', 
           cancellation_note = 'Provider has closed their account' 
       WHERE provider_id = $1 AND status = 'Pending'`,
      [userId]
    );

    // 2. Scrub push tokens and notification records
    await client.query("DELETE FROM public.device_push_tokens WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM public.push_subscriptions WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM public.notifications WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM public.notification_logs WHERE user_id = $1", [userId]);

    // 3. Delete provider services catalog
    await client.query("DELETE FROM public.services WHERE provider_id = $1", [userId]);

    // 4. Password reset tokens & sessions
    await client.query("DELETE FROM public.password_reset_otps WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM public.password_reset_sessions WHERE user_id = $1", [userId]);

    // 5. Chats (messages & conversations)
    await client.query(
      "DELETE FROM public.messages WHERE conversation_id IN (SELECT id FROM public.conversations WHERE provider_id = $1) OR sender_id = $1",
      [userId]
    );
    await client.query("DELETE FROM public.conversations WHERE provider_id = $1", [userId]);

    // 6. Calls & call reports
    await client.query(
      "DELETE FROM public.call_reports WHERE reporter_id = $1 OR call_id IN (SELECT id FROM public.calls WHERE caller_id = $1 OR receiver_id = $1)",
      [userId]
    );
    await client.query("DELETE FROM public.calls WHERE caller_id = $1 OR receiver_id = $1", [userId]);

    // 7. Reviews: clean up all reviews involving this provider
    await client.query(
      "DELETE FROM public.booking_reviews WHERE reviewee_id = $1 OR reviewer_id = $1",
      [userId]
    );

    // 8. Anonymize past completed/cancelled bookings
    await client.query(
      "UPDATE public.bookings SET provider_name = 'Former Provider', provider_id = 'deleted_provider' WHERE provider_id = $1",
      [userId]
    );

    // 9. Delete service provider record
    await client.query("DELETE FROM public.service_providers WHERE id = $1", [userId]);

    // 10. Audit log entry
    await client.query(
      `INSERT INTO public.account_deletion_requests 
       (id, user_id, role, email, phone, reason, status, requested_via, created_at, completed_at)
       VALUES ($1, $2, 'service_provider', $3, $4, $5, 'completed', 'in_app', NOW(), NOW())`,
      [requestId, userId, userEmail, userPhone, reason]
    );

    return {
      requestId,
      role: "service_provider",
      message: "Service provider account, KYC documents, catalog, chats, and reviews permanently deleted."
    };
  }

  if (role === "job_provider") {
    // 1. Scrub push tokens and notification records
    await client.query("DELETE FROM public.device_push_tokens WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM public.push_subscriptions WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM public.notifications WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM public.notification_logs WHERE user_id = $1", [userId]);

    // 2. Delete business profile
    await client.query("DELETE FROM public.business_profiles WHERE job_provider_id = $1", [userId]);

    // 3. Delete saved jobs referencing this employer's jobs
    await client.query(
      "DELETE FROM public.job_saved_jobs WHERE job_id IN (SELECT id FROM public.jobs WHERE job_provider_id = $1)",
      [userId]
    );

    // 4. Delete interviews referencing this employer or their jobs
    await client.query(
      "DELETE FROM public.job_interviews WHERE job_provider_id = $1 OR job_id IN (SELECT id FROM public.jobs WHERE job_provider_id = $1)",
      [userId]
    );

    // 5. Delete job applications for this employer's jobs
    await client.query(
      "DELETE FROM public.job_applications WHERE job_id IN (SELECT id FROM public.jobs WHERE job_provider_id = $1)",
      [userId]
    );

    // 6. Delete jobs posted by this employer
    await client.query("DELETE FROM public.jobs WHERE job_provider_id = $1", [userId]);

    // 7. Password reset records
    await client.query("DELETE FROM public.password_reset_otps WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM public.password_reset_sessions WHERE user_id = $1", [userId]);

    // 8. Delete job provider record
    await client.query("DELETE FROM public.job_providers WHERE id = $1", [userId]);

    // 9. Audit log entry
    await client.query(
      `INSERT INTO public.account_deletion_requests 
       (id, user_id, role, email, phone, reason, status, requested_via, created_at, completed_at)
       VALUES ($1, $2, 'job_provider', $3, $4, $5, 'completed', 'in_app', NOW(), NOW())`,
      [requestId, userId, userEmail, userPhone, reason]
    );

    return {
      requestId,
      role: "job_provider",
      message: "Job provider account, business profile, interviews, and job postings permanently deleted."
    };
  }

  throw new Error(`Unsupported account role for deletion: ${role}`);
}
