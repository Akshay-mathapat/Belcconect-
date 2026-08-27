import { AccessToken } from "livekit-server-sdk";

export interface LiveKitSessionDetails {
  serverUrl: string;
  participantToken: string;
  roomName: string;
  identity: string;
}

export function generateLiveKitRoomName(bookingId: string): string {
  const sanitized = (bookingId || "default").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `cityconnect-booking-${sanitized}`;
}

export function isPlaceholderSecret(secret?: string): boolean {
  if (!secret) return true;
  return secret.includes("•") || secret.includes("\u2022") || secret.startsWith("YOUR_") || secret.includes("bullet");
}

export async function generateLiveKitToken(
  bookingId: string,
  userId: string,
  userName?: string
): Promise<LiveKitSessionDetails> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const serverUrl = process.env.LIVEKIT_URL || "wss://YOUR_PROJECT.livekit.cloud";

  if (!apiKey || !apiSecret) {
    throw new Error("LiveKit Configuration Missing: LIVEKIT_API_KEY or LIVEKIT_API_SECRET is not set.");
  }

  if (isPlaceholderSecret(apiSecret)) {
    console.warn(
      "[LiveKit] WARNING: LIVEKIT_API_SECRET in .env contains placeholder bullet characters. LiveKit Cloud will reject the connection with 'invalid token' until replaced with your real LiveKit secret key."
    );
  }

  const roomName = generateLiveKitRoomName(bookingId);
  const identity = userId;

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: userName || identity,
    ttl: "1h"
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  });

  const participantToken = await at.toJwt();

  return {
    serverUrl,
    participantToken,
    roomName,
    identity
  };
}
