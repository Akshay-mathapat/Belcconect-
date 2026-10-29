import { NextResponse } from "next/server.js";
import { getSessionTokenFromRequest, validateSession, createSocketTicket } from "@/lib/session";
import { checkUserRateLimit } from "@/lib/rateLimitCore";
import { assertCsrfOrigin } from "@/lib/csrf";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/socket-ticket
 * 
 * Issues a single-use, 60-second time-to-live ticket for WebRTC / Socket.IO signaling authentication.
 * 
 * Security:
 * - Requires an active server-side session cookie.
 * - Rate limited per user (max 30 requests per 60 seconds).
 * - Enforces Cache-Control: no-store to prevent ticket caching.
 */
export async function POST(request: Request) {
  // 0. CSRF & Cross-Origin State-Change Defense
  const csrfError = await assertCsrfOrigin(request);
  if (csrfError) {
    return csrfError;
  }

  try {
    // 1. Authenticate via server-side session cookie
    const sessionToken = getSessionTokenFromRequest(request, "user");
    if (!sessionToken) {
      return NextResponse.json(
        { error: "Unauthorized: Active session required to obtain socket ticket" },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
          }
        }
      );
    }

    const sessionUser = await validateSession(sessionToken);
    if (!sessionUser) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or expired session" },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
          }
        }
      );
    }

    // 2. User-specific rate limit (30 ticket requests per minute per user)
    const rateLimit = await checkUserRateLimit(sessionUser.userId, 30, 60);
    if (!rateLimit.isAllowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded: Too many socket ticket requests. Please try again later.",
          retryAfter: rateLimit.retryAfter
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfter),
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
          }
        }
      );
    }

    // 3. Issue single-use socket ticket (60s TTL)
    const ticket = await createSocketTicket({
      sessionId: sessionUser.sessionId,
      userId: sessionUser.userId,
      role: sessionUser.role
    });

    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();

    return NextResponse.json(
      {
        success: true,
        ticket,
        expiresIn: 60,
        expires_at: expiresAt,
        expiresAt
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "Pragma": "no-cache"
        }
      }
    );
  } catch (err: unknown) {
    const isDbUnavailable =
      err instanceof Error &&
      (err.name === "DatabaseUnavailableError" || Boolean(typeof err === "object" && err !== null && "isDatabaseUnavailable" in err && (err as { isDatabaseUnavailable?: boolean }).isDatabaseUnavailable));

    if (isDbUnavailable) {
      return NextResponse.json(
        { error: "Database temporarily unavailable. Please retry." },
        {
          status: 503,
          headers: {
            "Retry-After": "5",
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
          }
        }
      );
    }

    console.error("[SocketTicket] Error issuing ticket:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: "Internal server error" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
        }
      }
    );
  }
}

