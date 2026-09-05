"use client";

import { io, Socket } from "socket.io-client";
import { getAuthToken } from "@/lib/jwt";

let chatSocket: Socket | null = null;

// Use NEXT_PUBLIC_SIGNALING_URL as the single source of truth.
// Falls back to localhost:4001 ONLY when browser is also on localhost (desktop dev).
export const getSignalingUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_SIGNALING_URL?.trim();
  if (envUrl && envUrl.length > 0) {
    return envUrl;
  }
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return "http://127.0.0.1:4001";
  }
  // No env var + not localhost = misconfigured; caller must handle
  return "http://127.0.0.1:4001";
};

export const getChatSocket = (userId?: string): Socket => {
  if (!chatSocket) {
    const token = getAuthToken();
    const serverUrl = getSignalingUrl();
    
    chatSocket = io(serverUrl, {
      autoConnect: true,
      transports: ["websocket", "polling"],
      auth: {
        token: token || "",
        userId: userId || ""
      },
      query: {
        token: token || "",
        userId: userId || ""
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 200,
      reconnectionDelayMax: 1000,
      timeout: 5000
    });
    (chatSocket as any)._activeUserId = userId;
  } else if (userId && (chatSocket as any)._activeUserId !== userId) {
    const token = getAuthToken();
    (chatSocket as any)._activeUserId = userId;
    (chatSocket.auth as any) = { token: token || "", userId };
    (chatSocket.io.opts as any).query = { token: token || "", userId };
    if (chatSocket.connected) {
      chatSocket.disconnect();
    }
    chatSocket.connect();
  }

  if (!chatSocket.connected) {
    chatSocket.connect();
  }

  return chatSocket;
};
