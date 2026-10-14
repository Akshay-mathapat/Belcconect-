import { NextResponse } from "next/server";
import crypto from "crypto";
import { sendPushToUser } from "@/lib/pushNotifications";
import { normalizeSecret } from "@/lib/secretNormalizer";

function timingSafeMatch(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const normProvided = normalizeSecret(provided);
  const normExpected = normalizeSecret(expected);
  if (!normProvided || !normExpected) return false;
  const bufA = Buffer.from(normProvided);
  const bufB = Buffer.from(normExpected);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: Request) {
  try {
    const rawSignalingSecret = process.env.SIGNALING_INTERNAL_SECRET;
    const rawInternalSecret = process.env.INTERNAL_API_SECRET;
    const signalingSecret = rawSignalingSecret ? normalizeSecret(rawSignalingSecret) : "";
    const internalSecret = rawInternalSecret ? normalizeSecret(rawInternalSecret) : "";

    if ((!signalingSecret || signalingSecret.length < 32) && (!internalSecret || internalSecret.length < 32)) {
      throw new Error("FATAL: SIGNALING_INTERNAL_SECRET or INTERNAL_API_SECRET must be configured and >= 32 characters.");
    }

    // Extract secret from headers (Bearer token or x-internal-secret) or request body
    const authHeader = req.headers.get("authorization") || "";
    const headerSecret = req.headers.get("x-internal-secret") || "";
    const bearerSecret = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";

    const body = await req.json().catch(() => ({}));
    const bodySecret = typeof body?.secret === "string" ? body.secret.trim() : "";

    const candidateSecret = headerSecret || bearerSecret || bodySecret;

    const isAuthorized =
      (signalingSecret && timingSafeMatch(candidateSecret, signalingSecret)) ||
      (internalSecret && timingSafeMatch(candidateSecret, internalSecret));

    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden: Invalid internal secret" }, { status: 403 });
    }

    const { userId, title, body: pushBody, icon, data } = body;

    if (!userId || typeof userId !== "string" || userId.trim().length === 0 || userId.length > 128) {
      return NextResponse.json({ error: "Valid userId is required (max 128 chars)" }, { status: 400 });
    }

    if (!title || typeof title !== "string" || title.trim().length === 0 || title.length > 256) {
      return NextResponse.json({ error: "Valid title is required (max 256 chars)" }, { status: 400 });
    }

    const sanitizedBody = typeof pushBody === "string" ? pushBody.slice(0, 2048) : "";
    const sanitizedIcon = typeof icon === "string" && icon.length <= 512 ? icon : "/BelConnectLogo.png";

    // Trigger push notification non-blockingly
    sendPushToUser(userId.trim(), {
      title: title.trim(),
      body: sanitizedBody,
      icon: sanitizedIcon,
      data: (data && typeof data === "object") ? data : {}
    }).catch((err) => {
      console.error("[Push Dispatch Error]:", err);
    });

    return NextResponse.json({ success: true, message: "Push notification triggered" });
  } catch (error: any) {
    console.error("[Push Send API Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to send push notification" }, { status: 500 });
  }
}
