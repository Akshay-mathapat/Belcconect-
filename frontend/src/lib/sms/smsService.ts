import { query } from "@/lib/db";
import { getSmsProvider } from "./smsProvider";
import { normalizeIndianPhone, maskPhoneNumber } from "./phoneUtils";
import { BookingSmsDetails } from "./types";

const MAX_SMS_ATTEMPTS = 3;

export interface SmsDispatchResponse {
  success: boolean;
  status: "SENT" | "FAILED" | "SKIPPED_IDEMPOTENT" | "INVALID_PHONE" | "DISABLED";
  providerMessageId?: string;
  errorMessage?: string;
}

/**
 * Triggers a transactional SMS notification when a booking status changes to CONFIRMED / Accepted.
 * 
 * Rules:
 * 1. Phone number is ALWAYS fetched from the registered customer record in PostgreSQL (never untrusted frontend data).
 * 2. Strict idempotency: Never sends duplicate SMS for the same booking ID.
 * 3. Exponential backoff retry loop for transient gateway errors (up to 3 attempts).
 * 4. Logs all attempts securely to `notification_logs` with masked phone numbers.
 * 5. Non-blocking: DB failures or provider errors will not fail the booking process.
 */
export async function sendBookingConfirmationSms(
  bookingId: string,
  customerId: string,
  details: BookingSmsDetails
): Promise<SmsDispatchResponse> {
  const logPrefix = `[SMS_BOOKING_CONFIRMED] [Booking: ${bookingId}] [Customer: ${customerId}]`;

  try {
    console.log(`${logPrefix} Processing SMS notification request...`);

    // 1. Idempotency Check: Verify if a successful SMS was already sent for this booking
    const existingLog = await query(
      `SELECT id, status FROM notification_logs 
       WHERE booking_id = $1 AND type = 'BOOKING_CONFIRMED' AND channel = 'SMS' AND status = 'SENT'
       LIMIT 1`,
      [bookingId]
    );

    if (existingLog.rows && existingLog.rows.length > 0) {
      console.log(`${logPrefix} [IDEMPOTENT] Confirmation SMS already sent previously. Skipping duplicate dispatch.`);
      return { success: true, status: "SKIPPED_IDEMPOTENT" };
    }

    // 2. Fetch customer's registered phone number from PostgreSQL (Authoritative Source)
    const customerRes = await query(
      `SELECT id, name, phone FROM customers WHERE id = $1 LIMIT 1`,
      [customerId]
    );

    if (customerRes.rows.length === 0) {
      console.warn(`${logPrefix} Customer record not found in database.`);
      await logNotificationRecord(customerId, bookingId, "FAILED", "Customer record not found", 1);
      return { success: false, status: "FAILED", errorMessage: "Customer not found" };
    }

    const registeredPhone = customerRes.rows[0].phone;
    const normalizedPhone = normalizeIndianPhone(registeredPhone);

    if (!normalizedPhone) {
      const maskedRaw = maskPhoneNumber(registeredPhone);
      console.warn(`${logPrefix} Customer phone number (${maskedRaw}) is not a valid Indian mobile number.`);
      await logNotificationRecord(customerId, bookingId, "FAILED", `Invalid Indian mobile number: ${maskedRaw}`, 1);
      return { success: false, status: "INVALID_PHONE", errorMessage: "Invalid Indian mobile number" };
    }

    const maskedPhone = maskPhoneNumber(normalizedPhone);
    console.log(`${logPrefix} Destination mobile verified: ${maskedPhone}`);

    // 3. Formulate DLT-compliant concise SMS message
    const serviceName = details.serviceName || "Service";
    const dateVal = details.date || "scheduled date";
    const timeVal = details.time || "scheduled time";
    const providerName = details.providerName || "BelConnect Expert";

    const smsMessage = `BelConnect: Your booking #${bookingId} is confirmed. Service: ${serviceName}. Date: ${dateVal}, ${timeVal}. Provider: ${providerName}. Thank you for choosing BelConnect.`;

    // 4. Dispatch via Abstracted SMS Provider with Retry Mechanism
    const provider = getSmsProvider();
    console.log(`${logPrefix} Dispatching via provider: ${provider.name}`);

    let attempt = 0;
    let lastError = "";
    let providerMsgId = "";

    while (attempt < MAX_SMS_ATTEMPTS) {
      attempt++;
      console.log(`${logPrefix} Attempt ${attempt} of ${MAX_SMS_ATTEMPTS}...`);

      const result = await provider.sendSms({
        to: normalizedPhone,
        message: smsMessage,
        senderId: process.env.SMS_SENDER_ID || "BELCON",
        templateId: process.env.SMS_DLT_TEMPLATE_ID
      });

      if (result.success) {
        providerMsgId = result.providerMessageId || `msg-${Date.now()}`;
        console.log(`${logPrefix} [SMS_SENT] Successfully sent SMS to ${maskedPhone}. Provider ID: ${providerMsgId}`);

        await logNotificationRecord(
          customerId,
          bookingId,
          "SENT",
          null,
          attempt,
          providerMsgId
        );

        return {
          success: true,
          status: "SENT",
          providerMessageId: providerMsgId
        };
      }

      lastError = result.error || "SMS provider rejected request";
      console.warn(`${logPrefix} Attempt ${attempt} failed: ${lastError}`);

      // Exponential backoff before retry (1s, 2s, 4s...)
      if (attempt < MAX_SMS_ATTEMPTS) {
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    // 5. All retry attempts failed
    console.error(`${logPrefix} [SMS_FAILED] All ${MAX_SMS_ATTEMPTS} attempts failed to deliver SMS to ${maskedPhone}. Last error: ${lastError}`);
    await logNotificationRecord(
      customerId,
      bookingId,
      "FAILED",
      `Failed after ${MAX_SMS_ATTEMPTS} attempts: ${lastError}`,
      MAX_SMS_ATTEMPTS
    );

    return {
      success: false,
      status: "FAILED",
      errorMessage: lastError
    };

  } catch (error: any) {
    console.error(`${logPrefix} Exception during SMS dispatch execution:`, error);
    await logNotificationRecord(
      customerId,
      bookingId,
      "FAILED",
      error?.message || "Internal SMS exception",
      1
    ).catch(() => {});

    return {
      success: false,
      status: "FAILED",
      errorMessage: error?.message || "Internal SMS Exception"
    };
  }
}

/**
 * Helper to persist SMS delivery attempts into PostgreSQL `notification_logs` table.
 */
async function logNotificationRecord(
  userId: string,
  bookingId: string,
  status: "SENT" | "FAILED",
  errorMessage: string | null,
  attemptCount: number,
  providerMessageId?: string
): Promise<void> {
  try {
    const logId = `notif-log-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const sentAt = status === "SENT" ? new Date() : null;

    await query(
      `INSERT INTO notification_logs (
        id, user_id, booking_id, type, channel, status, provider_message_id, error_message, attempt_count, sent_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        logId,
        userId,
        bookingId,
        "BOOKING_CONFIRMED",
        "SMS",
        status,
        providerMessageId || null,
        errorMessage,
        attemptCount,
        sentAt
      ]
    );
  } catch (err: any) {
    console.error(`[Notification Log Error] Failed to write notification_logs entry for booking ${bookingId}:`, err?.message || err);
  }
}
