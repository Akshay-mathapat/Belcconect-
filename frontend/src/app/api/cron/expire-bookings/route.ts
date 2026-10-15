import { NextResponse } from "next/server";
import { expireStaleBookings, checkCronSecretConfigured } from "@/lib/bookingExpiry";
import crypto from "crypto";

// Ensure loud warning logs if CRON_SECRET is missing at startup
checkCronSecretConfigured();

function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyCronSecret(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET ? process.env.CRON_SECRET.trim() : "";

  // CRON_SECRET must be explicitly set and matched; never fall back or bypass
  if (!cronSecret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer" && safeCompare(parts[1], cronSecret)) {
      return true;
    }
  }

  const customHeader = request.headers.get("x-cron-secret");
  if (customHeader && safeCompare(customHeader, cronSecret)) {
    return true;
  }

  return false;
}

async function handleExpireCron(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: "Unauthorized: Missing or invalid CRON_SECRET header" },
      { status: 401 }
    );
  }

  try {
    const expiredResults = await expireStaleBookings();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      expiredCount: expiredResults.length,
      expired: expiredResults.map((b) => ({
        id: b.id,
        customerId: b.customerId,
        serviceName: b.serviceName,
        category: b.category,
        suggestedProvidersCount: b.suggestedProviders.length
      }))
    });
  } catch (error: unknown) {
    console.error("[Cron Expire-Bookings] Uncaught error during execution:", error);
    return NextResponse.json(
      { error: "Internal Server Error during booking expiry sweep" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handleExpireCron(request);
}

export async function POST(request: Request) {
  return handleExpireCron(request);
}

