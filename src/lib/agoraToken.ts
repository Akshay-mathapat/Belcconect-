import { RtcTokenBuilder, RtcRole } from "agora-token";

export interface AgoraSessionDetails {
  appId: string;
  channelName: string;
  token: string;
  uid: number;
}

const AGORA_APP_ID = process.env.AGORA_APP_ID || process.env.NEXT_PUBLIC_AGORA_APP_ID || "da179241ac4b4006ae523afad334dc97";
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || "5fd303f488a047d38f1120958cfe331d";

function sanitizeChannelName(name: string): string {
  if (!name) return "cityconnect_channel";
  const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, "_");
  return sanitized.length > 0 ? sanitized.substring(0, 64) : "cityconnect_channel";
}

/**
 * Generates an Agora RTC token for real-time voice streaming between customer and service provider.
 * Uses Agora RtcTokenBuilder specification (Role: Publisher).
 */
export function generateAgoraRtcToken(
  rawChannelName: string,
  userUid: number,
  expireSeconds: number = 3600
): AgoraSessionDetails {
  const appId = AGORA_APP_ID;
  const appCertificate = AGORA_APP_CERTIFICATE;
  const channelName = sanitizeChannelName(rawChannelName);

  if (!appId) {
    throw new Error("Agora Configuration Missing: AGORA_APP_ID is not set in environment variables.");
  }

  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expireSeconds;

  let token = "";
  if (appCertificate) {
    token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      userUid,
      RtcRole.PUBLISHER,
      privilegeExpiredTs,
      privilegeExpiredTs
    );
  }

  return {
    appId,
    channelName,
    token,
    uid: userUid,
  };
}
