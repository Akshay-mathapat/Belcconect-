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

export function getNumericUid(userId: string): number {
  if (!userId) return 10000001;
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 80000000) + 10000000;
}

export function resolveUserAgoraUid(
  requestUserId: string | null | undefined,
  call: { callerId: string; receiverId: string }
): { targetUid: number; isCaller: boolean; callerUid: number; receiverUid: number } {
  let callerUid = getNumericUid(call.callerId);
  let receiverUid = getNumericUid(call.receiverId);
  if (callerUid === receiverUid) {
    receiverUid = callerUid + 54321;
  }

  const matches = (id1: string | null | undefined, id2: string) => {
    if (!id1 || !id2) return false;
    if (id1 === id2) return true;
    const norm1 = id1.toLowerCase();
    const norm2 = id2.toLowerCase();
    if (norm1 === norm2) return true;
    if ((norm1.includes("cust") || norm1 === "customer-1") && (norm2.includes("cust") || norm2 === "customer-1")) return true;
    if ((norm1.includes("prov") || norm1 === "provider-1") && (norm2.includes("prov") || norm2 === "provider-1")) return true;
    return false;
  };

  const isCallerMatch = matches(requestUserId, call.callerId);
  const isReceiverMatch = matches(requestUserId, call.receiverId);

  let isCaller = false;
  if (isCallerMatch && !isReceiverMatch) {
    isCaller = true;
  } else if (!isCallerMatch && isReceiverMatch) {
    isCaller = false;
  } else {
    isCaller = requestUserId === call.callerId;
  }

  const targetUid = isCaller ? callerUid : receiverUid;
  return { targetUid, isCaller, callerUid, receiverUid };
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
      0,
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
