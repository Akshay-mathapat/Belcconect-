import webpush from "web-push";
import { query } from "@/lib/db";

// Initialize VAPID credentials
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:support@belconnect.com";

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (e) {
    console.error("[Push Notifications] Failed to initialize web-push VAPID details:", e);
  }
} else {
  console.warn("[Push Notifications] VAPID keys missing. Web push notifications will be disabled.");
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, any>;
}

/**
 * Sends a Web Push Notification to all active push endpoints of a specific user.
 * Executes concurrently and automatically purges expired/invalid endpoints (404/410 Gone).
 */
export async function sendPushToUser(userId: string, payload: PushNotificationPayload): Promise<void> {
  if (!userId || !vapidPublicKey || !vapidPrivateKey) {
    return;
  }

  try {
    const subResult = await query("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1", [userId]);
    if (!subResult.rows || subResult.rows.length === 0) {
      return;
    }

    const payloadString = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || "/BelConnectLogo.png",
      data: payload.data || {}
    });

    const pushPromises = subResult.rows.map(async (row) => {
      const pushSubscription = {
        endpoint: row.endpoint,
        keys: {
          p256dh: row.p256dh,
          auth: row.auth
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, payloadString);
      } catch (err: any) {
        // If subscription is expired or unregistered, delete it from DB
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          console.log(`[Push Notification] Deleting expired push endpoint for user ${userId}:`, row.endpoint);
          await query("DELETE FROM push_subscriptions WHERE endpoint = $1", [row.endpoint]).catch(() => {});
        } else {
          console.error(`[Push Notification] Error sending to endpoint ${row.endpoint}:`, err?.message || err);
        }
      }
    });

    // Run non-blocking fire-and-forget push dispatches concurrently
    await Promise.allSettled(pushPromises);
  } catch (error) {
    console.error("[Push Notifications] Exception sending push to user:", error);
  }
}
