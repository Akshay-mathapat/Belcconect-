"use client";

import { getClientToken, triggerAuthExpired } from "@/lib/authFetch";
import { io, Socket } from "socket.io-client";
import { getSignalingUrl } from "@/lib/signalingUrl";

export { getSignalingUrl };

let chatSocket: Socket | null = null;
let activeUserId: string | undefined;

export const getChatSocket = (userId?: string): Socket => {
  if (userId) {
    activeUserId = userId;
  }

  const serverUrl = getSignalingUrl();
  const token = getClientToken();

  if (!chatSocket) {
    chatSocket = io(serverUrl, {
      autoConnect: Boolean(token),
      transports: ["websocket", "polling"],
      // Dynamic auth callback: ensures every reconnection uses the CURRENT client token
      auth: (cb) => {
        const freshToken = getClientToken();
        cb({
          token: freshToken || undefined,
          userId: activeUserId || undefined
        });
      },
      reconnection: Boolean(token),
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 5000
    });

    (chatSocket as any)._activeUserId = activeUserId;

    chatSocket.on("connect_error", (err: any) => {
      const msg = (err?.message || "").toLowerCase();
      if (
        msg.includes("jwt expired") ||
        msg.includes("token verification failed") ||
        msg.includes("authentication failed") ||
        msg.includes("invalid token") ||
        msg.includes("missing authentication")
      ) {
        console.warn("[ChatSocket] Authentication failed. Halting reconnect and triggering auth expiry.");
        if (chatSocket) {
          try {
            chatSocket.io.opts.reconnection = false;
          } catch (e) {}
          chatSocket.disconnect();
        }
        triggerAuthExpired();
      }
    });
  } else if (userId && (chatSocket as any)._activeUserId !== userId) {
    (chatSocket as any)._activeUserId = userId;
    activeUserId = userId;
    if (chatSocket.connected) {
      chatSocket.disconnect();
    }
    if (token) {
      try {
        chatSocket.io.opts.reconnection = true;
      } catch (e) {}
      chatSocket.connect();
    }
  }

  if (token && !chatSocket.connected) {
    try {
      chatSocket.io.opts.reconnection = true;
    } catch (e) {}
    chatSocket.connect();
  }

  return chatSocket;
};

/**
 * Recreates and reconnects the chat socket with fresh credentials.
 * Call this immediately upon successful login.
 */
export function recreateChatSocket(userId?: string): Socket {
  disconnectChatSocket();
  return getChatSocket(userId);
}

/**
 * Fully disconnects the chat socket and releases listeners.
 * Call this on logout or session expiration.
 */
export function disconnectChatSocket(): void {
  if (chatSocket) {
    chatSocket.removeAllListeners();
    chatSocket.disconnect();
    chatSocket = null;
    activeUserId = undefined;
  }
}

