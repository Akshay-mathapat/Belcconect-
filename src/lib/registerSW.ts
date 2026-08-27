"use client";

/**
 * Converts a base64 string to a Uint8Array required for Web Push applicationServerKey.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers the Service Worker, requests notification permission,
 * subscribes the client to Web Push, and posts subscription to backend API.
 */
export async function registerAndSubscribeUser(userId: string): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("[WebPush] Service Worker or Push Messaging is not supported in this browser.");
    return false;
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    console.warn("[WebPush] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not defined in environment.");
    return false;
  }

  try {
    // 1. Register Service Worker gracefully
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      console.warn("[WebPush] Service worker registration failed:", err);
      return null;
    });

    if (!registration) return false;
    await navigator.serviceWorker.ready;

    // 2. Request Notification Permission
    const permission = await Notification.requestPermission().catch(() => "default");
    if (permission !== "granted") {
      console.warn("[WebPush] Notification permission not granted by user.");
      return false;
    }

    // 3. Get existing subscription or subscribe
    let subscription = await registration.pushManager.getSubscription().catch(() => null);

    if (!subscription) {
      try {
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey as unknown as BufferSource
        });
      } catch (subError: any) {
        // Gracefully handle browser push service errors (e.g. FCM unreachable, offline mode, AbortError)
        console.warn("[WebPush] Push service registration skipped/unavailable:", subError?.message || subError);
        return false;
      }
    }

    if (!subscription) return false;

    // 4. Send subscription to backend API
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        subscription: subscription.toJSON()
      })
    }).catch(() => null);

    if (res && res.ok) {
      console.log("[WebPush] Successfully subscribed user to push notifications:", userId);
      return true;
    } else {
      console.warn("[WebPush] Failed to store push subscription on server.");
      return false;
    }
  } catch (err: any) {
    console.warn("[WebPush] Registration / Subscription handled gracefully:", err?.message || err);
    return false;
  }
}
