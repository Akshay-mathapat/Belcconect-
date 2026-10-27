import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/jwt";
import crypto from "crypto";

function getFingerprint(secret?: string): string {
  if (!secret || typeof secret !== "string" || !secret.trim()) return "--------";
  return crypto.createHash("sha256").update(secret.trim()).digest("hex").slice(0, 8);
}

function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function GET(request: Request) {
  // Authorization: must be either authenticated admin session OR valid SIGNALING_INTERNAL_SECRET header
  const authHeader = request.headers.get("authorization") || "";
  const internalSecret = process.env.SIGNALING_INTERNAL_SECRET?.trim() || "";
  let isAuthorized = false;

  if (authHeader.startsWith("Bearer ") && internalSecret) {
    const token = authHeader.substring(7).trim();
    if (safeCompare(token, internalSecret)) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    const authUser = await getAuthenticatedUser(request);
    if (authUser && authUser.role === "admin") {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: "Forbidden: Admin session or internal secret required" }, { status: 403 });
  }

  const fingerprints = {
    JWT_SECRET: getFingerprint(process.env.JWT_SECRET),
    SESSION_SECRET: getFingerprint(process.env.SESSION_SECRET),
    OAUTH_STATE_SECRET: getFingerprint(process.env.OAUTH_STATE_SECRET),
    SIGNALING_INTERNAL_SECRET: getFingerprint(process.env.SIGNALING_INTERNAL_SECRET),
    CRON_SECRET: getFingerprint(process.env.CRON_SECRET),
    DOWNLOAD_URL_SECRET: getFingerprint(process.env.DOWNLOAD_URL_SECRET)
  };

  return NextResponse.json({
    service: "frontend",
    timestamp: new Date().toISOString(),
    fingerprints
  });
}

