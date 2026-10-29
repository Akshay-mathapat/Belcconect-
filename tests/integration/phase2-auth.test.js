/**
 * BelConnect - Phase 2 Authentication & Session Integration Tests
 * Validates login session issuance, logout revocation, suspended accounts,
 * route separation, native Android allowlists, and dual-validation.
 * Strictly requires TEST_DATABASE_URL with 'test' or 'staging' in db name.
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const { validateTestDatabaseUrl } = require("./db-guard");
const guard = validateTestDatabaseUrl();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = "test_jwt_secret_must_be_at_least_32_characters_long_super_secure!";
}

const rootDir = path.resolve(__dirname, "../../");
const sessionModule = require(path.join(rootDir, "frontend/src/lib/session.ts"));
const jwtModule = require(path.join(rootDir, "frontend/src/lib/jwt.ts"));

const suite = guard.shouldRun ? describe : describe.skip;

suite("Phase 2 Authentication & Session Integration Tests", () => {
  if (!guard.shouldRun) {
    console.log(`[INTEGRATION TESTS SKIPPED] ${guard.reason}`);
    return;
  }

  const pgPath = path.join(rootDir, "backend/node_modules/pg");
  const { Pool } = require(pgPath);

  const pool = new Pool({
    connectionString: guard.url,
    ssl: guard.url.includes("render.com") ? { rejectUnauthorized: false } : false,
    max: 5,
    connectionTimeoutMillis: 10000
  });

  const queryRunner = async (sql, params = []) => pool.query(sql, params);

  const TEST_PREFIX = "test_phase2_";
  const TEST_ACTIVE_USER = `${TEST_PREFIX}active_user`;
  const TEST_SUSPENDED_USER = `${TEST_PREFIX}suspended_user`;
  const TEST_ADMIN_USER = `${TEST_PREFIX}admin_user`;

  before(async () => {
    await pool.query("DELETE FROM public.sessions WHERE user_id LIKE $1", [`${TEST_PREFIX}%`]);
    await pool.query("DELETE FROM public.customers WHERE id LIKE $1", [`${TEST_PREFIX}%`]);
    await pool.query("DELETE FROM public.admins WHERE id LIKE $1", [`${TEST_PREFIX}%`]);

    await pool.query(
      `INSERT INTO public.customers (id, email, name, phone, account_status)
       VALUES ($1, 'phase2.active@belconnect.com', 'Phase2 Active', '9123456780', 'active')`,
      [TEST_ACTIVE_USER]
    );

    await pool.query(
      `INSERT INTO public.customers (id, email, name, phone, account_status)
       VALUES ($1, 'phase2.suspended@belconnect.com', 'Phase2 Suspended', '9123456781', 'suspended')`,
      [TEST_SUSPENDED_USER]
    );

    await pool.query(
      `INSERT INTO public.admins (id, email, password_hash)
       VALUES ($1, 'phase2.admin@belconnect.com', '$argon2id$mocked')`,
      [TEST_ADMIN_USER]
    );
  });

  after(async () => {
    try {
      await pool.query("DELETE FROM public.sessions WHERE user_id LIKE $1", [`${TEST_PREFIX}%`]);
      await pool.query("DELETE FROM public.customers WHERE id LIKE $1", [`${TEST_PREFIX}%`]);
      await pool.query("DELETE FROM public.admins WHERE id LIKE $1", [`${TEST_PREFIX}%`]);
      await pool.end();
      if (globalThis.postgresPool) {
        await globalThis.postgresPool.end().catch(() => {});
        delete globalThis.postgresPool;
      }
    } catch (err) {
      console.error("[Teardown Error in phase2-auth]:", err);
    }
  });

  test("1) Login sets the session cookie with the right name and absolute Max-Age flags", async () => {
    const { rawToken } = await sessionModule.createSession(
      { userId: TEST_ACTIVE_USER, role: "user" },
      queryRunner
    );

    const headers = new Headers();
    sessionModule.setSessionCookie(headers, rawToken, "user", true);

    const setCookie = headers.get("Set-Cookie");
    assert.ok(setCookie.includes("__Host-session="), "Production user cookie must use __Host-session");
    assert.ok(setCookie.includes("Path=/"), "Must have Path=/");
    assert.ok(setCookie.includes("HttpOnly"), "Must be HttpOnly");
    assert.ok(setCookie.includes("Secure"), "Must be Secure");
    assert.ok(setCookie.includes("SameSite=Lax"), "Must be SameSite=Lax");
    assert.ok(setCookie.includes(`Max-Age=${90 * 24 * 3600}`), "Max-Age must be absolute 90 days cap");
    assert.ok(!setCookie.includes("Domain="), "__Host- cookie must NEVER specify Domain");
  });

  test("2) Logout revokes session (old cookie -> 401 unauthenticated)", async () => {
    const { rawToken } = await sessionModule.createSession(
      { userId: TEST_ACTIVE_USER, role: "user" },
      queryRunner
    );

    const beforeLogout = await sessionModule.validateSession(rawToken, queryRunner);
    assert.ok(beforeLogout, "Session must be active before logout");

    const revoked = await sessionModule.revokeSession(rawToken, queryRunner);
    assert.strictEqual(revoked, true);

    const afterLogout = await sessionModule.validateSession(rawToken, queryRunner);
    assert.strictEqual(afterLogout, null, "Revoked session cookie must fail with 401");
  });

  test("3) Suspended account session is rejected immediately upon validation", async () => {
    const { rawToken } = await sessionModule.createSession(
      { userId: TEST_SUSPENDED_USER, role: "user" },
      queryRunner
    );

    const check = await sessionModule.validateSession(rawToken, queryRunner);
    assert.strictEqual(check, null, "Suspended account must be rejected on validation");
  });

  test("4) Admin cookie does not authenticate a normal user write route", async () => {
    const { rawToken: adminToken } = await sessionModule.createSession(
      { userId: TEST_ADMIN_USER, role: "admin" },
      queryRunner
    );

    const userReq = new Request("https://belconnect.com/api/bookings", {
      method: "POST",
      headers: {
        cookie: `__Host-admin_session=${adminToken}`
      }
    });

    const tokenForUserRoute = sessionModule.getSessionTokenFromRequest(userReq);
    assert.strictEqual(
      tokenForUserRoute,
      null,
      "Admin cookie must NEVER be accepted on non-admin write routes"
    );

    const adminReq = new Request("https://belconnect.com/api/admin/providers", {
      headers: {
        cookie: `__Host-session=user_raw_token`
      }
    });

    const tokenForAdminRoute = sessionModule.getSessionTokenFromRequest(adminReq);
    assert.strictEqual(
      tokenForAdminRoute,
      null,
      "User cookie must NEVER be accepted on admin routes"
    );
  });

  test("5) Android Bearer token is accepted only on allowlisted routes and only with client='android'", async () => {
    const androidSession = await sessionModule.createSession(
      { userId: TEST_ACTIVE_USER, role: "user", client: "android" },
      queryRunner
    );

    const locationReq = new Request("https://belconnect.com/api/bookings/B-12345/provider-location-native", {
      method: "POST",
      headers: {
        authorization: `Bearer ${androidSession.rawToken}`
      }
    });
    const locationToken = sessionModule.getSessionTokenFromRequest(locationReq);
    assert.strictEqual(locationToken, androidSession.rawToken);

    const locationUser = await sessionModule.getSessionUser(locationReq, queryRunner);
    assert.ok(locationUser, "Android client Bearer must succeed on allowlisted location route");
    assert.strictEqual(locationUser.userId, TEST_ACTIVE_USER);

    const rejectReq = new Request("https://belconnect.com/api/calls/call-999/reject", {
      method: "POST",
      headers: {
        authorization: `Bearer ${androidSession.rawToken}`
      }
    });
    assert.strictEqual(sessionModule.getSessionTokenFromRequest(rejectReq), androidSession.rawToken);

    const profileReq = new Request("https://belconnect.com/api/profile", {
      headers: {
        authorization: `Bearer ${androidSession.rawToken}`
      }
    });
    assert.strictEqual(sessionModule.getSessionTokenFromRequest(profileReq), null);

    const webSession = await sessionModule.createSession(
      { userId: TEST_ACTIVE_USER, role: "user", client: "web" },
      queryRunner
    );
    const spoofReq = new Request("https://belconnect.com/api/bookings/B-12345/provider-location-native", {
      method: "POST",
      headers: {
        authorization: `Bearer ${webSession.rawToken}`
      }
    });
    const spoofUser = await sessionModule.getSessionUser(spoofReq, queryRunner);
    assert.strictEqual(spoofUser, null, "Bearer token from client='web' must be rejected");
  });

  test("6) Dual-validation: legacy JWT fallback logs [LEGACY_AUTH_FALLBACK] when session cookie is absent", async () => {
    const legacyJwt = jwtModule.signJwtToken({
      userId: TEST_ACTIVE_USER,
      email: "phase2.active@belconnect.com",
      role: "user",
      name: "Phase2 Active"
    });

    const interceptedLogs = [];
    const originalLog = console.log;
    console.log = (...args) => {
      interceptedLogs.push(args.join(" "));
      originalLog(...args);
    };

    try {
      const legacyReq = new Request("https://belconnect.com/api/bookings", {
        headers: {
          cookie: `auth_token=${legacyJwt}`
        }
      });

      const user = await sessionModule.getSessionUser(legacyReq, queryRunner);
      assert.ok(user, "Legacy JWT fallback must validate");
      assert.strictEqual(user.userId, TEST_ACTIVE_USER);
      assert.strictEqual(user.isLegacyAuth, true);

      const fallbackLog = interceptedLogs.find(l => l.includes("[LEGACY_AUTH_FALLBACK]"));
      assert.ok(fallbackLog, "Must log [LEGACY_AUTH_FALLBACK]");
      assert.ok(fallbackLog.includes(`userId=${TEST_ACTIVE_USER}`), "Must include userId in fallback log");
      assert.ok(fallbackLog.includes("route=/api/bookings"), "Must include route in fallback log");
      assert.ok(!fallbackLog.includes(legacyJwt), "Must NEVER log the token itself");
    } finally {
      console.log = originalLog;
    }
  });

  // 7. GET /api/auth/me: Valid opaque cookie session
  test("7) GET /api/auth/me with valid opaque session cookie returns HTTP 200 OK, user profile, role, no-store, and never a token", async () => {
    const meMod = await import(pathToFileURL(path.join(rootDir, "frontend/src/app/api/auth/me/route.ts")).href);
    const getMe = meMod.GET;

    const session = await sessionModule.createSession(
      { userId: TEST_ACTIVE_USER, role: "user", client: "web" },
      queryRunner
    );

    const req = new Request("http://localhost:3000/api/auth/me", {
      method: "GET",
      headers: {
        cookie: `__Host-session=${session.rawToken}`
      }
    });

    const res = await getMe(req);
    assert.strictEqual(res.status, 200, "Valid session cookie must return HTTP 200 OK");
    assert.ok(res.headers.get("Cache-Control").includes("no-store"), "Must have Cache-Control: no-store");

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.user.id, TEST_ACTIVE_USER);
    assert.strictEqual(json.user.role, "user");
    assert.strictEqual(json.user.email, "phase2.active@belconnect.com");
    // Invariant: NEVER expose token in /api/auth/me
    assert.strictEqual(json.user.token, undefined, "user.token must NOT be present");
    assert.strictEqual(json.user.rawToken, undefined, "user.rawToken must NOT be present");
    assert.strictEqual(json.token, undefined, "response.token must NOT be present");
  });

  // 8. GET /api/auth/me: Missing cookie -> 401
  test("8) GET /api/auth/me without session cookie returns HTTP 401 Unauthorized with no-store", async () => {
    const meMod = await import(pathToFileURL(path.join(rootDir, "frontend/src/app/api/auth/me/route.ts")).href);
    const getMe = meMod.GET;

    const req = new Request("http://localhost:3000/api/auth/me", {
      method: "GET"
    });

    const res = await getMe(req);
    assert.strictEqual(res.status, 401, "Missing session must return HTTP 401 Unauthorized");
    assert.ok(res.headers.get("Cache-Control").includes("no-store"), "Must have Cache-Control: no-store");
  });

  // 9. GET /api/auth/me: Dual-validation legacy JWT fallback
  test("9) GET /api/auth/me with legacy JWT fallback returns HTTP 200 OK and user profile", async () => {
    const meMod = await import(pathToFileURL(path.join(rootDir, "frontend/src/app/api/auth/me/route.ts")).href);
    const getMe = meMod.GET;

    const legacyJwt = jwtModule.signJwtToken({
      userId: TEST_ACTIVE_USER,
      email: "phase2.active@belconnect.com",
      role: "user",
      name: "Phase2 Active"
    });

    const req = new Request("http://localhost:3000/api/auth/me", {
      method: "GET",
      headers: {
        authorization: `Bearer ${legacyJwt}`
      }
    });

    const res = await getMe(req);
    assert.strictEqual(res.status, 200, "Valid legacy JWT must return HTTP 200 OK");
    assert.ok(res.headers.get("Cache-Control").includes("no-store"));
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.user.id, TEST_ACTIVE_USER);
    assert.strictEqual(json.token, undefined);
  });
});
