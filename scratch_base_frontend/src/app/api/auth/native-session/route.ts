import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  createSession,
  getSessionTokenFromRequest,
  validateSession,
  UserRole
} from "@/lib/session";
import { checkRateLimit } from "@/lib/rateLimit";

/**
 * BelConnect Native Android Session Exchange & Resume Handler
 * 
 * Supports:
 * 1. Multi-device concurrency: Revocations are scoped to the specific device_id,
 *    never killing active sessions on a user's other devices.
 * 2. Frequent app-resume resilience: If the client already holds a valid native
 *    token (e.g. app resuming from background), it validates and reuses the active
 *    session rather than revoking it and breaking background location updates.
 * 3. Session Cap: Caps active Android sessions per user at 5, revoking oldest when exceeded.
 * 4. Admin Guard: Administrators cannot create Android client sessions.
 * 5. Rate limiting: Limits fresh session generation to 10 per 15 min per user/device,
 *    while allowing unlimited idempotent resume checks.
 */
export async function POST(request: Request) {
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

  const deviceId = headerDeviceId || bodyDeviceId || "default_android_device";

  try {
    // 1. Idempotent App-Resume Check:
    // If the native app passed an existing Bearer token, check if it is still valid.
    const authHeader = request.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      const existingNativeToken = authHeader.substring(7).trim();
      if (existingNativeToken) {
        const validatedSession = await validateSession(existingNativeToken);
        if (validatedSession && validatedSession.client === "android") {
          // Session is already active and valid; return it immediately without revoking or creating anything
          return NextResponse.json({
            success: true,
            reused: true,
            token: existingNativeToken,
            userId: validatedSession.userId,
            role: validatedSession.role,
            deviceId: validatedSession.deviceId || deviceId
          });
        }
      }
    }

    // 2. Fresh Native Exchange requires an active web cookie session
    const existingWebToken = getSessionTokenFromRequest(request, "user");
    if (!existingWebToken) {
      return NextResponse.json(
        { error: "Unauthorized: Active web session cookie is required to exchange for native session." },
        { status: 401 }
      );
    }

    const activeUser = await validateSession(existingWebToken);
    if (!activeUser) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or expired web session." },
        { status: 401 }
      );
    }

    // 3. Security: Administrators cannot create Android client sessions
    if (activeUser.role === "admin") {
      return NextResponse.json(
        { error: "Forbidden: Administrators cannot create Android client sessions." },
        { status: 403 }
      );
    }

    const targetUserId = activeUser.userId;
    const targetRole = activeUser.role as UserRole;

    // 4. Rate limit fresh session generation (10 per 15 minutes per user+device)
    const rateLimit = await checkRateLimit(request, 10, 15 * 60 * 1000);
    if (!rateLimit.isAllowed && rateLimit.response) {
      return rateLimit.response;
    }

    // 5. Device-Scoped Revocation:
    // Revoke prior active android sessions for THIS SPECIFIC device_id
    if (deviceId && deviceId !== "default_android_device") {
      await query(
        `UPDATE public.sessions 
         SET revoked_at = CURRENT_TIMESTAMP 
         WHERE user_id = $1 
           AND client = 'android' 
           AND device_id = $2 
           AND revoked_at IS NULL`,
        [String(targetUserId), deviceId]
      );
    }

    // 6. Global User Cap: Cap active android sessions per user at 5 (revoke oldest if exceeded)
    await query(
      `UPDATE public.sessions
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE id IN (
         SELECT id FROM public.sessions
         WHERE user_id = $1 AND client = 'android' AND revoked_at IS NULL
         ORDER BY created_at ASC
         OFFSET 4
       )`,
      [String(targetUserId)]
    );

    // 7. Issue fresh native Android session with real device_id
    const session = await createSession({
      userId: targetUserId,
      role: targetRole,
      ip,
      user_agent: userAgent,
      device_label: `Android Native (${deviceId})`,
      device_id: deviceId,
      client: "android"
    });

    return NextResponse.json({
      success: true,
      reused: false,
      token: session.rawToken,
      expiresAt: session.expiresAt.toISOString(),
      userId: targetUserId,
      role: targetRole,
      deviceId
    });
  } catch (err: unknown) {
    console.error("[Native Session API Error]", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: "Internal server error issuing native session." },
      { status: 500 }
    );
  }
}
