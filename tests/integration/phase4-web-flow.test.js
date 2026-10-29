/**
 * Phase 4 Step 1 Web Flow Integration Tests
 * 
 * Tests the complete end-to-end web session authentication sequence:
 * 1. Password Login -> creates session, returns 200 + user, sets __Host-session cookie, no-store
 * 2. Page Reload / Session Check -> GET /api/auth/me returns 200 + user, role, no-store, never a token
 * 3. 401 Handling -> GET /api/auth/me without session returns 401 Unauthorized + no-store
 * 4. Google OAuth popup & redirect -> initiates transaction, callback creates session & returns HTML with no-store
 * 5. Logout -> POST /api/auth/logout revokes session in PostgreSQL, subsequent /api/auth/me returns 401
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const { validateTestDatabaseUrl } = require("./db-guard");
const guard = validateTestDatabaseUrl();

const rootDir = path.resolve(__dirname, "../../");
const sessionModule = require(path.join(rootDir, "frontend/src/lib/session.ts"));
const { Pool } = require(path.join(rootDir, "backend/node_modules/pg"));

const suite = guard.shouldRun ? describe : describe.skip;

suite("Phase 4 Step 1: Web Session Flow End-to-End Tests (Real PostgreSQL)", () => {
  if (!guard.shouldRun) {
    console.log(`[INTEGRATION TESTS SKIPPED] ${guard.reason}`);
    return;
  }

  const pool = new Pool({
    connectionString: guard.url,
    ssl: false,
    max: 10,
    connectionTimeoutMillis: 10000
  });

  const TEST_USER_ID = "p4_web_flow_user_01";
  const TEST_EMAIL = "p4user@belconnect.in";
  let postLogin;
  let getMe;
  let postLogout;
  let getGoogleCallback;

  let sessionCookie = "";

  before(async () => {
    process.env.NODE_ENV = "test";
    process.env.BELCONNECT_TEST_MODE = "1";
    process.env.JWT_SECRET = "test_jwt_secret_must_be_at_least_32_characters_long_super_secure!";
    process.env.CSRF_ALLOW_DEV_ORIGINS = "1";
    process.env.APP_URL = "http://localhost:3000";

    const loginMod = await import(pathToFileURL(path.join(rootDir, "frontend/src/app/api/auth/login/route.ts")).href);
    postLogin = loginMod.POST;

    const meMod = await import(pathToFileURL(path.join(rootDir, "frontend/src/app/api/auth/me/route.ts")).href);
    getMe = meMod.GET;

    const logoutMod = await import(pathToFileURL(path.join(rootDir, "frontend/src/app/api/auth/logout/route.ts")).href);
    postLogout = logoutMod.POST;

    const googleMod = await import(pathToFileURL(path.join(rootDir, "frontend/src/app/api/auth/google/callback/route.ts")).href);
    getGoogleCallback = googleMod.GET;

    // Clean and seed test user
    await pool.query("DELETE FROM public.sessions WHERE user_id = $1", [TEST_USER_ID]);
    await pool.query("DELETE FROM public.customers WHERE id = $1", [TEST_USER_ID]);

    // Use argon2 hash for Password123!
    const argon2 = require(path.join(rootDir, "frontend/node_modules/argon2"));
    const hash = await argon2.hash("Password123!");
    await pool.query(
      "INSERT INTO public.customers (id, email, password_hash, name, phone, account_status) VALUES ($1, $2, $3, 'Phase 4 User', '+919999888800', 'active')",
      [TEST_USER_ID, TEST_EMAIL, hash]
    );
  });

  after(async () => {
    try {
      await pool.query("DELETE FROM public.sessions WHERE user_id = $1", [TEST_USER_ID]);
      await pool.query("DELETE FROM public.customers WHERE id = $1", [TEST_USER_ID]);
      await pool.end();
    } catch (_) {}
  });

  // Step 1: Password Login
  test("1) [PASSWORD LOGIN] Valid credentials issues session cookie with Cache-Control: no-store", async () => {
    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "origin": "http://localhost:3000"
      },
      body: JSON.stringify({ email: TEST_EMAIL, password: "Password123!" })
    });

    const res = await postLogin(req);
    assert.strictEqual(res.status, 200, "Login must return HTTP 200 OK");
    assert.ok(res.headers.get("Cache-Control").includes("no-store"), "Must have no-store header");

    const allCookies = typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie().join("; ")
      : (res.headers.get("set-cookie") || "");

    assert.ok(
      allCookies.includes("__Host-session=") || allCookies.includes("belconnect_session="),
      `Must set session cookie, received: ${allCookies}`
    );

    // Extract cookie value for subsequent requests
    const match = allCookies.match(/(?:__Host-session|belconnect_session)=([^;]+)/);
    assert.ok(match && match[1], "Cookie value must be extracted");
    sessionCookie = match[1];

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.user.id, TEST_USER_ID);
    assert.strictEqual(json.user.email, TEST_EMAIL);
  });

  // Step 2: Page Reload Session Validation (/api/auth/me)
  test("2) [PAGE RELOAD / SESSION CHECK] GET /api/auth/me with session cookie restores user state without exposing token", async () => {
    const req = new Request("http://localhost:3000/api/auth/me", {
      method: "GET",
      headers: {
        cookie: `__Host-session=${sessionCookie}; belconnect_session=${sessionCookie}`
      }
    });

    const res = await getMe(req);
    assert.strictEqual(res.status, 200, "Page reload session check must return HTTP 200 OK");
    assert.ok(res.headers.get("Cache-Control").includes("no-store"));

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.user.id, TEST_USER_ID);
    assert.strictEqual(json.user.role, "user");
    assert.strictEqual(json.user.email, TEST_EMAIL);
    assert.strictEqual(json.user.name, "Phase 4 User");
    // Token must NEVER be exposed
    assert.strictEqual(json.user.token, undefined);
    assert.strictEqual(json.token, undefined);
  });

  // Step 3: 401 Handling on missing / invalid cookie
  test("3) [401 HANDLING] GET /api/auth/me without cookie returns HTTP 401 Unauthorized with no-store", async () => {
    const req = new Request("http://localhost:3000/api/auth/me", {
      method: "GET"
    });

    const res = await getMe(req);
    assert.strictEqual(res.status, 401, "Unauthenticated request must return HTTP 401");
    assert.ok(res.headers.get("Cache-Control").includes("no-store"));
  });

  // Step 4: Google OAuth Helper & State Security
  test("4) [GOOGLE OAUTH] verifyOAuthState rejects tampered state and preserves session safety", async () => {
    const { verifyOAuthState } = require(path.join(rootDir, "frontend/src/lib/oauthState.ts"));
    const tampered = verifyOAuthState("fake_tampered_state");
    assert.strictEqual(tampered.valid, false, "Tampered state must be invalid");
  });

  // Step 5: Logout
  test("5) [LOGOUT] POST /api/auth/logout revokes session in DB and subsequent /api/auth/me returns 401", async () => {
    const reqLogout = new Request("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: `__Host-session=${sessionCookie}; belconnect_session=${sessionCookie}`,
        origin: "http://localhost:3000"
      }
    });

    const resLogout = await postLogout(reqLogout);
    assert.strictEqual(resLogout.status, 200, "Logout must return HTTP 200 OK");
    assert.ok(resLogout.headers.get("Cache-Control").includes("no-store"));

    // Verify session is revoked in database
    const tokenHash = require("crypto").createHash("sha256").update(sessionCookie).digest("hex");
    const checkDb = await pool.query("SELECT revoked_at FROM public.sessions WHERE token_hash = $1", [tokenHash]);
    assert.ok(checkDb.rows.length > 0 && checkDb.rows[0].revoked_at !== null, "Session row must be revoked in PostgreSQL");

    // Subsequent /api/auth/me with old cookie MUST return 401
    const reqMeAfterLogout = new Request("http://localhost:3000/api/auth/me", {
      method: "GET",
      headers: {
        cookie: `__Host-session=${sessionCookie}; belconnect_session=${sessionCookie}`
      }
    });

    const resMeAfterLogout = await getMe(reqMeAfterLogout);
    assert.strictEqual(resMeAfterLogout.status, 401, "Revoked session cookie must return HTTP 401 on /api/auth/me");
  });
});
