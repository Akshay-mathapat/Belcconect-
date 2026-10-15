/**
 * BelConnect - Automated & Lazy Booking Expiry Service
 * Detects pending bookings with no provider response after 10 minutes,
 * transitions them to 'Expired', dispatches notifications, and recommends
 * available alternative providers in Belagavi.
 */

import { query } from "@/lib/db";
import { sendPushToUser } from "@/lib/pushNotifications";
import crypto from "crypto";

/**
 * Loud startup check for CRON_SECRET.
 * Warns operators immediately if background cron endpoint security is unconfigured.
 */
export function checkCronSecretConfigured(): boolean {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) {
    console.warn(
      "\x1b[33m\x1b[1m[CRON WARNING] CRON_SECRET is missing or empty! Automated cron routes (/api/cron/*) will reject all requests until CRON_SECRET is configured in environment variables.\x1b[0m"
    );
    return false;
  }
  return true;
}

// Evaluate loud warning at startup / module load
checkCronSecretConfigured();

let lastLazyExpirySweepTime = 0;
export const LAZY_EXPIRY_THROTTLE_MS = 60 * 1000; // at most once per 60 seconds per server instance

export function resetLazyExpiryThrottle(): void {
  lastLazyExpirySweepTime = 0;
}

export interface SuggestedProvider {
  id: string;
  name: string;
  avatar: string | null;
  rating: number;
  phone: string | null;
  serviceTitle: string | null;
}

export interface ExpiredBookingResult {
  id: string;
  customerId: string;
  providerId: string | null;
  providerName: string | null;
  serviceName: string;
  category: string;
  createdAt: string;
  suggestedProviders: SuggestedProvider[];
}

export const EXPIRY_TRANSLATIONS: Record<string, { title: string; body: (service: string) => string }> = {
  en: {
    title: "Booking Expired",
    body: (service: string) => `Your request for ${service} expired because the service provider was unavailable to respond within 10 minutes. Alternative providers are available for you.`
  },
  kn: {
    title: "ಬುಕಿಂಗ್ ಅವಧಿ ಮುಗಿದಿದೆ",
    body: (service: string) => `ಸೇವಾ ಪೂರೈಕೆದಾರರು 10 ನಿಮಿಷಗಳಲ್ಲಿ ಪ್ರತಿಕ್ರಿಯಿಸದ ಕಾರಣ ${service} ಗಾಗಿ ನಿಮ್ಮ ವಿನಂತಿ ಅವಧಿ ಮುಗಿದಿದೆ. ನಿಮಗಾಗಿ ಪರ್ಯಾಯ ಪೂರೈಕೆದಾರರು ಲಭ್ಯವಿದ್ದಾರೆ.`
  },
  hi: {
    title: "बुकिंग समाप्त हो गई",
    body: (service: string) => `सेवा प्रदाता द्वारा 10 मिनट के भीतर जवाब न देने के कारण ${service} के लिए आपका अनुरोध समाप्त हो गया है। आपके लिए वैकल्पिक प्रदाता उपलब्ध हैं।`
  },
  mr: {
    title: "बुकिंग कालबाह्य झाली",
    body: (service: string) => `सेवा प्रदात्याने 10 मिनिटांत प्रतिसाद न दिल्याने ${service} ची तुमची विनंती कालबाह्य झाली आहे. तुमच्यासाठी पर्यायी प्रदाता उपलब्ध आहेत.`
  }
};

export function getExpiryNotificationText(lang: string = "en", serviceName: string = "Service") {
  const normalized = ["en", "kn", "hi", "mr"].includes(lang?.toLowerCase()) ? lang.toLowerCase() : "en";
  const item = EXPIRY_TRANSLATIONS[normalized] || EXPIRY_TRANSLATIONS.en;
  return {
    title: item.title,
    body: item.body(serviceName)
  };
}

/**
 * Retrieves up to 3 alternative verified, available service providers
 * offering services in the given category.
 */
export async function getSuggestedProviders(
  category: string,
  excludeProviderId?: string | null
): Promise<SuggestedProvider[]> {
  try {
    const params: unknown[] = [category];
    let excludeClause = "";
    if (excludeProviderId) {
      params.push(excludeProviderId);
      excludeClause = `AND sp.id != $2`;
    }

    const sql = `
      SELECT DISTINCT ON (sp.id)
        sp.id,
        sp.name,
        sp.avatar,
        COALESCE(sp.rating, 5.0)::float as rating,
        sp.phone,
        s.name as service_title
      FROM service_providers sp
      JOIN services s ON s.provider_id = sp.id
      WHERE LOWER(s.category) = LOWER($1)
        ${excludeClause}
        AND sp.verification_status = 'verified'
        AND sp.is_available = true
      ORDER BY sp.id, sp.rating DESC NULLS LAST
      LIMIT 3
    `;

    const res = await query(sql, params);
    return res.rows.map((r: any) => ({
      id: r.id,
      name: r.name || "Verified Professional",
      avatar: r.avatar || null,
      rating: typeof r.rating === "number" ? r.rating : 5.0,
      phone: r.phone || null,
      serviceTitle: r.service_title || null
    }));
  } catch (err) {
    console.error("[BookingExpiry] Error fetching alternative suggested providers:", err);
    return [];
  }
}

/**
 * Core atomic expiry execution:
 * Updates all bookings that are still 'Requested' 10 minutes after created_at to 'Expired'.
 * Sends customer notifications and attaches alternative provider suggestions.
 * Completely idempotent and safe for repeated or concurrent execution.
 */
export async function expireStaleBookings(): Promise<ExpiredBookingResult[]> {
  try {
    // 1. Atomically update stale bookings
    const expireRes = await query(`
      UPDATE bookings
      SET status = 'Expired', expired_at = NOW()
      WHERE status = 'Requested'
        AND created_at < NOW() - INTERVAL '10 minutes'
      RETURNING id, customer_id, provider_id, provider_name, service_name, category, created_at
    `);

    if (expireRes.rows.length === 0) {
      return [];
    }

    const results: ExpiredBookingResult[] = [];

    // 2. Dispatch notifications and prepare suggestions for each expired booking
    for (const row of expireRes.rows) {
      const bookingId = row.id;
      const customerId = row.customer_id;
      const serviceName = row.service_name || "Service";
      const category = row.category || "General";
      const providerId = row.provider_id;

      // Fetch up to 3 suggested alternative providers
      const suggestions = await getSuggestedProviders(category, providerId);

      results.push({
        id: bookingId,
        customerId,
        providerId,
        providerName: row.provider_name,
        serviceName,
        category,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        suggestedProviders: suggestions
      });

      if (!customerId) continue;

      // In-app Notification with 4-language support
      const notifId = `notif-${crypto.randomUUID()}`;
      const notifTitle = "Booking Expired";
      const notifBody = `Your request for ${serviceName} expired because the service provider was unavailable to respond within 10 minutes. Alternative providers are available for you.`;

      query(
        `INSERT INTO notifications (id, user_id, type, title, body, booking_id, is_read)
         VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
        [notifId, customerId, "booking_expired", notifTitle, notifBody, bookingId]
      ).catch((e) => console.error(`[BookingExpiry] Failed inserting notification for booking ${bookingId}:`, e));

      // Web Push Notification with multi-language payload (en, kn, hi, mr)
      sendPushToUser(customerId, {
        title: notifTitle,
        body: notifBody,
        data: {
          type: "booking_expired",
          bookingId,
          url: `/bookings/${bookingId}`,
          translations: {
            en: getExpiryNotificationText("en", serviceName),
            kn: getExpiryNotificationText("kn", serviceName),
            hi: getExpiryNotificationText("hi", serviceName),
            mr: getExpiryNotificationText("mr", serviceName)
          }
        }
      }).catch((e) => console.error(`[BookingExpiry] Push notification error for user ${customerId}:`, e));
    }

    return results;
  } catch (error) {
    console.error("[BookingExpiry] Critical error in expireStaleBookings:", error);
    return [];
  }
}

/**
 * Lazy throttled expiry sweep for server instances:
 * At most once per 60 seconds per server instance.
 */
export async function throttledExpireStaleBookings(now = Date.now()): Promise<ExpiredBookingResult[]> {
  if (now - lastLazyExpirySweepTime < LAZY_EXPIRY_THROTTLE_MS) {
    return [];
  }
  lastLazyExpirySweepTime = now;
  return expireStaleBookings();
}

/**
 * Lazy expiry check for a single booking.
 * Invoked on GET /api/bookings/[id] or PATCH /api/bookings/[id].
 */
export async function lazyExpireBookingById(bookingId: string): Promise<boolean> {
  try {
    const res = await query(
      `UPDATE bookings
       SET status = 'Expired', expired_at = NOW()
       WHERE id = $1
         AND status = 'Requested'
         AND created_at < NOW() - INTERVAL '10 minutes'
       RETURNING id, customer_id, service_name, category, provider_id`,
      [bookingId]
    );

    if (res.rows.length > 0) {
      const row = res.rows[0];
      const customerId = row.customer_id;
      if (customerId) {
        const notifId = `notif-${crypto.randomUUID()}`;
        const notifTitle = "Booking Expired";
        const notifBody = `Your request for ${row.service_name || "Service"} expired because the provider did not respond within 10 minutes.`;

        query(
          `INSERT INTO notifications (id, user_id, type, title, body, booking_id, is_read)
           VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
          [notifId, customerId, "booking_expired", notifTitle, notifBody, bookingId]
        ).catch(() => {});

        sendPushToUser(customerId, {
          title: notifTitle,
          body: notifBody,
          data: { type: "booking_expired", bookingId, url: `/bookings/${bookingId}` }
        }).catch(() => {});
      }
      return true;
    }
    return false;
  } catch (err) {
    console.error(`[BookingExpiry] Error in lazyExpireBookingById for ${bookingId}:`, err);
    return false;
  }
}

/**
 * Lazy expiry sweep for all pending bookings of a specific customer or provider.
 */
export async function lazyExpireUserBookings(userId: string): Promise<number> {
  try {
    const res = await query(
      `UPDATE bookings
       SET status = 'Expired', expired_at = NOW()
       WHERE (customer_id = $1 OR provider_id = $1)
         AND status = 'Requested'
         AND created_at < NOW() - INTERVAL '10 minutes'
       RETURNING id`,
      [userId]
    );
    return res.rowCount || 0;
  } catch {
    return 0;
  }
}
