"use client";

import { getChatSocket } from "./socketChat";
import { Socket } from "socket.io-client";

export function getSocket(userId?: string): Socket {
  const effectiveUserId = userId || (typeof window !== "undefined" ? localStorage.getItem("cityconnect_user_id") || "customer-1" : "customer-1");
  return getChatSocket(effectiveUserId);
}
