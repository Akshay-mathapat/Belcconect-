"use client";

import { getClientToken, triggerAuthExpired } from "@/lib/authFetch";

import { io, Socket } from "socket.io-client";
import { getAuthToken } from "@/lib/jwt";

let chatSocket: Socket | null = null;

// Use NEXT_PUBLIC_SIGNALING_URL as the single source of truth.
// Falls back to localhost:4001 ONLY when browser is also on localhost (desktop dev).
export const getSignalingUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_SIGNALING_URL?.trim();
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl;
  }
  if (typeof window !== "undefined") {
    const browserHost = window.location.hostname;
    if (browserHost === "localhost" || browserHost === "127.0.0.1") {
      return "http://127.0.0.1:4001";
    }
    if (
      browserHost.includes("vercel.app") ||
      browserHost.includes("belcconect") ||
      browserHost.includes("cityconnect") ||
      (!browserHost.endsWith(".local") &&
        !browserHost.startsWith("192.168.") &&
        !browserHost.startsWith("10."))
    ) {
      return "https://belcconect-backend.onrender.com";
    }
  }
  return "https://belcconect-backend.onrender.com";
};

export const getChatSocket = (userId?: string): Socket => {
  const token = getClientToken();
  const serverUrl = getSignalingUrl();

  if (!chatSocket) {
    chatSocket = io(serverUrl, {
      autoConnect: Boolean(token),
      transports: ["websocket", "polling"],
      auth: {
        token: token || "",
        userId: userId || ""
      },
      reconnection: Boolean(token),
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 5000
    });
    (chatSocket as any)._activeUserId = userId;

    chatSocket.on("connect_error", (err: any) => {
      const msg = (err?.message || "").toLowerCase();
      if (
        msg.includes("jwt expired") ||
        msg.includes("token verification failed") ||
        msg.includes("authentication failed") ||
        msg.includes("invalid token")
      ) {
        console.warn("[ChatSocket] Authentication failed (expired/invalid token). Halting reconnect.");
        if (chatSocket) {
          chatSocket.disconnect();
          try { chatSocket.io.opts.reconnection = false; } catch (e) {}
        }
        triggerAuthExpired();
      }
    });
  } else if (userId && (chatSocket as any)._activeUserId !== userId) {
    (chatSocket as any)._activeUserId = userId;
    (chatSocket.auth as any) = { token: token || "", userId };
    if (chatSocket.connected) {
      chatSocket.disconnect();
    }
    if (token) {
      try { chatSocket.io.opts.reconnection = true; } catch (e) {}
      chatSocket.connect();
    }
  }

  if (token && !chatSocket.connected) {
    chatSocket.auth = { token, userId: userId || "" };
    chatSocket.connect();
  }

  return chatSocket;
};

export function disconnectChatSocket() {
  if (chatSocket) {
    chatSocket.removeAllListeners();
    chatSocket.disconnect();
    chatSocket = null;
  }
}
