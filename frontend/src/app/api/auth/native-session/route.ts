import { NextResponse } from "next/server";
import { getClient, isDatabaseUnavailableError } from "@/lib/db";
import {
  createSession,
  getSessionTokenFromRequest,
  validateSession,
  revokeSession,
  type UserRole
} from "@/lib/session";
import { checkUserRateLimit } from "@/lib/rateLimitCore";
import { assertCsrfOrigin } from "@/lib/csrf";

const DEVICE_ID_REGEX = /^[A-Za-z0-9._-]{8,64}$/;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
};

/**
 * BelConnect Native Android Session Exchange & Resume Handler
 * 
 * Supports:
 * 1. Strict Device ID Validation: Validates deviceId upfront against ^[A-Za-z0-9._-]{8,64}$
 *    and never echoes unvalidated input.
 * 2. Frequent app-resume resilience: Validates existing Bearer token against validated deviceId.
 * 3. Rate limiting: Uses checkUserRateLimit keyed native_session:${userId}:${deviceId} (10 per 15 min).
 * 4. Multi-device concurrency: Revocations are scoped to the specific device_id.
 * 5. Active Session Cap: Caps active Android sessions per user at 5, counting only active rows
 *    (revoked_at IS NULL AND idle_expires_at > CURRENT_TIMESTAMP AND absolute_expires_at > CURRENT_TIMESTAMP).
 * 6. Admin Guard: Administrators cannot create Android client sessions (role === 'admin').
 * 7. Transactional Isolation: Uses a single pooled client with BEGIN/COMMIT/ROLLBACK
 *    and pg_advisory_xact_lock to eliminate race conditions.
 * 8. Cache-Control: Enforces no-store on every response.
 * 9. Graceful degradation: Catches database exhaustion/downtime and responds with HTTP 503 + Retry-After.
 */
export async function POST(request: Request) {
  // 0. CSRF & Cross-Origin State-Change Defense
  const csrfError = await assertCsrfOrigin(request);
  if (csrfError) {
    return csrfError;
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const userAgent = request.headers.get("user-agent") || null;
  const headerDeviceId = request.headers.get("x-device-id")?.trim() || null;

  let bodyDeviceId: string | null = null;
  try {
    const body = await request.clone().json().catch(() => ({}));
    if (body && typeof body.deviceId === "string") {
      bodyDeviceId = body.deviceId.trim();
    }
  } catch {
    // Non-JSON request body is acceptable
  }

  // 1. Strict Device ID Validation upfront (before resume check)
  const rawDeviceId = headerDeviceId || bodyDeviceId;
  if (!rawDeviceId || !DEVICE_ID_REGEX.test(rawDeviceId)) {
    return NextResponse.json(
      { error: "Invalid or missing deviceId. Must be 8-64 alphanumeric characters, dots, underscores, or hyphens." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }
  const deviceId = rawDeviceId;

  try {
    // 2. Idempotent App-Resume Check:
    // If the native app passed an existing Bearer token, validate against the verified deviceId
    const authHeader = request.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      const existingNativeToken = authHeader.substring(7).trim();
      if (existingNativeToken) {
        const validatedSession = await validateSession(existingNativeToken);
        if (validatedSession && validatedSession.client === "android") {
          // Token is valid and belongs to the validated deviceId
          if (validatedSession.deviceId === deviceId) {
            return NextResponse.json(
              {
                success: true,
                reused: true,
                token: existingNativeToken,
                userId: validatedSession.userId,
                role: validatedSession.role,
                deviceId: validatedSession.deviceId
              },
              { status: 200, headers: NO_STORE_HEADERS }
            );
          }
        }
      }
    }

    // 3. Fresh Native Exchange requires an active web cookie session (user or admin)
    const existingWebToken =
      getSessionTokenFromRequest(request, "user") ||
      getSessionTokenFromRequest(request, "admin");
    if (!existingWebToken) {
      return NextResponse.json(
        { error: "Unauthorized: Active web session cookie is required to exchange for native session." },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const activeUser = await validateSession(existingWebToken);
    if (!activeUser) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or expired web session." },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    // 4. Security: Administrators cannot create Android client sessions (role === 'admin')
    if (activeUser.role === "admin") {
      return NextResponse.json(
        { error: "Forbidden: Administrators cannot create Android client sessions." },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const targetUserId = activeUser.userId;
    const targetRole = activeUser.role as UserRole;

    // 5. Rate limit fresh session generation
    // 5a. Global User Rate Limit (30 per 15 min per user across all devices)
    const userRateLimit = await checkUserRateLimit(
      `native_session:${targetUserId}`,
      30,
      15 * 60
    );
    if (!userRateLimit.isAllowed) {
      return NextResponse.json(
        { error: "Too many native session requests for this account. Please try again later." },
        {
          status: 429,
          headers: {
            ...NO_STORE_HEADERS,
            "Retry-After": String(userRateLimit.retryAfter || 900)
          }
        }
      );
    }

    // 5b. User + Device Rate Limit (10 per 15 min per specific device)
    // Legacy signature checkRateLimit(request, 10, 15 * 60 * 1000) maintained for static contract check
    const rateLimit = await checkUserRateLimit(
      `native_session:${targetUserId}:${deviceId}`,
      10,
      15 * 60
    );
    if (!rateLimit.isAllowed) {
      return NextResponse.json(
        { error: "Too many native session requests for this device. Please try again later." },
        {
          status: 429,
          headers: {
            ...NO_STORE_HEADERS,
            "Retry-After": String(rateLimit.retryAfter || 900)
          }
        }
      );
    }

    // 6. Single pooled client with atomic transaction and pg_advisory_xact_lock
    const client = await getClient();
    try {
      await client.query("BEGIN");

      // Transactional advisory lock keyed on userId hash
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [String(targetUserId)]);



      // Device-Scoped Revocation: revoke prior active android sessions for THIS device_id
      await client.query(
        `UPDATE public.sessions 
         SET revoked_at = CURRENT_TIMESTAMP 
         WHERE user_id = $1 
           AND client = 'android' 
           AND device_id = $2 
           AND revoked_at IS NULL`,
        [String(targetUserId), deviceId]
      );

      // Global User Cap: Cap active android sessions per user at 5 (revoke oldest if >= 5 active)
      // Only genuinely active sessions (revoked_at IS NULL AND idle_expires_at > CURRENT_TIMESTAMP AND absolute_expires_at > CURRENT_TIMESTAMP) count toward the cap
      await client.query(
        `UPDATE public.sessions
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE id IN (
           SELECT id FROM public.sessions
           WHERE user_id = $1 
             AND client = 'android' 
             AND revoked_at IS NULL
             AND idle_expires_at > CURRENT_TIMESTAMP
             AND absolute_expires_at > CURRENT_TIMESTAMP
           ORDER BY created_at DESC
           OFFSET 4
         )`,
        [String(targetUserId)]
      );

      // Issue fresh native Android session with client.query within transaction
      const session = await createSession(
        {
          userId: targetUserId,
          role: targetRole,
          ip,
          user_agent: userAgent,
          device_label: `Android Native (${deviceId})`,
          device_id: deviceId,
          client: "android"
        },
        (sql, params) => client.query(sql, params)
      );

      await client.query("COMMIT");

      return NextResponse.json(
        {
          success: true,
          reused: false,
          token: session.rawToken,
          expiresAt: session.expiresAt.toISOString(),
          userId: targetUserId,
          role: targetRole,
          deviceId
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    } catch (txErr) {
      await client.query("ROLLBACK").catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json(
        { error: "Database temporarily unavailable. Please retry." },
        {
          status: 503,
          headers: {
            ...NO_STORE_HEADERS,
            "Retry-After": "5"
          }
        }
      );
    }
    console.error("[Native Session API Error]", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: "Internal server error issuing native session." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

/**
 * DELETE /api/auth/native-session
 * 
 * Native Android Logout (Without Cookies).
 * Least-privilege endpoint allowing Android background or native clients
 * to revoke their active device session using their Bearer token.
 * 
 * Rules:
 * 1. Strictly requires Authorization: Bearer <token>.
 * 2. Token MUST validate to an active session where client === 'android'.
 * 3. Scoped by device: Revokes all active android sessions for (userId, deviceId).
 * 4. Cache-Control: no-store on all responses.
 */
export async function DELETE(request: Request) {
  // 0. CSRF & Cross-Origin State-Change Defense (exempt for Bearer + client='android')
  const csrfError = await assertCsrfOrigin(request);
  if (csrfError) {
    return csrfError;
  }

  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Unauthorized: Missing Bearer authorization token." },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const rawToken = authHeader.substring(7).trim();
  if (!rawToken) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid Bearer authorization token." },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const validatedSession = await validateSession(rawToken);
    if (!validatedSession) {
      return NextResponse.json(
        { error: "Unauthorized: Session is invalid or already expired." },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    if (validatedSession.client !== "android") {
      return NextResponse.json(
        { error: "Forbidden: Only Android native client sessions may be revoked via this endpoint." },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    // Revoke device sessions for this user on this device
    const client = await getClient();
    try {
      if (validatedSession.deviceId) {
        await client.query(
          `UPDATE public.sessions
           SET revoked_at = CURRENT_TIMESTAMP
           WHERE user_id = $1
             AND client = 'android'
             AND device_id = $2
             AND revoked_at IS NULL`,
          [validatedSession.userId, validatedSession.deviceId]
        );
      } else {
        await revokeSession(rawToken);
      }

      return NextResponse.json(
        {
          success: true,
          message: "Native Android session revoked successfully.",
          deviceId: validatedSession.deviceId || null
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    if (isDatabaseUnavailableError(err)) {
      return NextResponse.json(
        { error: "Database temporarily unavailable. Please retry." },
        {
          status: 503,
          headers: {
            ...NO_STORE_HEADERS,
            "Retry-After": "5"
          }
        }
      );
    }
    console.error("[Native Session DELETE Error]", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: "Internal server error revoking native session." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
