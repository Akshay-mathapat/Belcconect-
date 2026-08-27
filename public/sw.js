// CityConnect Service Worker for Web Push & Offline Support

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle Incoming Web Push Notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const { title, body, icon, data } = payload;
    const notificationData = data || {};
    const type = notificationData.type || "general";

    // 1. Handle Call Cancelled / Ended -> Immediately close ringing notification
    if (type === "call:cancelled" || type === "call:ended") {
      const callTag = `call_${notificationData.callId}`;
      event.waitUntil(
        self.registration.getNotifications({ tag: callTag }).then((notifications) => {
          notifications.forEach((notification) => notification.close());
        })
      );
      return;
    }

    // 2. Handle Incoming Call -> High-priority persistent notification banner
    if (type === "call:incoming") {
      const callId = notificationData.callId || "unknown";
      const options = {
        body: body || "Incoming Voice Call...",
        icon: icon || "/BelConnectLogo.png",
        badge: "/BelConnectLogo.png",
        tag: `call_${callId}`,
        renotify: true,
        requireInteraction: true,
        vibrate: [300, 100, 300, 100, 300],
        data: notificationData,
        actions: [
          { action: "answer", title: "📞 Answer" },
          { action: "decline", title: "❌ Decline" }
        ]
      };

      event.waitUntil(
        self.registration.showNotification(title || "Incoming Voice Call", options)
      );
      return;
    }

    // 3. Handle Chat Message Notification
    if (type === "chat:message") {
      const convId = notificationData.conversationId || "general";
      const options = {
        body: body || "You have received a new message.",
        icon: icon || "/BelConnectLogo.png",
        badge: "/BelConnectLogo.png",
        tag: `chat_${convId}`,
        renotify: true,
        data: notificationData
      };

      event.waitUntil(
        self.registration.showNotification(title || "New Message", options)
      );
      return;
    }

    // Default Fallback Notification
    const defaultOptions = {
      body: body || "New update from CityConnect",
      icon: icon || "/BelConnectLogo.png",
      data: notificationData
    };
    event.waitUntil(
      self.registration.showNotification(title || "CityConnect Alert", defaultOptions)
    );
  } catch (err) {
    console.error("[Service Worker] Push event error:", err);
  }
});

// Handle Notification Click & Action Buttons
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};
  const targetUrl = data.url || "/";

  // Action: Decline Call directly from Notification
  if (action === "decline" && data.callId) {
    event.waitUntil(
      fetch(`/api/calls/${data.callId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      }).catch((e) => console.error("[Service Worker] Reject call error:", e))
    );
    return;
  }

  // Action: Answer Call or Open App Window
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Look for an existing open window client
      for (const client of clientList) {
        if (client.url && "focus" in client) {
          if ("navigate" in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // If no window client is open, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
