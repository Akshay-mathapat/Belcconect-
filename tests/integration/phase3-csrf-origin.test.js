/**
 * BelConnect - Phase 3 CSRF & Cross-Origin State-Change Integration Tests
 * 
 * Validates CSRF defense on state-changing methods (POST/PUT/PATCH/DELETE):
 * 1. Good Origin -> 200 OK + no-store
 * 2. Bad Origin -> 403 Forbidden + no-store
 * 3. Exact-match security: Subdomain/prefix spoofing (e.g. https://allowed.example.evil.com) -> 403 Forbidden
 * 4. Origin: null -> 403 Forbidden
 * 5. Trailing slash and case insensitivity handled properly
 * 6. Referer fallback -> 200 OK when Origin missing but Referer matches allowlist
 * 7. Missing Origin+Referer on Login -> 403 Forbidden
 * 8. Missing Origin+Referer on Logout -> 403 Forbidden
 * 9. Missing Origin+Referer on Admin Login -> 403 Forbidden
 * 10. Dev & Capacitor origins allowed when CSRF_ALLOW_DEV_ORIGINS=1
 * 11. Dev & Capacitor origins excluded by default in production mode
 * 12. Strict Native Exemption 1: provider-location-native with client='android' passes; with client='web' -> 403
 * 13. Strict Native Exemption 2: calls/[id]/end with client='android' passes; with client='web' -> 403
 * 14. Strict Native Exemption 3: calls/[id]/reject with client='android' passes; with client='web' -> 403
 * 15. native-session NOT exempt for having Bearer header -> 403 without Origin
 * 16. google/mobile/exchange NOT exempt for having Bearer header -> 403 without Origin
 * 17. Arbitrary Authorization header does NOT bypass CSRF on write routes (rejected with 403)
 * 18. Secret routes unaffected: valid CRON_SECRET executes without Origin (HTTP 200)
 * 
 * Runs against live test PostgreSQL (host=localhost:5433 db=belconnect_test).
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");

const { validateTestDatabaseUrl } = require("./db-guard");
const guard = validateTestDatabaseUrl();

const rootDir = path.resolve(__dirname, "../../");
const sessionModule = require(path.join(rootDir, "frontend/src/lib/session.ts"));
const { Pool } = require(path.join(rootDir, "backend/node_modules/pg"));

const suite = guard.shouldRun ? describe : describe.skip;

suite("Phase 3 CSRF / Origin Defense Integration Tests (Real PostgreSQL)", () => {
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

  const queryRunner = (sql, params = []) => pool.query(sql, params);

  const TEST_PREFIX = "p3_csrf_";
  const TEST_USER_ID = `${TEST_PREFIX}user_01`;

  let webSessionToken = "";
  let androidSessionToken = "";
  let webBearerToken = "";

  let postSocketTicket;
  let postNativeSession;
  let postLogout;
  let postLogin;
  let postAdminLogin;
  let postCronCleanup;
  let postProviderLocationNative;
  let postCallEnd;
  let postCallReject;
  let postGoogleMobileExchange;
  let deleteNativeSession;

  before(async () => {
    // Set test secrets & DEV_ORIGINS before importing routes
    process.env.JWT_SECRET = "test_jwt_secret_must_be_at_least_32_characters_long_super_secure!";
    process.env.CRON_SECRET = "test_cron_secret_belconnect_min_32_characters_long";
    process.env.SIGNALING_INTERNAL_SECRET = "test_signaling_secret_belconnect_min_32_characters_long";
    process.env.INTERNAL_API_SECRET = "test_signaling_secret_belconnect_min_32_characters_long";
    process.env.CSRF_ALLOW_DEV_ORIGINS = "1";
    process.env.CSRF_ALLOWED_ORIGINS = "https://belconnect.in,https://admin.belconnect.in";

    // 0. Import real Next.js route handlers
    const ticketMod = await import(pathToFileURL(path.join(rootDir, "frontend/src/app/api/auth/socket-ticket/route.ts")).href);
    postSocketTicket = ticketMod.POST;

    const nativeMod = await import(pathToFileURL(path.join(rootDir, "frontend/src/app/api/auth/native-session/route.ts")).href);
    postNativeSession = nativeMod.POST;
    deleteNativeSession = nativeMod.DELETE;

    const logoutMod = await import(pathToFileURL(path.join(rootDir, "frontend/src/app/api/auth/logout/route.ts")).href);
    postLogout = logoutMod.POST;

    const loginMod = await import(pathToFileURL(path.join(rootDir, "frontend/src/app/api/auth/login/route.ts")).href);
    postLogin = loginMod.POST;

    const adminLoginMod = await import(pathToFileURL(path.join(rootDir, "frontend/src/app/api/admin/auth/login/route.ts")).href);
    postAdminLogin = adminLoginMod.POST;

    const cronMod = await import(pathToFileURL(path.join(rootDir, "frontend/src/app/api/cron/cleanup-sessions/route.ts")).href);
    postCronCleanup = cronMod.POST;

    const locMod = await import(pathToFileURL(path.join(rootDir, "frontend/src/app/api/bookings/[id]/provider-location-native/route.ts")).href);
    postProviderLocationNative = locMod.POST;

    const callEndMod = await import(pathToFileURL(path.join(rootDir, "frontend/src/app/api/calls/[id]/end/route.ts")).href);
    postCallEnd = callEndMod.POST;

    const callRejectMod = await import(pathToFileURL(path.join(rootDir, "frontend/src/app/api/calls/[id]/reject/route.ts")).href);
    postCallReject = callRejectMod.POST;

    const mobileExMod = await import(pathToFileURL(path.join(rootDir, "frontend/src/app/api/auth/google/mobile/exchange/route.ts")).href);
    postGoogleMobileExchange = mobileExMod.POST;

    // 1. Clean test DB
    await pool.query("DELETE FROM public.socket_tickets WHERE user_id LIKE $1", [`${TEST_PREFIX}%`]);
    await pool.query("DELETE FROM public.sessions WHERE user_id LIKE $1", [`${TEST_PREFIX}%`]);
    await pool.query("DELETE FROM public.customers WHERE id LIKE $1", [`${TEST_PREFIX}%`]);

    // 2. Insert test customer
    await pool.query(
      `INSERT INTO public.customers (id, email, name, phone, account_status)
       VALUES ($1, 'csrfuser@example.com', 'CSRF Test User', '+919999900033', 'active')`,
      [TEST_USER_ID]
    );

    // 3. Create active sessions: web session, android native session, web bearer session
    const sessWeb = await sessionModule.createSession(
      { userId: TEST_USER_ID, role: "user", client: "web", ip: "127.0.0.1" },
      queryRunner
    );
    webSessionToken = sessWeb.rawToken;
    webBearerToken = sessWeb.rawToken;

    const sessAndroid = await sessionModule.createSession(
      { userId: TEST_USER_ID, role: "user", client: "android", device_id: "device_csrf_android_01", ip: "127.0.0.1" },
      queryRunner
    );
    androidSessionToken = sessAndroid.rawToken;

    // Set test secrets & DEV_ORIGINS
    process.env.CRON_SECRET = "test_cron_secret_belconnect_min_32_characters_long";
    process.env.SIGNALING_INTERNAL_SECRET = "test_signaling_secret_belconnect_min_32_characters_long";
    process.env.INTERNAL_API_SECRET = "test_signaling_secret_belconnect_min_32_characters_long";
    process.env.CSRF_ALLOW_DEV_ORIGINS = "1";
    process.env.CSRF_ALLOWED_ORIGINS = "https://belconnect.in,https://admin.belconnect.in";
  });

  after(async () => {
    try {
      await pool.query("DELETE FROM public.socket_tickets WHERE user_id LIKE $1", [`${TEST_PREFIX}%`]);
      await pool.query("DELETE FROM public.sessions WHERE user_id LIKE $1", [`${TEST_PREFIX}%`]);
      await pool.query("DELETE FROM public.customers WHERE id LIKE $1", [`${TEST_PREFIX}%`]);
      await pool.end();
      if (globalThis.postgresPool) {
        await globalThis.postgresPool.end().catch(() => {});
        delete globalThis.postgresPool;
      }
    } catch (err) {
      console.error("[Teardown Error in phase3-csrf-origin]:", err);
    }
  });

  // 1. Good Origin -> 200 OK + no-store
  test("1) [GOOD ORIGIN] Allowed Origin header returns HTTP 200 OK + Cache-Control: no-store", async () => {
    const req = new Request("http://localhost:3000/api/auth/socket-ticket", {
      method: "POST",
      headers: {
        "cookie": `__Host-session=${webSessionToken}`,
        "origin": "https://belconnect.in"
      }
    });

    const res = await postSocketTicket(req);
    assert.strictEqual(res.status, 200, "Good origin must return HTTP 200 OK");
    assert.ok(res.headers.get("Cache-Control").includes("no-store"), "Must enforce no-store");
    const json = await res.json();
    assert.ok(json.ticket, "Must return issued ticket");
  });

  // 2. Bad Origin -> 403 Forbidden + no-store
  test("2) [BAD ORIGIN] Disallowed Origin returns HTTP 403 Forbidden + no-store", async () => {
    const req = new Request("http://localhost:3000/api/auth/socket-ticket", {
      method: "POST",
      headers: {
        "cookie": `__Host-session=${webSessionToken}`,
        "origin": "https://attacker.evil.com"
      }
    });

    const res = await postSocketTicket(req);
    assert.strictEqual(res.status, 403, "Bad origin must return HTTP 403 Forbidden");
    assert.ok(res.headers.get("Cache-Control").includes("no-store"), "Must enforce no-store");
    const json = await res.json();
    assert.strictEqual(json.error, "Forbidden: Cross-site request rejected.");
  });

  // 3. Exact-Match Security: Subdomain / prefix spoofing rejected
  test("3) [EXACT-MATCH ATTACK] Subdomain/prefix spoofing (https://belconnect.in.evil.com) returns HTTP 403", async () => {
    const req = new Request("http://localhost:3000/api/auth/socket-ticket", {
      method: "POST",
      headers: {
        "cookie": `__Host-session=${webSessionToken}`,
        "origin": "https://belconnect.in.evil.com"
      }
    });

    const res = await postSocketTicket(req);
    assert.strictEqual(res.status, 403, "Prefix spoofing must return HTTP 403 Forbidden");
    const json = await res.json();
    assert.strictEqual(json.error, "Forbidden: Cross-site request rejected.");
  });

  // 4. Origin: null rejected
  test("4) [ORIGIN NULL] Origin: null returns HTTP 403 Forbidden + no-store", async () => {
    const req = new Request("http://localhost:3000/api/auth/socket-ticket", {
      method: "POST",
      headers: {
        "cookie": `__Host-session=${webSessionToken}`,
        "origin": "null"
      }
    });

    const res = await postSocketTicket(req);
    assert.strictEqual(res.status, 403, "Origin: null must return HTTP 403 Forbidden");
    assert.ok(res.headers.get("Cache-Control").includes("no-store"), "Must enforce no-store");
  });

  // 5. Trailing slash and case handled
  test("5) [TRAILING SLASH & CASE] Upper case and trailing slash origins match allowlist cleanly", async () => {
    const reqUpper = new Request("http://localhost:3000/api/auth/socket-ticket", {
      method: "POST",
      headers: {
        "cookie": `__Host-session=${webSessionToken}`,
        "origin": "HTTPS://BELCONNECT.IN/"
      }
    });

    const res = await postSocketTicket(reqUpper);
    assert.strictEqual(res.status, 200, "Normalized origin must return HTTP 200 OK");
  });

  // 6. Referer fallback
  test("6) [REFERER FALLBACK] Allowed Referer header when Origin missing returns HTTP 200 OK", async () => {
    const req = new Request("http://localhost:3000/api/auth/socket-ticket", {
      method: "POST",
      headers: {
        "cookie": `__Host-session=${webSessionToken}`,
        "referer": "https://belconnect.in/dashboard/settings"
      }
    });

    const res = await postSocketTicket(req);
    assert.strictEqual(res.status, 200, "Valid Referer origin must return HTTP 200 OK");
  });

  // 7. Missing Origin+Referer on Login -> 403
  test("7) [MISSING HEADERS: LOGIN] POST /api/auth/login without Origin/Referer returns HTTP 403", async () => {
    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ email: "csrfuser@example.com", password: "Password123!" })
    });

    const res = await postLogin(req);
    assert.strictEqual(res.status, 403, "Login without Origin/Referer must return HTTP 403 Forbidden");
    assert.ok(res.headers.get("Cache-Control").includes("no-store"));
  });

  // 8. Missing Origin+Referer on Logout -> 403
  test("8) [MISSING HEADERS: LOGOUT] POST /api/auth/logout without Origin/Referer returns HTTP 403", async () => {
    const req = new Request("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        "cookie": `__Host-session=${webSessionToken}`
      }
    });

    const res = await postLogout(req);
    assert.strictEqual(res.status, 403, "Logout without Origin/Referer must return HTTP 403 Forbidden");
    assert.ok(res.headers.get("Cache-Control").includes("no-store"));
  });

  // 9. Missing Origin+Referer on Admin Login -> 403
  test("9) [MISSING HEADERS: ADMIN LOGIN] POST /api/admin/auth/login without Origin/Referer returns HTTP 403", async () => {
    const req = new Request("http://localhost:3000/api/admin/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ email: "admin@example.com", password: "AdminPassword123!" })
    });

    const res = await postAdminLogin(req);
    assert.strictEqual(res.status, 403, "Admin login without Origin/Referer must return HTTP 403 Forbidden");
    assert.ok(res.headers.get("Cache-Control").includes("no-store"));
  });

  // 10. Dev & Capacitor Origins with Env Flag
  test("10) [CAPACITOR WEBVIEW ORIGIN] https://localhost and capacitor://localhost allowed when dev flag active", async () => {
    const req1 = new Request("http://localhost:3000/api/auth/socket-ticket", {
      method: "POST",
      headers: {
        "cookie": `__Host-session=${webSessionToken}`,
        "origin": "https://localhost"
      }
    });
    const res1 = await postSocketTicket(req1);
    assert.strictEqual(res1.status, 200);

    const req2 = new Request("http://localhost:3000/api/auth/socket-ticket", {
      method: "POST",
      headers: {
        "cookie": `__Host-session=${webSessionToken}`,
        "origin": "capacitor://localhost"
      }
    });
    const res2 = await postSocketTicket(req2);
    assert.strictEqual(res2.status, 200);
  });

  // 11. Production Default: Dev and Capacitor excluded
  test("11) [PRODUCTION DEFAULT LIST] When CSRF_ALLOW_DEV_ORIGINS is unset in production, localhost is rejected with 403", async () => {
    const origFlag = process.env.CSRF_ALLOW_DEV_ORIGINS;
    const origEnv = process.env.NODE_ENV;
    delete process.env.CSRF_ALLOW_DEV_ORIGINS;
    delete process.env.ALLOW_DEV_CSRF;
    delete process.env.ALLOW_DEV_ORIGINS;

    try {
      const req = new Request("http://localhost:3000/api/auth/socket-ticket", {
        method: "POST",
        headers: {
          "cookie": `__Host-session=${webSessionToken}`,
          "origin": "capacitor://localhost"
        }
      });
      const res = await postSocketTicket(req);
      assert.strictEqual(res.status, 403, "capacitor://localhost must be rejected when dev flag is unset");
    } finally {
      process.env.CSRF_ALLOW_DEV_ORIGINS = origFlag;
      process.env.NODE_ENV = origEnv;
    }
  });

  // 12a. Strict Native Exemption 1: provider-location-native with client='android'
  test("12a) [NATIVE EXEMPTION 1: provider-location-native] client='android' passes CSRF", async () => {
    const reqAndroid = new Request("http://localhost:3000/api/bookings/test_b1/provider-location-native", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${androidSessionToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ latitude: 12.9716, longitude: 77.5946 })
    });
    const resAndroid = await postProviderLocationNative(reqAndroid, { params: Promise.resolve({ id: "test_b1" }) });
    assert.notStrictEqual(resAndroid.status, 403, "Android Bearer token must be exempt from CSRF on provider-location-native");
  });

  // 12b. Strict Native Exemption 1: provider-location-native with client='web' -> 403
  test("12b) [NATIVE EXEMPTION 1: provider-location-native] client='web' Bearer returns HTTP 403 Forbidden", async () => {
    const reqWeb = new Request("http://localhost:3000/api/bookings/test_b1/provider-location-native", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${webBearerToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ latitude: 12.9716, longitude: 77.5946 })
    });
    const resWeb = await postProviderLocationNative(reqWeb, { params: Promise.resolve({ id: "test_b1" }) });
    assert.strictEqual(resWeb.status, 403, "Web Bearer token must NOT bypass CSRF on provider-location-native");
  });

  // 13a. Strict Native Exemption 2: calls/[id]/end with client='android'
  test("13a) [NATIVE EXEMPTION 2: calls/[id]/end] client='android' passes CSRF", async () => {
    const reqAndroid = new Request("http://localhost:3000/api/calls/test_c1/end", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${androidSessionToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ reason: "normal" })
    });
    const resAndroid = await postCallEnd(reqAndroid, { params: Promise.resolve({ id: "test_c1" }) });
    assert.notStrictEqual(resAndroid.status, 403, "Android Bearer token must be exempt from CSRF on calls/[id]/end");
  });

  // 13b. Strict Native Exemption 2: calls/[id]/end with client='web' -> 403
  test("13b) [NATIVE EXEMPTION 2: calls/[id]/end] client='web' Bearer returns HTTP 403 Forbidden", async () => {
    const reqWeb = new Request("http://localhost:3000/api/calls/test_c1/end", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${webBearerToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ reason: "normal" })
    });
    const resWeb = await postCallEnd(reqWeb, { params: Promise.resolve({ id: "test_c1" }) });
    assert.strictEqual(resWeb.status, 403, "Web Bearer token must NOT bypass CSRF on calls/[id]/end");
  });

  // 14a. Strict Native Exemption 3: calls/[id]/reject with client='android'
  test("14a) [NATIVE EXEMPTION 3: calls/[id]/reject] client='android' passes CSRF", async () => {
    const reqAndroid = new Request("http://localhost:3000/api/calls/test_c2/reject", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${androidSessionToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ reason: "busy" })
    });
    const resAndroid = await postCallReject(reqAndroid, { params: Promise.resolve({ id: "test_c2" }) });
    assert.notStrictEqual(resAndroid.status, 403, "Android Bearer token must be exempt from CSRF on calls/[id]/reject");
  });

  // 14b. Strict Native Exemption 3: calls/[id]/reject with client='web' -> 403
  test("14b) [NATIVE EXEMPTION 3: calls/[id]/reject] client='web' Bearer returns HTTP 403 Forbidden", async () => {
    const reqWeb = new Request("http://localhost:3000/api/calls/test_c2/reject", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${webBearerToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ reason: "busy" })
    });
    const resWeb = await postCallReject(reqWeb, { params: Promise.resolve({ id: "test_c2" }) });
    assert.strictEqual(resWeb.status, 403, "Web Bearer token must NOT bypass CSRF on calls/[id]/reject");
  });

  // 15. native-session NOT exempt for having Bearer header
  test("15) [NON-EXEMPT: native-session] Bearer token does NOT bypass CSRF on /api/auth/native-session (returns 403)", async () => {
    const req = new Request("http://localhost:3000/api/auth/native-session", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${androidSessionToken}`,
        "x-device-id": "device_csrf_android_01"
      }
    });
    const res = await postNativeSession(req);
    assert.strictEqual(res.status, 403, "native-session must require Origin/Referer even with Bearer header");
  });

  // 16. google/mobile/exchange NOT exempt
  test("16) [NON-EXEMPT: google/mobile/exchange] /api/auth/google/mobile/exchange requires Origin/Referer (returns 403)", async () => {
    const req = new Request("http://localhost:3000/api/auth/google/mobile/exchange", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ code: "test_code", deviceId: "device_csrf_android_01" })
    });
    const res = await postGoogleMobileExchange(req);
    assert.strictEqual(res.status, 403, "google/mobile/exchange must require Origin/Referer");
  });

  // 17. Arbitrary Authorization header does NOT bypass CSRF on write routes
  test("17) [ARBITRARY AUTH REJECTION] Arbitrary Bearer header does NOT bypass CSRF on write routes (returns 403)", async () => {
    const req = new Request("http://localhost:3000/api/auth/socket-ticket", {
      method: "POST",
      headers: {
        "authorization": "Bearer arbitrary_fake_token_not_in_db"
        // No Origin or Referer
      }
    });

    const res = await postSocketTicket(req);
    assert.strictEqual(res.status, 403, "Arbitrary Bearer token must NOT bypass CSRF");
  });

  // 18. Secret Route Exemption: CRON_SECRET executes without Origin
  test("18) [SECRET ROUTE EXEMPTION] Secret route (/api/cron/cleanup-sessions) with valid secret executes without Origin", async () => {
    const req = new Request("http://localhost:3000/api/cron/cleanup-sessions", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${process.env.CRON_SECRET}`
      }
    });

    const res = await postCronCleanup(req);
    assert.strictEqual(res.status, 200, "Secret-authenticated cron route must succeed without Origin header");
  });

  // 19. Rollout Safety: CSRF_ENFORCE=0 log-only mode
  test("19) [ROLLOUT SAFETY: CSRF_ENFORCE=0] When CSRF_ENFORCE=0, rejected requests proceed (log-only) instead of 403", async () => {
    const origEnforce = process.env.CSRF_ENFORCE;
    process.env.CSRF_ENFORCE = "0";

    try {
      const req = new Request("http://localhost:3000/api/auth/socket-ticket", {
        method: "POST",
        headers: {
          "cookie": `__Host-session=${webSessionToken}`,
          "origin": "https://attacker.evil.com"
        }
      });

      const res = await postSocketTicket(req);
      assert.strictEqual(res.status, 200, "Under CSRF_ENFORCE=0, request must proceed and return 200");
    } finally {
      if (origEnforce === undefined) {
        delete process.env.CSRF_ENFORCE;
      } else {
        process.env.CSRF_ENFORCE = origEnforce;
      }
    }
  });

  // 20a. Strict Native Exemption: DELETE /api/auth/native-session with client='android'
  test("20a) [NATIVE EXEMPTION 4: DELETE native-session] client='android' Bearer passes CSRF and revokes device session", async () => {
    // Seed an active android session for test
    const tokenBytes = crypto.randomBytes(32);
    const rawToken = tokenBytes.toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const devId = "device_csrf_android_del_01";

    await pool.query(
      `INSERT INTO public.sessions (
        user_id, role, token_hash, client, device_id,
        idle_expires_at, absolute_expires_at
      ) VALUES ($1, 'user', $2, 'android', $3,
        CURRENT_TIMESTAMP + INTERVAL '1 hour',
        CURRENT_TIMESTAMP + INTERVAL '24 hours'
      )`,
      [TEST_USER_ID, tokenHash, devId]
    );

    const reqAndroid = new Request("http://localhost:3000/api/auth/native-session", {
      method: "DELETE",
      headers: {
        "authorization": `Bearer ${rawToken}`
        // No Origin or Referer
      }
    });

    const resAndroid = await deleteNativeSession(reqAndroid);
    assert.strictEqual(resAndroid.status, 200, "Android DELETE native-session must succeed without CSRF block");
    assert.ok(resAndroid.headers.get("Cache-Control").includes("no-store"), "Must return no-store");

    const json = await resAndroid.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.deviceId, devId);

    // Verify row revoked in DB
    const checkDb = await pool.query(
      "SELECT revoked_at FROM public.sessions WHERE token_hash = $1",
      [tokenHash]
    );
    assert.ok(checkDb.rows.length > 0 && checkDb.rows[0].revoked_at !== null, "Session must be revoked in PostgreSQL");
  });

  // 20b. Strict Native Exemption: DELETE /api/auth/native-session with client='web' -> 403 Forbidden
  test("20b) [NATIVE EXEMPTION 4: DELETE native-session] client='web' Bearer returns HTTP 403 Forbidden", async () => {
    const reqWeb = new Request("http://localhost:3000/api/auth/native-session", {
      method: "DELETE",
      headers: {
        "authorization": `Bearer ${webBearerToken}`
        // No Origin or Referer
      }
    });

    const resWeb = await deleteNativeSession(reqWeb);
    assert.strictEqual(resWeb.status, 403, "Web client Bearer must NOT bypass CSRF on DELETE native-session");
  });

  // 20c. Missing Authorization header on DELETE /api/auth/native-session -> 401 Unauthorized
  test("20c) [DELETE native-session] Missing Authorization returns HTTP 401 Unauthorized with no-store", async () => {
    const reqNoAuth = new Request("http://localhost:3000/api/auth/native-session", {
      method: "DELETE",
      headers: {
        "origin": "http://localhost:3000"
      }
    });

    const resNoAuth = await deleteNativeSession(reqNoAuth);
    assert.strictEqual(resNoAuth.status, 401, "Missing Authorization must return 401");
    assert.ok(resNoAuth.headers.get("Cache-Control").includes("no-store"));
  });
});
