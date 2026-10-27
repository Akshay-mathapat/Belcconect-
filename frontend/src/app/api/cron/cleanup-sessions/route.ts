import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import crypto from "crypto";

function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyCronSecret(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET ? process.env.CRON_SECRET.trim() : "";
  // CRON_SECRET must be explicitly set and non-trivial (>= 32 chars); never fall back or bypass
  if (!cronSecret || cronSecret.length < 32) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const parts = authHeader.split(" ");
    if (
      parts.length === 2 &&
      parts[0].toLowerCase() === "bearer" &&
      parts[1] &&
      parts[1] !== "undefined" &&
      parts[1] !== "null" &&
      safeCompare(parts[1], cronSecret)
    ) {
      return true;
    }
  }

  const customHeader = request.headers.get("x-cron-secret");
  if (customHeader && customHeader !== "undefined" && safeCompare(customHeader, cronSecret)) {
    return true;
  }

  return false;
}

/**
 * Sweeps and deletes expired or revoked sessions older than 7 days,
 * and expired socket tickets, using non-blocking batched deletes.
 */
async function handleCleanupSessions(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: "Unauthorized: Missing or invalid CRON_SECRET header" },
      { status: 401 }
    );
  }

  const startTime = Date.now();
  let totalSessionsDeleted = 0;
  let totalTicketsDeleted = 0;

  try {
    // 1. Delete expired socket tickets (single-use or 60s TTL expired)
    const ticketsRes = await query(
      `DELETE FROM public.socket_tickets 
       WHERE expires_at < CURRENT_TIMESTAMP`
    );
    totalTicketsDeleted = ticketsRes.rowCount || 0;

    // 2. Batch-delete sessions revoked or expired more than 7 days ago
    // Batch size of 1000 with a cap of 10 iterations (max 10,000 per invocation)
    const batchSize = 1000;
    const maxBatches = 10;
    let batchIndex = 0;

    while (batchIndex < maxBatches) {
      // Abort if execution time approaches Vercel Hobby execution limit
      if (Date.now() - startTime > 20000) {
        console.warn("[Cron Cleanup] Approaching execution budget, breaking batch loop early.");
        break;
      }

      const delRes = await query(
        `DELETE FROM public.sessions 
         WHERE id IN (
           SELECT id FROM public.sessions
           WHERE (revoked_at IS NOT NULL AND revoked_at < CURRENT_TIMESTAMP - INTERVAL '7 days')
              OR (idle_expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days')
              OR (absolute_expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days')
           LIMIT $1
         )`,
        [batchSize]
      );

      const deletedCount = delRes.rowCount || 0;
      totalSessionsDeleted += deletedCount;
      batchIndex++;

      if (deletedCount < batchSize) {
        break; // Cleaned up all matching records
      }
    }

    const durationMs = Date.now() - startTime;
    console.info(
      JSON.stringify({
        tag: "CRON_CLEANUP_SUCCESS",
        durationMs,
        totalSessionsDeleted,
        totalTicketsDeleted,
        batchesProcessed: batchIndex
      })
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      durationMs,
      totalSessionsDeleted,
      totalTicketsDeleted
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Cron Cleanup] Batch cleanup failed:", errorMsg);
    return NextResponse.json(
      { success: false, error: "Database error during cleanup execution" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handleCleanupSessions(request);
}

export async function POST(request: Request) {
  return handleCleanupSessions(request);
}
