import crypto from "crypto";

/**
 * Lazy-load database query runner to maintain compatibility across
 * both Next.js bundler and Node.js runtime environments.
 * Fails loudly if ./db cannot be loaded.
 */
let dbQueryFn: ((sql: string, params?: any[]) => Promise<any>) | null = null;
export async function getDefaultQueryRunner(): Promise<(sql: string, params?: any[]) => Promise<any>> {
  if (!dbQueryFn) {
    if (process.env.TEST_DATABASE_URL) {
      const { Pool } = await import("pg");
      const testPool = new Pool({
        connectionString: process.env.TEST_DATABASE_URL,
        ssl: process.env.TEST_DATABASE_URL.includes("render.com") ? { rejectUnauthorized: false } : false,
      });
      dbQueryFn = (sql: string, params?: any[]) => testPool.query(sql, params);
      return dbQueryFn;
    }
    const db = await import("./db");
    if (!db || typeof db.query !== "function") {
      throw new Error("[Session Engine] Fatal: ./db does not export a valid query function.");
    }
    dbQueryFn = db.query;
  }
  return dbQueryFn;
}

/**
 * BelConnect Server-Side Opaque Sessions
 * 
 * Cryptographically random 32-byte tokens.
 * Only the SHA-256 hash is ever stored in the database.
 * Raw tokens and token hashes are NEVER logged.
 */

export type UserRole = "user" | "provider" | "job_provider" | "admin";
export type AccountStatus = "active" | "suspended";

export interface SessionRecord {
  id: string;
  token_hash: string;
  user_id: string;
  role: UserRole;
  created_at: Date;
  last_seen_at: Date;
  idle_expires_at: Date;
  absolute_expires_at: Date;
  revoked_at: Date | null;
  ip?: string | null;
  user_agent?: string | null;
  device_label?: string | null;
  device_id?: string | null;
  client: "web" | "android" | string;
}

export interface SessionUser {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
  sessionId: string;
  client: string;
  deviceId?: string | null;
  isLegacyAuth?: boolean;
}

export interface CreateSessionOptions {
  userId: string;
  role: UserRole;
  ip?: string | null;
  user_agent?: string | null;
  device_label?: string | null;
  device_id?: string | null;
  client?: "web" | "android" | string;
}

// ─── LIFETIMES ─────────────────────────────────────────────────────────────
// Customer: 30 days sliding idle, 90 days absolute cap
export const CUSTOMER_IDLE_SECONDS = 30 * 24 * 3600;
export const CUSTOMER_ABSOLUTE_SECONDS = 90 * 24 * 3600;

// Provider & Job Provider: 14 days sliding idle, 90 days absolute cap
export const PROVIDER_IDLE_SECONDS = 14 * 24 * 3600;
export const PROVIDER_ABSOLUTE_SECONDS = 90 * 24 * 3600;

// Admin: 30 minutes sliding idle, 8 hours absolute cap
export const ADMIN_IDLE_SECONDS = 30 * 60;
export const ADMIN_ABSOLUTE_SECONDS = 8 * 3600;

// Throttled session touch threshold (60 seconds)
export const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;

// ─── COOKIE NAMES ──────────────────────────────────────────────────────────
// __Host- prefix guarantees Secure, Path=/, and no Domain attribute.
export const COOKIE_NAME_USER = "__Host-session";
export const COOKIE_NAME_ADMIN = "__Host-admin_session";
export const COOKIE_NAME_USER_DEV = "belconnect_session";
export const COOKIE_NAME_ADMIN_DEV = "belconnect_admin_session";

// Allowlisted routes where native Android OkHttp clients may authenticate via Bearer token
export const NATIVE_ANDROID_ALLOWED_ROUTES = [
  /^\/api\/bookings\/[^/]+\/provider-location-native$/,
  /^\/api\/calls\/[^/]+\/reject$/,
  /^\/api\/calls\/[^/]+\/end$/
];

/**
 * Explicit allowlist of non-admin route patterns where the admin session cookie is accepted.
 * Only applied to endpoints that already contain explicit role === 'admin' authorization logic
 * (e.g. viewing KYC documents, attachments, applicant resumes, provider profile details).
 * All other non-admin routes strictly reject the admin cookie.
 */
export const ADMIN_ALLOWED_NON_ADMIN_ROUTE_PATTERNS = [
  /^\/api\/attachments\/.+$/,
  /^\/api\/jobs\/resumes\/.+$/,
  /^\/api\/jobs\/applications\/[^/]+\/resume$/,
  /^\/api\/providers\/[^/]+$/,
  /^\/api\/provider\/kyc$/,
  /^\/api\/provider\/availability$/,
  /^\/api\/ekyc(\/.*)?$/,
  /^\/api\/bookings(\/.*)?$/,
  /^\/api\/services(\/.*)?$/,
  /^\/api\/jobs(\/.*)?$/,
  /^\/api\/jobprovider(\/.*)?$/
];

export function isNonAdminRouteAdminPermitted(pathname: string, method?: string): boolean {
  if (method) {
    const m = method.toUpperCase();
    if (m !== "GET" && m !== "HEAD") return false;
  }
  return ADMIN_ALLOWED_NON_ADMIN_ROUTE_PATTERNS.some((regex) => regex.test(pathname));
}

export class DatabaseUnavailableError extends Error {
  readonly isDatabaseUnavailable = true;
  constructor(message = "Database is temporarily unavailable or connection timed out.") {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

/**
 * Returns role-specific idle and absolute lifetime durations in seconds.
 */
export function getRoleSessionLifetimes(role: UserRole): { idleSeconds: number; absoluteSeconds: number } {
  switch (role) {
    case "admin":
      return { idleSeconds: ADMIN_IDLE_SECONDS, absoluteSeconds: ADMIN_ABSOLUTE_SECONDS };
    case "provider":
    case "job_provider":
      return { idleSeconds: PROVIDER_IDLE_SECONDS, absoluteSeconds: PROVIDER_ABSOLUTE_SECONDS };
    case "user":
    default:
      return { idleSeconds: CUSTOMER_IDLE_SECONDS, absoluteSeconds: CUSTOMER_ABSOLUTE_SECONDS };
  }
}

/**
 * Computes deterministic SHA-256 hex digest of a raw token.
 * Raw tokens are never stored or logged.
 */
export function hashSessionToken(rawToken: string): string {
  if (!rawToken || typeof rawToken !== "string") {
    throw new Error("Cannot hash empty or invalid session token.");
  }
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Generates a cryptographically secure 32-byte opaque session token.
 */
export function generateRawSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Creates a new server-side session in PostgreSQL.
 * Returns the created session metadata and the rawToken to be delivered to the client once.
 */
export async function createSession(
  options: CreateSessionOptions,
  queryRunner?: (sql: string, params: any[]) => Promise<any>
): Promise<{ sessionId: string; rawToken: string; expiresAt: Date; absoluteExpiresAt: Date }> {
  const runner = queryRunner || (await getDefaultQueryRunner());
  const { userId, role, ip, user_agent, device_label, device_id, client = "web" } = options;

  if (!userId || !role) {
    throw new Error("userId and role are required to create a session.");
  }

  const rawToken = generateRawSessionToken();
  const tokenHash = hashSessionToken(rawToken);

  const { idleSeconds, absoluteSeconds } = getRoleSessionLifetimes(role);
  const now = Date.now();
  const idleExpiresAt = new Date(now + idleSeconds * 1000);
  const absoluteExpiresAt = new Date(now + absoluteSeconds * 1000);

  const insertSql = `
    INSERT INTO public.sessions (
      token_hash,
      user_id,
      role,
      created_at,
      last_seen_at,
      idle_expires_at,
      absolute_expires_at,
      revoked_at,
      ip,
      user_agent,
      device_label,
      client,
      device_id
    ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $4, $5, NULL, $6, $7, $8, $9, $10)
    RETURNING id;
  `;

  const result = await runner(insertSql, [
    tokenHash,
    String(userId),
    role,
    idleExpiresAt,
    absoluteExpiresAt,
    ip || null,
    user_agent || null,
    device_label || null,
    client,
    device_id || null
  ]);

  const sessionId = result.rows[0]?.id;
  if (!sessionId) {
    throw new Error("Failed to insert session record into database.");
  }

  return {
    sessionId,
    rawToken,
    expiresAt: idleExpiresAt,
    absoluteExpiresAt
  };
}

/**
 * Validates a session token using ONE SINGLE SQL query.
 * Joins sessions with the appropriate user table (customers, service_providers, job_providers, admins).
 * Evaluates expiry and touch needs directly against CURRENT_TIMESTAMP in PostgreSQL.
 * Instant rejection if:
 * - Session is revoked (revoked_at is not null)
 * - Session is idle expired (CURRENT_TIMESTAMP >= idle_expires_at)
 * - Session reached absolute cap (CURRENT_TIMESTAMP >= absolute_expires_at)
 * - User row was deleted
 * - User account_status is 'suspended'
 * 
 * Automatically slides idle_expires_at (throttled to 60s), strictly capped at absolute_expires_at.
 * Fully awaited for serverless environments.
 */
export async function validateSession(
  rawToken: string,
  queryRunner?: (sql: string, params: any[]) => Promise<any>
): Promise<SessionUser | null> {
  if (!rawToken || typeof rawToken !== "string" || rawToken.trim().length === 0) {
    return null;
  }

  const runner = queryRunner || (await getDefaultQueryRunner());
  const tokenHash = hashSessionToken(rawToken);

  // Single SQL query joining sessions with user tables and DB-authoritative timestamps
  const validateSql = `
    SELECT 
      s.id,
      s.token_hash,
      s.user_id,
      s.role,
      s.created_at,
      s.last_seen_at,
      s.idle_expires_at,
      s.absolute_expires_at,
      s.revoked_at,
      s.client,
      s.device_id,
      (CURRENT_TIMESTAMP >= s.idle_expires_at OR CURRENT_TIMESTAMP >= s.absolute_expires_at) AS is_expired,
      (s.revoked_at IS NOT NULL) AS is_revoked,
      (CURRENT_TIMESTAMP - s.last_seen_at >= INTERVAL '60 seconds') AS needs_touch,
      COALESCE(c.email, sp.email, jp.email, a.email) AS email,
      COALESCE(c.name, sp.name, jp.name, a.email, 'Admin') AS name,
      CASE 
        WHEN s.role = 'user' THEN c.account_status
        WHEN s.role = 'provider' THEN sp.account_status
        WHEN s.role = 'job_provider' THEN jp.account_status
        WHEN s.role = 'admin' THEN 'active'
        ELSE NULL
      END AS account_status,
      CASE
        WHEN s.role = 'user' AND c.id IS NOT NULL THEN TRUE
        WHEN s.role = 'provider' AND sp.id IS NOT NULL THEN TRUE
        WHEN s.role = 'job_provider' AND jp.id IS NOT NULL THEN TRUE
        WHEN s.role = 'admin' AND a.id IS NOT NULL THEN TRUE
        ELSE FALSE
      END AS user_exists
    FROM public.sessions s
    LEFT JOIN public.customers c ON s.role = 'user' AND c.id = s.user_id
    LEFT JOIN public.service_providers sp ON s.role = 'provider' AND sp.id = s.user_id
    LEFT JOIN public.job_providers jp ON s.role = 'job_provider' AND jp.id = s.user_id
    LEFT JOIN public.admins a ON s.role = 'admin' AND a.id = s.user_id
    WHERE s.token_hash = $1;
  `;

  let result;
  try {
    result = await runner(validateSql, [tokenHash]);
  } catch (err: unknown) {
    if (err instanceof DatabaseUnavailableError) throw err;
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[Session Engine] Database query failure in validateSession:", errMsg);
    throw new DatabaseUnavailableError(`Database unavailable during session validation: ${errMsg}`);
  }

  if (!result || result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  // 1. Revocation check
  if (row.is_revoked || row.revoked_at) {
    return null;
  }

  // 2. Expiration checks (evaluated by PostgreSQL CURRENT_TIMESTAMP)
  if (row.is_expired) {
    return null;
  }

  // Secondary clock sanity check
  const now = Date.now();
  const idleExpiresTime = new Date(row.idle_expires_at).getTime();
  const absoluteExpiresTime = new Date(row.absolute_expires_at).getTime();
  if (now >= idleExpiresTime || now >= absoluteExpiresTime) {
    return null;
  }

  // 3. User existence check (account deleted)
  if (!row.user_exists) {
    return null;
  }

  // 4. Account status check (suspended accounts are denied)
  const status = String(row.account_status || "").toLowerCase();
  if (status === "suspended") {
    return null;
  }

  // 5. Throttled touch: update last_seen_at and slide idle_expires_at if > 60s has elapsed
  if (row.needs_touch) {
    const { idleSeconds } = getRoleSessionLifetimes(row.role as UserRole);
    const candidateIdleTime = now + idleSeconds * 1000;
    // Idle expiry must NEVER exceed absolute cap
    const newIdleTime = Math.min(candidateIdleTime, absoluteExpiresTime);
    const newIdleExpiresAt = new Date(newIdleTime);

    // Await touch update (mandatory for serverless environments)
    try {
      await runner(
        `UPDATE public.sessions 
         SET last_seen_at = CURRENT_TIMESTAMP, 
             idle_expires_at = $1 
         WHERE id = $2`,
        [newIdleExpiresAt, row.id]
      );
    } catch (err: any) {
      console.warn("[Session Engine] Non-fatal touch update failure:", err?.message);
    }
  }

  return {
    userId: String(row.user_id),
    email: row.email || "",
    role: row.role as UserRole,
    name: row.name || "",
    sessionId: row.id,
    client: row.client,
    deviceId: row.device_id || null
  };
}

/**
 * Revokes a single session by raw token.
 */
export async function revokeSession(
  rawToken: string,
  queryRunner?: (sql: string, params: any[]) => Promise<any>
): Promise<boolean> {
  if (!rawToken || typeof rawToken !== "string") {
    return false;
  }

  const runner = queryRunner || (await getDefaultQueryRunner());
  const tokenHash = hashSessionToken(rawToken);
  const sql = `
    UPDATE public.sessions 
    SET revoked_at = CURRENT_TIMESTAMP 
    WHERE token_hash = $1 AND revoked_at IS NULL 
    RETURNING id;
  `;

  const result = await runner(sql, [tokenHash]);
  return Boolean(result && result.rowCount && result.rowCount > 0);
}

/**
 * Revokes all active sessions for a user (e.g. password reset, account deletion, admin ban).
 * Optionally excludes a current session ID.
 */
export async function revokeAllSessionsForUser(
  userId: string,
  exceptSessionId?: string,
  queryRunner?: (sql: string, params: any[]) => Promise<any>
): Promise<number> {
  if (!userId) return 0;

  const runner = queryRunner || (await getDefaultQueryRunner());
  let sql = `
    UPDATE public.sessions 
    SET revoked_at = CURRENT_TIMESTAMP 
    WHERE user_id = $1 AND revoked_at IS NULL
  `;
  const params: any[] = [String(userId)];

  if (exceptSessionId) {
    sql += ` AND id != $2`;
    params.push(exceptSessionId);
  }

  sql += ` RETURNING id;`;

  const result = await runner(sql, params);
  return result?.rowCount || 0;
}

// ─── SOCKET TICKETS ────────────────────────────────────────────────────────
/**
 * Issues a single-use WebRTC signaling socket ticket (60s TTL).
 * Hashes the ticket using SHA-256 before inserting into PostgreSQL.
 */
export async function createSocketTicket(
  session: { sessionId: string; userId: string; role: UserRole },
  queryRunner?: (sql: string, params: any[]) => Promise<any>
): Promise<string> {
  const runner = queryRunner || (await getDefaultQueryRunner());
  const rawTicket = crypto.randomBytes(32).toString("base64url");
  const ticketHash = hashSessionToken(rawTicket);

  await runner(
    `INSERT INTO public.socket_tickets (
      ticket_hash,
      session_id,
      user_id,
      role,
      expires_at,
      created_at
    ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + INTERVAL '60 seconds', CURRENT_TIMESTAMP)`,
    [ticketHash, session.sessionId, session.userId, session.role]
  );

  return rawTicket;
}

/**
 * Validates and immediately consumes a single-use socket ticket.
 * Also verifies the parent session has not been revoked or expired.
 */
export async function validateSocketTicket(
  rawTicket: string,
  queryRunner?: (sql: string, params: any[]) => Promise<any>
): Promise<{ sessionId: string; userId: string; role: UserRole } | null> {
  if (!rawTicket || typeof rawTicket !== "string") {
    return null;
  }

  const runner = queryRunner || (await getDefaultQueryRunner());
  const ticketHash = hashSessionToken(rawTicket);

  // Single-use: delete ticket and join session to check revocation
  const sql = `
    DELETE FROM public.socket_tickets st
    USING public.sessions s
    WHERE st.ticket_hash = $1
      AND st.session_id = s.id
      AND st.expires_at > CURRENT_TIMESTAMP
      AND s.revoked_at IS NULL
      AND CURRENT_TIMESTAMP < s.idle_expires_at
      AND CURRENT_TIMESTAMP < s.absolute_expires_at
    RETURNING st.session_id, st.user_id, st.role;
  `;

  const result = await runner(sql, [ticketHash]);
  if (!result || result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    sessionId: row.session_id,
    userId: String(row.user_id),
    role: row.role as UserRole
  };
}

// ─── COOKIE HELPERS ────────────────────────────────────────────────────────

/**
 * Determines whether to use the strict __Host- cookie name and Secure flag.
 * Uses __Host- in production or when explicitly configured.
 */
export function getCookieConfig(role: UserRole, forceSecure?: boolean): { name: string; isSecure: boolean } {
  const isProd = forceSecure ?? (process.env.NODE_ENV === "production");
  if (role === "admin") {
    return {
      name: isProd ? COOKIE_NAME_ADMIN : COOKIE_NAME_ADMIN_DEV,
      isSecure: isProd
    };
  }
  return {
    name: isProd ? COOKIE_NAME_USER : COOKIE_NAME_USER_DEV,
    isSecure: isProd
  };
}

/**
 * Sets the HttpOnly session cookie on a Headers object or Response.
 * Cookie Max-Age is strictly set to the ABSOLUTE lifetime of the role.
 * Idle expiration is dynamically enforced on the server.
 */
export function setSessionCookie(
  headers: Headers,
  rawToken: string,
  role: UserRole,
  forceSecure?: boolean
): void {
  const { name, isSecure } = getCookieConfig(role, forceSecure);
  const { absoluteSeconds } = getRoleSessionLifetimes(role);

  // __Host- cookies require: Secure, Path=/, and no Domain
  let cookieVal = `${name}=${rawToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${absoluteSeconds}`;
  if (isSecure) {
    cookieVal += "; Secure";
  }

  headers.append("Set-Cookie", cookieVal);
}

/**
 * Clears the session cookie on a Headers object or Response.
 */
export function clearSessionCookie(
  headers: Headers,
  role: UserRole = "user",
  forceSecure?: boolean
): void {
  const { name, isSecure } = getCookieConfig(role, forceSecure);
  let cookieVal = `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  if (isSecure) {
    cookieVal += "; Secure";
  }
  headers.append("Set-Cookie", cookieVal);

  // Clear legacy cookie names
  headers.append("Set-Cookie", "auth_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  headers.append("Set-Cookie", "cityconnect_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
}

/**
 * Extracts session token from incoming request.
 * Enforces route-awareness:
 * - /api/admin/* routes read ONLY admin cookies.
 * - Non-admin routes read ONLY user cookies.
 * - Bearer tokens are accepted ONLY for allowlisted Android native routes.
 */
export function getSessionTokenFromRequest(
  request: Request,
  roleHint?: UserRole
): string | null {
  const url = new URL(request.url, "http://localhost");
  const pathname = url.pathname;
  const method = request.method ? request.method.toUpperCase() : "GET";
  const isAdminRoute = pathname.startsWith("/api/admin") || roleHint === "admin";
  const isAllowlistedAdminRoute = isNonAdminRouteAdminPermitted(pathname, method);

  const cookieHeader = request.headers.get("cookie") || "";
  const cookies: Record<string, string> = {};

  if (cookieHeader) {
    const parts = cookieHeader.split(";");
    for (const part of parts) {
      const [k, ...v] = part.trim().split("=");
      if (k) {
        try {
          cookies[k] = decodeURIComponent(v.join("="));
        } catch {
          // Ignore malformed cookies safely
        }
      }
    }
  }

  // Admin routes: ONLY accept admin cookies (no fallback to user cookie)
  if (isAdminRoute) {
    if (cookies[COOKIE_NAME_ADMIN]) return cookies[COOKIE_NAME_ADMIN];
    if (cookies[COOKIE_NAME_ADMIN_DEV]) return cookies[COOKIE_NAME_ADMIN_DEV];
    return null;
  }

  // Non-admin routes: prefer user cookie when present
  if (cookies[COOKIE_NAME_USER]) return cookies[COOKIE_NAME_USER];
  if (cookies[COOKIE_NAME_USER_DEV]) return cookies[COOKIE_NAME_USER_DEV];

  // Allowlisted non-admin routes: accept admin cookie if no user cookie is present
  if (isAllowlistedAdminRoute) {
    if (cookies[COOKIE_NAME_ADMIN]) return cookies[COOKIE_NAME_ADMIN];
    if (cookies[COOKIE_NAME_ADMIN_DEV]) return cookies[COOKIE_NAME_ADMIN_DEV];
  }

  // Bearer token fallback: Allowed ONLY for Android native allowlisted routes
  const isAllowedNativeRoute = NATIVE_ANDROID_ALLOWED_ROUTES.some((regex) => regex.test(pathname));
  if (isAllowedNativeRoute) {
    const authHeader = request.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      if (token) return token;
    }
  }

  return null;
}

/**
 * Phase 2 Dual-Validation Helper: getSessionUser
 * Tries server-side session cookie first.
 * If missing, falls back to legacy JWT (when AUTH_ACCEPT_LEGACY_JWT=true).
 * Logs [LEGACY_AUTH_FALLBACK] with userId and route (never logging token).
 */
export async function getSessionUser(
  request: Request,
  queryRunner?: (sql: string, params: any[]) => Promise<any>
): Promise<SessionUser | null> {
  const url = new URL(request.url, "http://localhost");
  const pathname = url.pathname;
  const isAdminRoute = pathname.startsWith("/api/admin");

  // 1. Try server-side session first
  const sessionToken = getSessionTokenFromRequest(request);
  if (sessionToken) {
    const user = await validateSession(sessionToken, queryRunner);
    if (user) {
      // Defense-in-depth: customer/provider sessions never work on /api/admin/*
      if (isAdminRoute && user.role !== "admin") {
        console.warn(`[Security] Refused non-admin session on admin route: role='${user.role}' on ${pathname}`);
        return null;
      }
      // If request carried Bearer token, ensure session was issued to client='android'
      const authHeader = request.headers.get("authorization") || "";
      if (authHeader.startsWith("Bearer ") && user.client !== "android") {
        console.warn(`[Security] Refused Bearer auth: session client is '${user.client}', expected 'android'`);
        return null;
      }
      return user;
    }
  }

  // Admin routes: legacy fallback is NEVER permitted under any circumstances
  if (isAdminRoute) {
    return null;
  }

  // 2. Dual-validation legacy fallback
  const acceptLegacy = process.env.AUTH_ACCEPT_LEGACY_JWT !== "false";
  if (!acceptLegacy) {
    return null;
  }

  try {
    let legacyUser: any = null;
    try {
      const jwtMod: any = await import("./jwt");
      if (typeof jwtMod.getLegacyJwtUser === "function") {
        legacyUser = jwtMod.getLegacyJwtUser(request);
      }
    } catch {
      try {
        const modName = "./jwt" + ".ts";
        const jwtMod: any = await import(/* webpackIgnore: true */ modName);
        if (typeof jwtMod.getLegacyJwtUser === "function") {
          legacyUser = jwtMod.getLegacyJwtUser(request);
        }
      } catch {
        // Fallback for tests
      }
    }
    if (legacyUser && legacyUser.userId) {
      // 1. Legacy JWTs must NOT be accepted for role 'admin' under any circumstances
      if (legacyUser.role === "admin") {
        console.warn(`[Security] Refused legacy JWT auth: legacy tokens are not permitted for admin role on ${pathname}`);
        return null;
      }

      // 2. Validate user row existence and account_status == 'active' in database
      const runner = queryRunner || (await getDefaultQueryRunner());
      const checkSql = `
        SELECT 
          CASE 
            WHEN $2 = 'user' THEN (SELECT account_status FROM public.customers WHERE id = $1)
            WHEN $2 = 'provider' THEN (SELECT account_status FROM public.service_providers WHERE id = $1)
            WHEN $2 = 'job_provider' THEN (SELECT account_status FROM public.job_providers WHERE id = $1)
            ELSE NULL
          END AS account_status,
          CASE 
            WHEN $2 = 'user' THEN EXISTS(SELECT 1 FROM public.customers WHERE id = $1)
            WHEN $2 = 'provider' THEN EXISTS(SELECT 1 FROM public.service_providers WHERE id = $1)
            WHEN $2 = 'job_provider' THEN EXISTS(SELECT 1 FROM public.job_providers WHERE id = $1)
            ELSE FALSE
          END AS user_exists;
      `;
      let checkRes;
      try {
        checkRes = await runner(checkSql, [String(legacyUser.userId), legacyUser.role]);
      } catch (err: unknown) {
        if (err instanceof DatabaseUnavailableError) throw err;
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error("[Session Engine] Database query failure in legacy fallback:", errMsg);
        throw new DatabaseUnavailableError(`Database unavailable during legacy fallback check: ${errMsg}`);
      }
      const checkRow = checkRes?.rows?.[0];
      if (!checkRow || !checkRow.user_exists || checkRow.account_status !== "active") {
        console.warn(`[Security] Refused legacy JWT auth: user does not exist or account_status != 'active' (userId=${legacyUser.userId}, status=${checkRow?.account_status})`);
        return null;
      }

      // Record durable legacy fallback metric (sharded atomic UPSERT across 16 shards, non-blocking with 500ms cap)
      try {
        const shardId = Math.floor(Math.random() * 16);
        await Promise.race([
          runner(
            `INSERT INTO public.auth_daily_metrics (metric_date, shard_id, legacy_fallback_count, updated_at)
             VALUES (CURRENT_DATE, $1, 1, CURRENT_TIMESTAMP)
             ON CONFLICT (metric_date, shard_id)
             DO UPDATE SET 
               legacy_fallback_count = public.auth_daily_metrics.legacy_fallback_count + 1,
               updated_at = CURRENT_TIMESTAMP`,
            [shardId]
          ),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Telemetry write timeout")), 500))
        ]);
      } catch {
        // Non-fatal: user authentication must never fail on telemetry errors or slow writes
      }

      console.log(
        `[LEGACY_AUTH_FALLBACK] userId=${legacyUser.userId} role=${legacyUser.role} route=${pathname}`
      );
      return {
        userId: String(legacyUser.userId),
        email: legacyUser.email || "",
        role: legacyUser.role as UserRole,
        name: legacyUser.name || "",
        sessionId: "legacy-jwt",
        client: "legacy",
        isLegacyAuth: true
      };
    }
  } catch (err: any) {
    if (err instanceof DatabaseUnavailableError || err?.isDatabaseUnavailable) {
      throw err;
    }
    console.warn("[Session Engine] Legacy auth evaluation error:", err?.message);
  }

  return null;
}
