// BelConnect Service Worker - PWA Caching & Web Push Notifications

const CACHE_NAME = "belconnect-cache-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/belconnect.png",
  "/BelConnectLogo.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/maskable-icon-512x512.png"
];

// Install Event - Pre-cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("[SW] Cache addAll warning:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Sensible Caching Strategy
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Ignore non-GET requests (POST, PUT, DELETE, etc.) and non-http schemes
  if (request.method !== "GET" || !url.protocol.startsWith("http")) {
    return;
  }

  // 2. API Requests & Auth & Signaling & Dynamic Data -> STRICT NETWORK-FIRST (no stale data)
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("socket.io") ||
    url.pathname.includes("/auth/") ||
    url.pathname.includes("/livekit/")
  ) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ error: "Offline mode. Network unavailable." }), {
          status: 503,
          headers: { "Content-Type": "application/json" }
        });
      })
    );
    return;
  }

  // 3. HTML / Navigation pages -> NETWORK-FIRST with cache fallback
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          return caches.match("/");
        })
    );
    return;
  }

  // 4. Static Assets (Images, Fonts, CSS, JS, Icons) -> STALE-WHILE-REVALIDATE
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// =========================================================
// Web Push Notifications
// =========================================================
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const notificationData = payload.data || payload || {};
    const type = notificationData.type || payload.type || "general";

    if (type === "call:cancelled" || type === "call:ended" || type === "call_cancelled") {
      const callId = notificationData.callId || payload.callId;
      const callTag = `call_${callId}`;
      event.waitUntil(
        self.registration.getNotifications({ tag: callTag }).then((notifications) => {
          notifications.forEach((notification) => notification.close());
        })
      );
      return;
    }

    if (type === "call:incoming" || type === "incoming_call") {
      const callId = notificationData.callId || payload.callId || "unknown";
      const callerName = notificationData.callerName || payload.callerName || "BelConnect User";
      const serviceName = notificationData.serviceName || payload.serviceName || "Voice Call";
      const displayTitle = payload.title || `Incoming Call from ${callerName}`;
      const displayBody = payload.body || `${callerName} • ${serviceName}`;
      const options = {
        body: displayBody,
        icon: payload.icon || "/belconnect.png",
        badge: "/belconnect.png",
        tag: `call_${callId}`,
        renotify: true,
        requireInteraction: true,
        timestamp: Date.now(),
        vibrate: [500, 200, 500, 200, 500, 200, 500],
        data: {
          ...notificationData,
          callId: callId,
          url: `/?activeCall=true&callId=${callId}`
        },
        actions: [
          { action: "answer", title: "📞 Answer" },
          { action: "decline", title: "❌ Decline" }
        ]
      };

      event.waitUntil(
        self.registration.showNotification(displayTitle, options)
      );
      return;
    }

    if (type === "chat:message") {
      const convId = notificationData.conversationId || "general";
      const options = {
        body: payload.body || "You have received a new message.",
        icon: payload.icon || "/belconnect.png",
        badge: "/belconnect.png",
        tag: `chat_${convId}`,
        renotify: true,
        data: notificationData
      };

      event.waitUntil(
        self.registration.showNotification(payload.title || "New Message", options)
      );
      return;
    }

    const defaultOptions = {
      body: payload.body || "New update from BelConnect",
      icon: payload.icon || "/belconnect.png",
      data: notificationData
    };
    event.waitUntil(
      self.registration.showNotification(payload.title || "BelConnect Alert", defaultOptions)
    );
  } catch (err) {
    console.error("[Service Worker] Push event error:", err);
  }
});

self.addEventListener("notificationclick", (event) => {
  console.log("[CALL_TRACE] SW Step A: notificationclick fired, action=" + event.action + " callId=" + (event.notification.data && event.notification.data.callId));
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};
  let targetUrl = data.url || "/";

  if (action === "decline" && data.callId) {
    event.waitUntil(
      fetch(`/api/calls/${data.callId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      }).catch((e) => console.error("[Service Worker] Reject call error:", e))
    );
    return;
  }

  if (action === "answer" && data.callId) {
    targetUrl = `/?activeCall=true&callId=${data.callId}&autoAccept=true`;
    console.log("[CALL_TRACE] SW Step B: answer action, targetUrl=" + targetUrl);
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      console.log("[CALL_TRACE] SW Step C: found " + clientList.length + " open window client(s)");
      for (const client of clientList) {
        if (client.url && "focus" in client) {
          if ("navigate" in client) {
            console.log("[CALL_TRACE] SW Step D: navigating existing client to " + targetUrl);
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        console.log("[CALL_TRACE] SW Step E: opening new window at " + targetUrl);
        return self.clients.openWindow(targetUrl);
      }
    }).catch((err) => {
      console.error("[CALL_TRACE] SW Step F: notificationclick handler threw:", err);
    })
  );
});
