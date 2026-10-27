const { test, describe } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

describe("Phase 1: Server-Side Opaque Sessions & Architecture", () => {
  const rootDir = path.resolve(__dirname, "../../");
  const migrationPath = path.join(rootDir, "database/migrations/035_server_side_sessions.sql");
  const mirroredMigrationPath = path.join(rootDir, "migrations/035_server_side_sessions.sql");
  const sessionLibPath = path.join(rootDir, "frontend/src/lib/session.ts");

  test("1) Migration 035 defines sessions, socket_tickets, account_status and indexes", () => {
    assert.ok(fs.existsSync(migrationPath), "database/migrations/035_server_side_sessions.sql must exist");
    assert.ok(fs.existsSync(mirroredMigrationPath), "migrations/035_server_side_sessions.sql must exist");

    const sql = fs.readFileSync(migrationPath, "utf8");

    // Table checks
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.sessions"), "Must create sessions table");
    assert.ok(sql.includes("token_hash VARCHAR(64) UNIQUE NOT NULL"), "Must store SHA-256 token_hash");
    assert.ok(sql.includes("user_id VARCHAR(255) NOT NULL"), "Must include user_id compatible with admins and customers");
    assert.ok(sql.includes("role VARCHAR(32) NOT NULL"), "Must include role");
    assert.ok(sql.includes("idle_expires_at TIMESTAMP WITH TIME ZONE NOT NULL"), "Must include idle_expires_at");
    assert.ok(sql.includes("absolute_expires_at TIMESTAMP WITH TIME ZONE NOT NULL"), "Must include absolute_expires_at");
    assert.ok(sql.includes("revoked_at TIMESTAMP WITH TIME ZONE"), "Must include revoked_at");
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.socket_tickets"), "Must create socket_tickets table");
    assert.ok(sql.includes("ticket_hash VARCHAR(64) PRIMARY KEY"), "socket_tickets must store ticket_hash");

    // Account status on customers, service_providers, job_providers
    assert.ok(sql.includes("ALTER TABLE public.customers \n  ADD COLUMN IF NOT EXISTS account_status"), "Must add account_status to customers");
    assert.ok(sql.includes("ALTER TABLE public.service_providers \n  ADD COLUMN IF NOT EXISTS account_status"), "Must add account_status to service_providers");
    assert.ok(sql.includes("ALTER TABLE public.job_providers \n  ADD COLUMN IF NOT EXISTS account_status"), "Must add account_status to job_providers");

    // Indexes & Rollback note
    assert.ok(!sql.includes("CREATE INDEX IF NOT EXISTS idx_sessions_token_hash"), "Redundant token_hash index must be removed");
    assert.ok(sql.includes("CREATE INDEX IF NOT EXISTS idx_sessions_user_lookup"), "Must index user lookup");
    assert.ok(sql.includes("Rollback Note:"), "Must include rollback instructions");
  });

  test("2) Token generation produces 32-byte base64url tokens and SHA-256 hex hashes", async () => {
    const crypto = require("crypto");
    const rawToken = crypto.randomBytes(32).toString("base64url");
    assert.strictEqual(typeof rawToken, "string");
    assert.ok(rawToken.length >= 42, "32 base64url bytes must be >= 42 chars");

    const hash1 = crypto.createHash("sha256").update(rawToken).digest("hex");
    const hash2 = crypto.createHash("sha256").update(rawToken).digest("hex");
    assert.strictEqual(hash1.length, 64, "SHA-256 hex must be 64 characters");
    assert.strictEqual(hash1, hash2, "Hashing must be deterministic");
  });

  test("3) Role-specific lifetimes and absolute cap rules", () => {
    const sessionCode = fs.readFileSync(sessionLibPath, "utf8");

    // Customer: 30 days idle, 90 days absolute
    assert.ok(sessionCode.includes("CUSTOMER_IDLE_SECONDS = 30 * 24 * 3600"), "Customer idle must be 30 days");
    assert.ok(sessionCode.includes("CUSTOMER_ABSOLUTE_SECONDS = 90 * 24 * 3600"), "Customer absolute must be 90 days");

    // Provider / Job Provider: 14 days idle, 90 days absolute
    assert.ok(sessionCode.includes("PROVIDER_IDLE_SECONDS = 14 * 24 * 3600"), "Provider idle must be 14 days");
    assert.ok(sessionCode.includes("PROVIDER_ABSOLUTE_SECONDS = 90 * 24 * 3600"), "Provider absolute must be 90 days");

    // Admin: 30 minutes idle, 8 hours absolute
    assert.ok(sessionCode.includes("ADMIN_IDLE_SECONDS = 30 * 60"), "Admin idle must be 30 minutes");
    assert.ok(sessionCode.includes("ADMIN_ABSOLUTE_SECONDS = 8 * 3600"), "Admin absolute must be 8 hours");
  });

  test("4) validateSession uses ONE single SQL query joining user tables without a.name column", () => {
    const sessionCode = fs.readFileSync(sessionLibPath, "utf8");

    assert.ok(sessionCode.includes("FROM public.sessions s"), "Query must select from sessions");
    assert.ok(sessionCode.includes("LEFT JOIN public.customers c"), "Must LEFT JOIN customers");
    assert.ok(sessionCode.includes("LEFT JOIN public.service_providers sp"), "Must LEFT JOIN service_providers");
    assert.ok(sessionCode.includes("LEFT JOIN public.job_providers jp"), "Must LEFT JOIN job_providers");
    assert.ok(sessionCode.includes("LEFT JOIN public.admins a"), "Must LEFT JOIN admins");
    assert.ok(!sessionCode.includes("COALESCE(c.name, sp.name, jp.name, a.name)"), "Must NOT query non-existent a.name column");
    assert.ok(sessionCode.includes("COALESCE(c.name, sp.name, jp.name, a.email, 'Admin')"), "Must fallback to a.email for admin name");
    assert.ok(sessionCode.includes("WHERE s.token_hash = $1"), "Must lookup by token_hash in single query");
  });

  test("5) Session engine logic: creation, validation, expiration, and account status checks", async () => {
    const mockSessions = new Map();
    const mockUsers = new Map([
      ["cust-1", { id: "cust-1", email: "cust@example.com", name: "Alice", role: "user", account_status: "active" }],
      ["cust-suspended", { id: "cust-suspended", email: "suspended@example.com", name: "Bob", role: "user", account_status: "suspended" }],
      ["prov-1", { id: "prov-1", email: "prov@example.com", name: "Pro Dave", role: "provider", account_status: "active" }],
      ["admin-1", { id: "admin-1", email: "admin@example.com", name: null, role: "admin", account_status: "active" }]
    ]);

    let touchUpdated = false;

    const mockQueryRunner = async (sql, params) => {
      if (sql.includes("INSERT INTO public.sessions")) {
        const [token_hash, user_id, role, idle_expires_at, absolute_expires_at, ip, user_agent, device_label, client] = params;
        const id = "sess-" + Math.random().toString(36).slice(2, 9);
        const record = {
          id,
          token_hash,
          user_id,
          role,
          created_at: new Date(),
          last_seen_at: new Date(),
          idle_expires_at,
          absolute_expires_at,
          revoked_at: null,
          ip,
          user_agent,
          device_label,
          client
        };
        mockSessions.set(token_hash, record);
        return { rows: [{ id }], rowCount: 1 };
      }

      if (sql.includes("FROM public.sessions s") && sql.includes("s.token_hash = $1")) {
        const tokenHash = params[0];
        const s = mockSessions.get(tokenHash);
        if (!s) return { rows: [], rowCount: 0 };

        const u = mockUsers.get(s.user_id);
        const isExpired = Date.now() >= new Date(s.idle_expires_at).getTime() || Date.now() >= new Date(s.absolute_expires_at).getTime();
        const row = {
          id: s.id,
          token_hash: s.token_hash,
          user_id: s.user_id,
          role: s.role,
          created_at: s.created_at,
          last_seen_at: s.last_seen_at,
          idle_expires_at: s.idle_expires_at,
          absolute_expires_at: s.absolute_expires_at,
          revoked_at: s.revoked_at,
          client: s.client,
          is_expired: isExpired,
          is_revoked: Boolean(s.revoked_at),
          needs_touch: false,
          email: u ? u.email : null,
          name: u ? (u.name || u.email) : null,
          account_status: u ? u.account_status : null,
          user_exists: Boolean(u)
        };
        return { rows: [row], rowCount: 1 };
      }

      if (sql.includes("last_seen_at = CURRENT_TIMESTAMP")) {
        touchUpdated = true;
        return { rowCount: 1 };
      }

      if (sql.includes("revoked_at = CURRENT_TIMESTAMP") && sql.includes("token_hash = $1")) {
        const tokenHash = params[0];
        const s = mockSessions.get(tokenHash);
        if (s && !s.revoked_at) {
          s.revoked_at = new Date();
          return { rowCount: 1, rows: [{ id: s.id }] };
        }
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("WHERE user_id = $1 AND revoked_at IS NULL")) {
        const userId = params[0];
        let count = 0;
        for (const s of mockSessions.values()) {
          if (s.user_id === userId && !s.revoked_at) {
            s.revoked_at = new Date();
            count++;
          }
        }
        return { rowCount: count };
      }

      return { rows: [], rowCount: 0 };
    };

    const sessionModule = require(path.join(rootDir, "frontend/src/lib/session.ts"));

    // A) Create active customer session
    const { rawToken, sessionId } = await sessionModule.createSession(
      { userId: "cust-1", role: "user" },
      mockQueryRunner
    );
    assert.ok(rawToken, "Must return rawToken");
    assert.ok(sessionId, "Must return sessionId");

    // B) Validate active session -> returns user profile
    const validUser = await sessionModule.validateSession(rawToken, mockQueryRunner);
    assert.ok(validUser, "Active session must validate successfully");
    assert.strictEqual(validUser.userId, "cust-1");
    assert.strictEqual(validUser.email, "cust@example.com");
    assert.strictEqual(validUser.role, "user");

    // Admin validation does not crash and gets a.email as name
    const { rawToken: adminToken } = await sessionModule.createSession(
      { userId: "admin-1", role: "admin" },
      mockQueryRunner
    );
    const validAdmin = await sessionModule.validateSession(adminToken, mockQueryRunner);
    assert.ok(validAdmin, "Admin session must validate without crash");
    assert.strictEqual(validAdmin.role, "admin");
    assert.strictEqual(validAdmin.name, "admin@example.com");

    // C) Revoke session -> next validation fails immediately
    const revoked = await sessionModule.revokeSession(rawToken, mockQueryRunner);
    assert.strictEqual(revoked, true, "Revoke should return true");
    const afterRevoke = await sessionModule.validateSession(rawToken, mockQueryRunner);
    assert.strictEqual(afterRevoke, null, "Revoked session must be rejected");

    // D) Suspended account -> session rejected
    const { rawToken: suspendedToken } = await sessionModule.createSession(
      { userId: "cust-suspended", role: "user" },
      mockQueryRunner
    );
    const suspendedCheck = await sessionModule.validateSession(suspendedToken, mockQueryRunner);
    assert.strictEqual(suspendedCheck, null, "Suspended customer session must be rejected");

    // E) Deleted account (user_exists = false) -> session rejected
    const { rawToken: deletedUserToken } = await sessionModule.createSession(
      { userId: "cust-deleted-id", role: "user" },
      mockQueryRunner
    );
    const deletedCheck = await sessionModule.validateSession(deletedUserToken, mockQueryRunner);
    assert.strictEqual(deletedCheck, null, "Deleted user session must be rejected");

    // F) Revoke all sessions for user
    const { rawToken: tokenA } = await sessionModule.createSession({ userId: "prov-1", role: "provider" }, mockQueryRunner);
    const { rawToken: tokenB } = await sessionModule.createSession({ userId: "prov-1", role: "provider" }, mockQueryRunner);
    const revokedCount = await sessionModule.revokeAllSessionsForUser("prov-1", undefined, mockQueryRunner);
    assert.strictEqual(revokedCount, 2, "Must revoke all active sessions for provider");

    const checkA = await sessionModule.validateSession(tokenA, mockQueryRunner);
    const checkB = await sessionModule.validateSession(tokenB, mockQueryRunner);
    assert.strictEqual(checkA, null, "All revoked sessions must fail");
    assert.strictEqual(checkB, null, "All revoked sessions must fail");
  });

  test("6) Cookie helpers enforce absolute Max-Age, __Host- prefix, and route separation", () => {
    const sessionModule = require(path.join(rootDir, "frontend/src/lib/session.ts"));

    // Production cookies use __Host- prefix
    const userCookie = sessionModule.getCookieConfig("user", true);
    assert.strictEqual(userCookie.name, "__Host-session", "User production cookie must be __Host-session");
    assert.strictEqual(userCookie.isSecure, true);

    const adminCookie = sessionModule.getCookieConfig("admin", true);
    assert.strictEqual(adminCookie.name, "__Host-admin_session", "Admin production cookie must be __Host-admin_session");
    assert.strictEqual(adminCookie.isSecure, true);

    // Set-Cookie header generation: Max-Age must be ABSOLUTE lifetime (90 days for user, 8 hours for admin)
    const userHeaders = new Headers();
    sessionModule.setSessionCookie(userHeaders, "user-token-123", "user", true);
    const userSetCookie = userHeaders.get("Set-Cookie");
    assert.ok(userSetCookie.includes(`Max-Age=${90 * 24 * 3600}`), "User cookie Max-Age must be 90-day absolute cap");

    const adminHeaders = new Headers();
    sessionModule.setSessionCookie(adminHeaders, "admin-token-123", "admin", true);
    const adminSetCookie = adminHeaders.get("Set-Cookie");
    assert.ok(adminSetCookie.includes(`Max-Age=${8 * 3600}`), "Admin cookie Max-Age must be 8-hour absolute cap");

    // Route-aware extraction
    const mockAdminReq = new Request("https://belconnect.com/api/admin/providers", {
      headers: {
        cookie: "__Host-session=user_token; __Host-admin_session=admin_token"
      }
    });
    const extractedAdminToken = sessionModule.getSessionTokenFromRequest(mockAdminReq);
    assert.strictEqual(extractedAdminToken, "admin_token", "Admin route must read only admin cookie");

    const mockUserReq = new Request("https://belconnect.com/api/bookings", {
      headers: {
        cookie: "__Host-session=user_token; __Host-admin_session=admin_token"
      }
    });
    const extractedUserToken = sessionModule.getSessionTokenFromRequest(mockUserReq);
    assert.strictEqual(extractedUserToken, "user_token", "User route must read only user cookie");

    // Bearer token allowlist testing:
    const mockNativeLocationReq = new Request("https://belconnect.com/api/bookings/B-123/provider-location-native", {
      headers: {
        authorization: "Bearer native_android_token"
      }
    });
    assert.strictEqual(
      sessionModule.getSessionTokenFromRequest(mockNativeLocationReq),
      "native_android_token",
      "Allowlisted native Android route must accept Bearer token"
    );

    const mockDisallowedBearerReq = new Request("https://belconnect.com/api/profile", {
      headers: {
        authorization: "Bearer disallowed_bearer_token"
      }
    });
    assert.strictEqual(
      sessionModule.getSessionTokenFromRequest(mockDisallowedBearerReq),
      null,
      "Disallowed route must reject Bearer token"
    );
  });

  test("7) Security: Raw tokens and token hashes are never exposed in logs or errors", () => {
    const sessionCode = fs.readFileSync(sessionLibPath, "utf8");

    assert.ok(!sessionCode.includes("console.log(rawToken"), "Raw token must never be logged");
    assert.ok(!sessionCode.includes("console.log(tokenHash"), "Token hash must never be logged");
    assert.ok(!sessionCode.includes("console.info(rawToken"), "Raw token must never be logged");
    assert.ok(!sessionCode.includes("console.error(rawToken"), "Raw token must never be logged");
  });
});
