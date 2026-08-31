"use client";

import { getChatSocket } from "./socketChat";
import { Socket } from "socket.io-client";

export function getSocket(userId?: string): Socket {
  const effectiveUserId = userId || (typeof window !== "undefined" ? localStorage.getItem("cityconnect_user_id") || "" : "");
  return getChatSocket(effectiveUserId);
}
