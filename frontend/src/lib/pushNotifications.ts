import webpush from "web-push";
import { initializeApp, getApps, cert, applicationDefault, App } from "firebase-admin/app";
import { getMessaging, Message } from "firebase-admin/messaging";
import { query } from "@/lib/db";

function getFirebaseAdmin(): App | null {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0]!;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (serviceAccountJson) {
    try {
      const parsed = typeof serviceAccountJson === "string" && serviceAccountJson.startsWith("{")
        ? JSON.parse(serviceAccountJson)
        : JSON.parse(Buffer.from(serviceAccountJson, "base64").toString("utf8"));
      return initializeApp({
        credential: cert(parsed)
      });
    } catch (e) {
      console.warn("[Firebase Admin] Failed to parse service account credentials JSON:", e);
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    try {
      return initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey
        })
      });
    } catch (e) {
      console.warn("[Firebase Admin] Failed to initialize with individual env credentials:", e);
    }
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      return initializeApp({
        credential: applicationDefault()
      });
    } catch (e) {
      console.warn("[Firebase Admin] Failed to initialize with applicationDefault:", e);
    }
  }

  return null;
}

// DO NOT FALL BACK TO ANY DEFAULT VALUE, EMPTY STRING INCLUDED, FOR A SECRET USED IN AN AUTHORIZATION OR SIGNATURE CHECK — FAIL STARTUP INSTEAD.
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
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

export interface NativeCallPushData {
  type: "incoming_call" | "call:cancelled" | "call:ended";
  callId: string;
  bookingId?: string;
  callerName?: string;
  serviceName?: string;
  [key: string]: any;
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
        const isCall = payload.data?.type?.startsWith("call:");
        const options: webpush.RequestOptions = {
          TTL: isCall ? 60 : 86400,
          urgency: isCall ? "high" : "normal"
        };
        await webpush.sendNotification(pushSubscription, payloadString, options);
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

/**
 * Sends high-priority native push wake-up message to registered Android device(s) of a user.
 * Uses FCM high-priority data messages to wake up Android device even when app is backgrounded or locked.
 */
export async function sendNativePushToUser(userId: string, data: NativeCallPushData): Promise<void> {
  if (!userId) return;

  try {
    const tokensResult = await query(
      "SELECT token, platform FROM device_push_tokens WHERE user_id = $1",
      [userId]
    );

    if (!tokensResult.rows || tokensResult.rows.length === 0) {
      return;
    }

    const firebaseApp = getFirebaseAdmin();
    const fcmServerKey = process.env.FCM_SERVER_KEY || process.env.FIREBASE_SERVER_KEY;

    // 1. Preferred Modern FCM HTTP v1 using Firebase Admin SDK
    if (firebaseApp) {
      const messaging = getMessaging(firebaseApp);
      const promises = tokensResult.rows.map(async (row) => {
        const token = row.token;
        const message: Message = {
          token,
          android: {
            priority: "high",
            ttl: 60 * 1000 // 60 seconds TTL
          },
          data: {
            type: data.type,
            callId: data.callId,
            bookingId: data.bookingId || "",
            callerName: data.callerName || "BelConnect User",
            serviceName: data.serviceName || "Voice Call"
          }
        };

        try {
          await messaging.send(message);
          console.log(`[Native Push v1] Delivered high-priority data message to user ${userId}`);
        } catch (err: any) {
          const code = err?.code || err?.errorInfo?.code;
          if (
            code === "messaging/invalid-registration-token" ||
            code === "messaging/registration-token-not-registered"
          ) {
            console.log(`[Native Push v1] Purging dead FCM token for user ${userId}:`, token);
            await query("DELETE FROM device_push_tokens WHERE token = $1", [token]).catch(() => {});
          } else {
            console.warn(`[Native Push v1] Error delivering to device token:`, err?.message || err);
          }
        }
      });

      await Promise.allSettled(promises);
      return;
    }

    if (!fcmServerKey) {
      console.log(`[Native Push] Registered device token(s) found for user ${userId}, but neither Firebase Admin credentials nor FCM_SERVER_KEY are configured in environment.`);
      return;
    }

    // 2. Legacy FCM fallback if FCM_SERVER_KEY is configured
    const legacyPromises = tokensResult.rows.map(async (row) => {
      const token = row.token;
      try {
        const response = await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `key=${fcmServerKey}`
          },
          body: JSON.stringify({
            to: token,
            priority: "high",
            content_available: true,
            data: {
              type: data.type,
              callId: data.callId,
              bookingId: data.bookingId || "",
              callerName: data.callerName || "BelConnect User",
              serviceName: data.serviceName || "Voice Call"
            }
          })
        });

        if (response.ok) {
          const resJson: any = await response.json().catch(() => ({}));
          if (resJson?.results?.[0]?.error) {
            const errCode = resJson.results[0].error;
            if (errCode === "NotRegistered" || errCode === "InvalidRegistration") {
              console.log(`[Native Push] Purging dead FCM token for user ${userId}:`, token);
              await query("DELETE FROM device_push_tokens WHERE token = $1", [token]).catch(() => {});
            }
          }
        } else if (response.status === 404 || response.status === 410) {
          await query("DELETE FROM device_push_tokens WHERE token = $1", [token]).catch(() => {});
        }
      } catch (err: any) {
        console.warn(`[Native Push] Error delivering to device token ${token}:`, err?.message || err);
      }
    });

    await Promise.allSettled(legacyPromises);
  } catch (error) {
    console.error("[Native Push] Exception sending native push to user:", error);
  }
}

/**
 * Unified call wake-up helper: dispatches both Web Push and Native Android Push in parallel.
 */
export async function sendCallPushWakeUp(receiverId: string, callData: {
  type: "incoming_call" | "call:cancelled" | "call:ended";
  callId: string;
  bookingId?: string;
  callerName?: string;
  serviceName?: string;
}): Promise<void> {
  const isIncoming = callData.type === "incoming_call";
  const webPayload: PushNotificationPayload = {
    title: isIncoming ? "Incoming Voice Call 📞" : "Call Ended",
    body: isIncoming
      ? `Incoming call from ${callData.callerName || "User"} for ${callData.serviceName || "Service"}`
      : "Call was ended or declined",
    data: {
      type: isIncoming ? "call:incoming" : "call:cancelled",
      callId: callData.callId,
      bookingId: callData.bookingId,
      callerName: callData.callerName || "User",
      serviceName: callData.serviceName || "Service",
      url: `/?activeCall=true&callId=${callData.callId}`
    }
  };

  await Promise.allSettled([
    sendPushToUser(receiverId, webPayload),
    sendNativePushToUser(receiverId, callData)
  ]);
}
