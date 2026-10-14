import type { CallRecord } from "@/lib/calls";

export interface SocketSignalPayload {
  type:
    | "call:initiate"
    | "call:ring"
    | "call:accept"
    | "call:reject"
    | "call:end"
    | "call:ended"
    | "call:cancel"
    | "call:missed"
    | "call:timeout"
    | "call:busy"
    | "call:connected";
  targetUserId?: string;
  targetUserIds?: string[];
  call: CallRecord | Record<string, unknown>;
  livekit?: {
    serverUrl: string;
    participantToken: string;
    roomName: string;
  };
  reason?: string;
  endedByUserId?: string;
  endedByRole?: string;
  endedByName?: string;
  endedAt?: string;
}

import { getSignalingUrl } from "@/lib/signalingUrl";

const SIGNALING_SERVER_URL = getSignalingUrl();
// DO NOT FALL BACK TO ANY DEFAULT VALUE, EMPTY STRING INCLUDED, FOR A SECRET USED IN AN AUTHORIZATION OR SIGNATURE CHECK — FAIL STARTUP INSTEAD.
const SIGNALING_INTERNAL_SECRET = process.env.SIGNALING_INTERNAL_SECRET;

if ((!SIGNALING_INTERNAL_SECRET || SIGNALING_INTERNAL_SECRET.length < 32) && typeof window === "undefined") {
  throw new Error("FATAL: SIGNALING_INTERNAL_SECRET environment variable is missing or shorter than 32 characters.");
}

/**
 * Non-blocking signaling relay to external Socket.IO signaling server.
 * Uses a short timeout (1500ms) to ensure it never blocks HTTP API responses.
 */
export async function sendCallSignal(payload: SocketSignalPayload): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(`${SIGNALING_SERVER_URL}/api/signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        secret: SIGNALING_INTERNAL_SECRET,
        type: payload.type,
        targetUserId: payload.targetUserId,
        targetUserIds: payload.targetUserIds,
        call: payload.call,
        livekit: payload.livekit,
        reason: payload.reason,
        endedByUserId: payload.endedByUserId,
        endedByRole: payload.endedByRole,
        endedByName: payload.endedByName,
        endedAt: payload.endedAt,
        timestamp: Date.now()
      })
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[socketSignaling] Signal relay HTTP ${res.status} to ${SIGNALING_SERVER_URL}`);
      return false;
    }
    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[socketSignaling] Signal relay non-critical notice: ${message}`);
    return false;
  }
}
