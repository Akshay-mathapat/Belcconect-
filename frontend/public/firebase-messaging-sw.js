// BelConnect Firebase Cloud Messaging (FCM) Service Worker
// Official root service worker entry point required by Firebase Web SDK.
// Handles background call wake-up, CallStyle notifications, and PWA caching.

// Import unified BelConnect Service Worker containing push listeners,
// incoming call notification formatting with Answer/Decline buttons,
// and notificationclick URL navigation (?activeCall=true&callId=...&autoAccept=true).
try {
  importScripts("/sw.js");
  console.log("[FCM-SW] Successfully imported /sw.js into firebase-messaging-sw.js");
} catch (err) {
  console.error("[FCM-SW] Error importing /sw.js:", err);
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

