"use client";

import { io, Socket } from "socket.io-client";
import { getAuthToken } from "@/lib/jwt";

let chatSocket: Socket | null = null;

export const getSignalingUrl = (): string => {
  if (typeof window !== "undefined") {
    if (
      process.env.NEXT_PUBLIC_SIGNALING_URL &&
      !process.env.NEXT_PUBLIC_SIGNALING_URL.includes("localhost") &&
      !process.env.NEXT_PUBLIC_SIGNALING_URL.includes("127.0.0.1")
    ) {
      return process.env.NEXT_PUBLIC_SIGNALING_URL;
    }
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    const hostname = window.location.hostname || "localhost";
    return `${protocol}//${hostname}:4001`;
  }
  return process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:4001";
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
