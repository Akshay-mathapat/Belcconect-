
"use client";

import { io, Socket } from "socket.io-client";
import { getSignalingUrl } from "@/lib/signalingUrl";

export { getSignalingUrl };

interface ChatSocketAuth {
  ticket?: string;
  userId?: string;
}

interface ChatSocketWithUser extends Socket {
  _activeUserId?: string;
}

let chatSocket: ChatSocketWithUser | null = null;
let activeUserId: string | undefined;

export const getChatSocket = (userId?: string): Socket => {
  if (userId) {
    activeUserId = userId;
  }

  const serverUrl = getSignalingUrl();

  if (!chatSocket) {
    chatSocket = io(serverUrl, {
      autoConnect: Boolean(activeUserId),
      transports: ["websocket", "polling"],

      // Socket.IO expects a synchronous callback. Fetch credentials asynchronously
      // and invoke the callback once the request has completed.
      auth: (callback: (auth: ChatSocketAuth) => void) => {
        void (async () => {
          let ticket: string | null = null;

          try {
            const response = await fetch("/api/auth/socket-ticket", {
              method: "POST",
              credentials: "include",
            });

            if (response.ok) {
              const data: unknown = await response.json();

              if (
                typeof data === "object" &&
                data !== null &&
                "ticket" in data &&
                typeof data.ticket === "string" &&
                data.ticket.length > 0
              ) {
                ticket = data.ticket;
              }
            }
          } catch {
            // Ticket retrieval failed
          }

          if (ticket) {
            callback({
              ticket,
              userId: activeUserId,
            });
            return;
          }

          // Legacy token fallback removed: WebRTC chat sockets strictly require socket tickets
          callback({
            userId: activeUserId,
          });
        })();
      },

      reconnection: Boolean(activeUserId),
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 5000,
    });

    chatSocket._activeUserId = activeUserId;

    chatSocket.on("connect_error", (error: Error) => {
      const message = (error.message || "").toLowerCase();

      const isAuthenticationError =
        message.includes("jwt expired") ||
        message.includes("token verification failed") ||
        message.includes("authentication failed") ||
        message.includes("invalid token") ||
        message.includes("missing authentication");

      if (isAuthenticationError) {
        console.warn(
          "[ChatSocket] Authentication failed. Stopping socket reconnection; HTTP polling may be used as a fallback."
        );

        if (chatSocket) {
          chatSocket.io.opts.reconnection = false;
          chatSocket.disconnect();
        }
      }
    });
  } else if (userId && chatSocket._activeUserId !== userId) {
    chatSocket._activeUserId = userId;
    activeUserId = userId;

    if (chatSocket.connected) {
      chatSocket.disconnect();
    }

    if (activeUserId) {
      chatSocket.io.opts.reconnection = true;
      chatSocket.connect();
    }
  }

  if (activeUserId && !chatSocket.connected) {
    chatSocket.io.opts.reconnection = true;
    chatSocket.connect();
  }

  return chatSocket;
};

/**
 * Recreates and reconnects the chat socket with fresh credentials.
 * Call after successful login.
 */
export function recreateChatSocket(userId?: string): Socket {
  disconnectChatSocket();
  return getChatSocket(userId);
}

/**
 * Fully disconnects the chat socket and releases listeners.
 * Call on logout or session expiration.
 */
export function disconnectChatSocket(): void {
  if (chatSocket) {
    chatSocket.removeAllListeners();
    chatSocket.disconnect();
    chatSocket = null;
    activeUserId = undefined;
  }
}
