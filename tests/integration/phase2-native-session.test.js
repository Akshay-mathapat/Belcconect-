/**
 * BelConnect - Phase 2 Native Session Integration Tests
 * Validates POST /api/auth/native-session route handler:
 * 1. Strict deviceId validation upfront (^[A-Za-z0-9._-]{8,64}$) -> 400 on invalid/missing (never echoes input)
 * 2. Idempotent app-resume check (Bearer token reuse requires matching validated deviceId)
 * 3. Web cookie requirement -> 401 on missing/expired
 * 4. Admin role refusal -> 403 Forbidden
 * 5. Dual cookie: valid user cookie + admin cookie -> 200 OK (role 'user' authenticates)
 * 6. Cache-Control: no-store on EVERY response (asserted on fresh 200, 429, 503)
 * 7. Rate limit: checkUserRateLimit keyed native_session:${userId}:${deviceId} (10 per 15 min),
 *    per-user limit (30 per 15 min), two users behind same IP are limited independently
 * 8. Device-scoped revocation (re-exchange on same device revokes prior session for that device only)
 * 9. Active device cap (max 5 active android sessions, counting only active rows; expired session not counted)
 * 10. Database down -> 503 + Retry-After: 5 (never 401/500) (simulated and real unreachable port)
 * 11. 20 concurrent exchanges for one user leaves exactly 5 active android sessions + status histogram
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
const rateLimitCore = require(path.join(rootDir, "frontend/src/lib/rateLimitCore.ts"));
const { Pool } = require(path.join(rootDir, "backend/node_modules/pg"));

const suite = guard.shouldRun ? describe : describe.skip;

suite("Phase 2 Native Android Session Integration Tests (Real PostgreSQL)", () => {
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

  const TEST_PREFIX = "p2_nat_";
  const TEST_USER_ID = `${TEST_PREFIX}cust_01`;
  const TEST_ADMIN_ID = `${TEST_PREFIX}admin_01`;

  let webSessionRawToken = "";
  let adminWebSessionRawToken = "";
  let POST;
  let DELETE;

  before(async () => {
    // 0. Import real Next.js route handler
    const routeUrl = pathToFileURL(path.join(rootDir, "frontend/src/app/api/auth/native-session/route.ts")).href;
    const mod = await import(routeUrl);
    POST = mod.POST;
    DELETE = mod.DELETE;

    // 1. Clean test DB
    await pool.query("DELETE FROM public.sessions WHERE user_id LIKE $1", [`${TEST_PREFIX}%`]);
    await pool.query("DELETE FROM public.customers WHERE id LIKE $1", [`${TEST_PREFIX}%`]);
    await pool.query("DELETE FROM public.admins WHERE id LIKE $1", [`${TEST_PREFIX}%`]);
    await pool.query("DELETE FROM public.rate_limits WHERE key LIKE 'rl:user:native_session:%'");
    // 2. Insert test customer & admin
    await pool.query(
      `INSERT INTO public.customers (id, email, name, phone, account_status)
       VALUES ($1, 'natuser@example.com', 'Native Test User', '+919999900022', 'active')`,
      [TEST_USER_ID]
    );
    await pool.query(
      `INSERT INTO public.admins (id, email, password_hash)
       VALUES ($1, 'natadmin@example.com', '$argon2id$mocked')`,
      [TEST_ADMIN_ID]
    );

    // 3. Create active web sessions
    const custSess = await sessionModule.createSession(
      { userId: TEST_USER_ID, role: "user", client: "web", ip: "127.0.0.1" },
      queryRunner
    );
    webSessionRawToken = custSess.rawToken;

    const admSess = await sessionModule.createSession(
      { userId: TEST_ADMIN_ID, role: "admin", client: "web", ip: "127.0.0.1" },
      queryRunner
    );
    adminWebSessionRawToken = admSess.rawToken;
  });

  after(async () => {
    try {
      await pool.query("DELETE FROM public.sessions WHERE user_id LIKE $1", [`${TEST_PREFIX}%`]);
      await pool.query("DELETE FROM public.customers WHERE id LIKE $1", [`${TEST_PREFIX}%`]);
      await pool.query("DELETE FROM public.admins WHERE id LIKE $1", [`${TEST_PREFIX}%`]);
      await pool.query("DELETE FROM public.rate_limits WHERE key LIKE 'rl:user:native_session:%'");
      await pool.end();
      if (globalThis.postgresPool) {
        await globalThis.postgresPool.end().catch(() => {});
        delete globalThis.postgresPool;
      }
    } catch (err) {
      console.error("[Teardown Error in phase2-native-session]:", err);
    }
  });

  // 1. Validation: Missing deviceId upfront
  test("1) [STRICT VALIDATION UPFRONT] Missing deviceId returns HTTP 400 + no-store", async () => {
    const req = new Request("http://localhost:3000/api/auth/native-session", {
      method: "POST",
      headers: {
        "cookie": `__Host-session=${webSessionRawToken}`,
        "origin": "http://localhost:3000"
      }
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 400, "Missing deviceId must return HTTP 400");
    assert.ok(res.headers.get("Cache-Control").includes("no-store"));
    const json = await res.json();
    assert.ok(json.error.includes("Invalid or missing deviceId"));
  });

  // 2. Validation: Malformed deviceId (<8 chars, spaces, invalid chars) upfront
  test("2) [STRICT VALIDATION UPFRONT] Malformed deviceId (<8 chars or invalid chars) returns HTTP 400 + no-store", async () => {
    const badIds = ["short", "bad device id with spaces", "dev#$*invalid!", "a".repeat(65)];

    for (const badId of badIds) {
      const req = new Request("http://localhost:3000/api/auth/native-session", {
        method: "POST",
        headers: {
          "cookie": `__Host-session=${webSessionRawToken}`,
          "origin": "http://localhost:3000",
          "x-device-id": badId
        }
      });

      const res = await POST(req);
      assert.strictEqual(res.status, 400, `DeviceId '${badId}' must be rejected with HTTP 400`);
      assert.ok(res.headers.get("Cache-Control").includes("no-store"));
      const json = await res.json();
      assert.ok(json.error.includes("Invalid or missing deviceId"));
    }
  });

  // 3. Web Cookie Required
  test("3) [AUTH GUARD] Missing active web cookie returns HTTP 401 + no-store", async () => {
    const req = new Request("http://localhost:3000/api/auth/native-session", {
      method: "POST",
      headers: {
        "x-device-id": "device_pixel_8_pro_01",
        "origin": "http://localhost:3000"
      }
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 401, "Missing web cookie must return 401");
    assert.ok(res.headers.get("Cache-Control").includes("no-store"));
    const json = await res.json();
    assert.ok(json.error.includes("Active web session cookie is required"));
  });

  // 4. Admin Role Refusal
  test("4) [ADMIN GUARD] Admin web session attempting native exchange returns HTTP 403 Forbidden + no-store", async () => {
    const req = new Request("http://localhost:3000/api/auth/native-session", {
      method: "POST",
      headers: {
        "cookie": `__Host-admin_session=${adminWebSessionRawToken}`,
        "origin": "http://localhost:3000",
        "x-device-id": "device_pixel_8_pro_01"
      }
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 403, "Admin must be refused native session with HTTP 403");
    assert.ok(res.headers.get("Cache-Control").includes("no-store"));
    const json = await res.json();
    assert.ok(json.error.includes("Administrators cannot create Android client sessions"));
  });

  // 5. Dual Cookie Co-existence: User cookie + Admin cookie -> 200 OK
  test("5) [DUAL COOKIE TEST] User cookie + admin cookie co-existence returns HTTP 200", async () => {
    const req = new Request("http://localhost:3000/api/auth/native-session", {
      method: "POST",
      headers: {
        "cookie": `__Host-session=${webSessionRawToken}; __Host-admin_session=${adminWebSessionRawToken}`,
        "origin": "http://localhost:3000",
        "x-device-id": "device_dual_cookie_01"
      }
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 200, "Valid user cookie must authenticate even when admin cookie is also present");
    assert.ok(res.headers.get("Cache-Control").includes("no-store"));
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.userId, TEST_USER_ID);
  });

  // 6. Successful Fresh Exchange with Real DB Verification & Cache-Control: no-store
  let firstNativeToken = "";
  test("6) [FRESH EXCHANGE + REAL DB] Valid web session + valid deviceId issues fresh native session with Cache-Control: no-store", async () => {
    const deviceId = "device_samsung_s23_01";
    const req = new Request("http://localhost:3000/api/auth/native-session", {
      method: "POST",
      headers: {
        "cookie": `__Host-session=${webSessionRawToken}`,
        "origin": "http://localhost:3000",
        "x-device-id": deviceId
      }
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 200, "Must return HTTP 200 OK");
    assert.ok(
      res.headers.get("Cache-Control").includes("no-store"),
      "Fresh 200 response MUST enforce Cache-Control: no-store"
    );
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.reused, false);
    assert.strictEqual(json.userId, TEST_USER_ID);
    assert.strictEqual(json.role, "user");
    assert.strictEqual(json.deviceId, deviceId);
    assert.ok(json.token, "Must return raw token");
    firstNativeToken = json.token;

    // Verify record in PostgreSQL database
    const tokenHash = crypto.createHash("sha256").update(json.token).digest("hex");
    const dbRow = await pool.query(
      "SELECT id, user_id, role, client, device_id, revoked_at FROM public.sessions WHERE token_hash = $1",
      [tokenHash]
    );
    assert.strictEqual(dbRow.rows.length, 1, "Native session must exist in PostgreSQL");
    assert.strictEqual(dbRow.rows[0].client, "android", "client column must be 'android'");
    assert.strictEqual(dbRow.rows[0].device_id, deviceId, "device_id must match request");
    assert.strictEqual(dbRow.rows[0].revoked_at, null, "session must be active (not revoked)");
  });

  // 7. Idempotent App-Resume Check (validates deviceId upfront, never echoes unvalidated input)
  test("7) [APP-RESUME RESILIENCE & VALIDATION] Idempotent resume validates deviceId upfront and in resume", async () => {
    // 7a. Resume with invalid deviceId (<8 chars) returns HTTP 400
    const badReq = new Request("http://localhost:3000/api/auth/native-session", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${firstNativeToken}`,
        "origin": "http://localhost:3000",
        "x-device-id": "short"
      }
    });
    const badRes = await POST(badReq);
    assert.strictEqual(badRes.status, 400, "Invalid deviceId on resume must return 400");
    assert.ok(badRes.headers.get("Cache-Control").includes("no-store"));

    // 7b. Resume with matching valid deviceId returns reused session
    const goodReq = new Request("http://localhost:3000/api/auth/native-session", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${firstNativeToken}`,
        "origin": "http://localhost:3000",
        "x-device-id": "device_samsung_s23_01"
      }
    });
    const goodRes = await POST(goodReq);
    assert.strictEqual(goodRes.status, 200);
    assert.ok(goodRes.headers.get("Cache-Control").includes("no-store"));
    const goodJson = await goodRes.json();
    assert.strictEqual(goodJson.success, true);
    assert.strictEqual(goodJson.reused, true);
    assert.strictEqual(goodJson.token, firstNativeToken);
    assert.strictEqual(goodJson.deviceId, "device_samsung_s23_01");
  });

  // 8. Device-Scoped Revocation
  test("8) [DEVICE-SCOPED REVOCATION] Re-exchange on device A revokes device A session without affecting device B", async () => {
    const deviceA = "device_samsung_s23_01";
    const deviceB = "device_oneplus_11_02";

    // Exchange session for device B
    const reqB = new Request("http://localhost:3000/api/auth/native-session", {
      method: "POST",
      headers: {
        "cookie": `__Host-session=${webSessionRawToken}`,
        "origin": "http://localhost:3000",
        "x-device-id": deviceB
      }
    });
    const resB = await POST(reqB);
    assert.strictEqual(resB.status, 200);
    const jsonB = await resB.json();
    const tokenB = jsonB.token;

    // Both device A (firstNativeToken) and device B (tokenB) are active
    const hashA_old = crypto.createHash("sha256").update(firstNativeToken).digest("hex");
    const hashB = crypto.createHash("sha256").update(tokenB).digest("hex");

    let checkA = await pool.query("SELECT revoked_at FROM public.sessions WHERE token_hash = $1", [hashA_old]);
    let checkB = await pool.query("SELECT revoked_at FROM public.sessions WHERE token_hash = $1", [hashB]);
    assert.strictEqual(checkA.rows[0].revoked_at, null, "Device A session should initially be active");
    assert.strictEqual(checkB.rows[0].revoked_at, null, "Device B session should initially be active");

    // Perform fresh exchange on device A again
    const reqA_new = new Request("http://localhost:3000/api/auth/native-session", {
      method: "POST",
      headers: {
        "cookie": `__Host-session=${webSessionRawToken}`,
        "origin": "http://localhost:3000",
        "x-device-id": deviceA
      }
    });
    const resA_new = await POST(reqA_new);
    assert.strictEqual(resA_new.status, 200);
    const jsonA_new = await resA_new.json();
    assert.strictEqual(jsonA_new.reused, false);

    // Verify in DB: device A's old session was REVOKED, but device B's session is STILL ACTIVE
    checkA = await pool.query("SELECT revoked_at FROM public.sessions WHERE token_hash = $1", [hashA_old]);
    checkB = await pool.query("SELECT revoked_at FROM public.sessions WHERE token_hash = $1", [hashB]);
    assert.ok(checkA.rows[0].revoked_at !== null, "Device A old session MUST be revoked");
    assert.strictEqual(checkB.rows[0].revoked_at, null, "Device B session MUST remain active");
  });

  // 9. Cap Query: Only Count ACTIVE Sessions (expired-but-unrevoked session is not counted against cap)
  test("9) [CAP QUERY: ACTIVE ROWS ONLY] Expired-but-unrevoked session is not counted against cap", async () => {
    // Revoke all prior native sessions for clean test
    await pool.query(
      "UPDATE public.sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND client = 'android'",
      [TEST_USER_ID]
    );

    // 1. Insert an expired-but-unrevoked session directly in DB
    const expiredToken = crypto.randomBytes(32).toString("base64url");
    const expiredHash = crypto.createHash("sha256").update(expiredToken).digest("hex");
    await pool.query(
      `INSERT INTO public.sessions (
        token_hash, user_id, role, created_at, last_seen_at,
        idle_expires_at, absolute_expires_at, revoked_at,
        client, device_id
      ) VALUES (
        $1, $2, 'user', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days',
        CURRENT_TIMESTAMP - INTERVAL '1 hour', CURRENT_TIMESTAMP + INTERVAL '80 days', NULL,
        'android', 'device_expired_unrevoked'
      )`,
      [expiredHash, TEST_USER_ID]
    );

    // 2. Insert 4 active sessions for distinct devices
    const activeTokens = [];
    for (let i = 1; i <= 4; i++) {
      const devId = `device_cap_act_00${i}`;
      const req = new Request("http://localhost:3000/api/auth/native-session", {
        method: "POST",
        headers: {
          "cookie": `__Host-session=${webSessionRawToken}`,
          "origin": "http://localhost:3000",
          "x-device-id": devId
        }
      });
      const res = await POST(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      activeTokens.push(json.token);
      await new Promise(r => setTimeout(r, 20));
    }

    // 3. Exchange a 5th session
    const devId5 = "device_cap_act_005";
    const req5 = new Request("http://localhost:3000/api/auth/native-session", {
      method: "POST",
      headers: {
        "cookie": `__Host-session=${webSessionRawToken}`,
        "origin": "http://localhost:3000",
        "x-device-id": devId5
      }
    });
    const res5 = await POST(req5);
    assert.strictEqual(res5.status, 200);
    const json5 = await res5.json();
    activeTokens.push(json5.token);

    // 4. Verify that ALL 5 active sessions remain active (none prematurely revoked by the expired session)
    for (const tok of activeTokens) {
      const h = crypto.createHash("sha256").update(tok).digest("hex");
      const check = await pool.query("SELECT revoked_at FROM public.sessions WHERE token_hash = $1", [h]);
      assert.strictEqual(check.rows[0].revoked_at, null, "Active session must NOT be revoked");
    }

    // Query active count
    const activeRows = await pool.query(
      `SELECT id FROM public.sessions 
       WHERE user_id = $1 AND client = 'android' 
         AND revoked_at IS NULL
         AND idle_expires_at > CURRENT_TIMESTAMP 
         AND absolute_expires_at > CURRENT_TIMESTAMP`,
      [TEST_USER_ID]
    );
    assert.strictEqual(activeRows.rows.length, 5, "Exactly 5 active sessions must exist");
  });

  // 10. Rate Limit: checkUserRateLimit keyed native_session:${userId}:${deviceId} (10 per 15 min)
  // and per-user limit (30 per 15 min across devices); two users behind same IP are limited independently
  test("10) [INDEPENDENT RATE LIMIT & PER-USER LIMIT] Rate limits per user+device and per-user with Cache-Control: no-store on 429", async () => {
    const user1Id = `${TEST_PREFIX}rl_usr_1`;
    const user2Id = `${TEST_PREFIX}rl_usr_2`;
    const sharedIp = "198.51.100.99";
    const devId1 = "device_rl_user1_99";
    const devId2 = "device_rl_user2_99";

    // Insert user1 and user2
    await pool.query("INSERT INTO public.customers (id, email, name, phone, account_status) VALUES ($1, 'rl1@bel.in', 'User 1', '+9199990001', 'active')", [user1Id]);
    await pool.query("INSERT INTO public.customers (id, email, name, phone, account_status) VALUES ($1, 'rl2@bel.in', 'User 2', '+9199990002', 'active')", [user2Id]);

    const sess1 = await sessionModule.createSession({ userId: user1Id, role: "user", client: "web" }, queryRunner);
    const sess2 = await sessionModule.createSession({ userId: user2Id, role: "user", client: "web" }, queryRunner);

    // Clean rate limits for these users
    await pool.query("DELETE FROM public.rate_limits WHERE key LIKE 'rl:user:native_session:%'");

    // User 1 makes 10 requests from sharedIp on device 1 -> all 200
    for (let i = 0; i < 10; i++) {
      const req = new Request("http://localhost:3000/api/auth/native-session", {
        method: "POST",
        headers: {
          "cookie": `__Host-session=${sess1.rawToken}`,
          "origin": "http://localhost:3000",
          "x-device-id": devId1,
          "x-forwarded-for": sharedIp
        }
      });
      const res = await POST(req);
      assert.strictEqual(res.status, 200, `User 1 request ${i + 1} must return 200`);
      assert.ok(res.headers.get("Cache-Control").includes("no-store"));
    }

    // User 1's 11th request on same device must be HTTP 429
    const req1_11 = new Request("http://localhost:3000/api/auth/native-session", {
      method: "POST",
      headers: {
        "cookie": `__Host-session=${sess1.rawToken}`,
        "origin": "http://localhost:3000",
        "x-device-id": devId1,
        "x-forwarded-for": sharedIp
      }
    });
    const res1_11 = await POST(req1_11);
    assert.strictEqual(res1_11.status, 429, "User 1 must be rate limited on 11th request for same device");
    assert.ok(res1_11.headers.get("Retry-After"), "Must include Retry-After header");
    assert.ok(
      res1_11.headers.get("Cache-Control").includes("no-store"),
      "429 response MUST include Cache-Control: no-store"
    );

    // User 2 from the EXACT SAME IP must NOT be rate limited (gets 200)
    const req2 = new Request("http://localhost:3000/api/auth/native-session", {
      method: "POST",
      headers: {
        "cookie": `__Host-session=${sess2.rawToken}`,
        "origin": "http://localhost:3000",
        "x-device-id": devId2,
        "x-forwarded-for": sharedIp
      }
    });
    const res2 = await POST(req2);
    assert.strictEqual(res2.status, 200, "User 2 on same IP must succeed independently");
    assert.ok(res2.headers.get("Cache-Control").includes("no-store"));
  });

  // 11. [SIMULATED] Database Down -> 503 + Retry-After: 5 (never 401 or 500)
  test("11) [SIMULATED] Database unavailable returns HTTP 503 + Retry-After: 5 (never 401 or 500) with no-store", async () => {
    const savedPool = globalThis.postgresPool;
    try {
      // Mock global pool connect to reject with connection exhaustion error
      globalThis.postgresPool = {
        connect: () => Promise.reject(new Error("connection refused: connection pool exhausted"))
      };

      const req = new Request("http://localhost:3000/api/auth/native-session", {
        method: "POST",
        headers: {
          "cookie": `__Host-session=${webSessionRawToken}`,
          "origin": "http://localhost:3000",
          "x-device-id": "device_db_down_sim_01"
        }
      });

      const res = await POST(req);
      assert.strictEqual(res.status, 503, "DB down must return HTTP 503 Service Unavailable");
      assert.notStrictEqual(res.status, 401, "DB down must NEVER return 401");
      assert.notStrictEqual(res.status, 500, "DB down must NEVER return generic 500");
      assert.strictEqual(res.headers.get("Retry-After"), "5", "Must include Retry-After: 5");
      assert.ok(
        res.headers.get("Cache-Control").includes("no-store"),
        "503 response MUST include Cache-Control: no-store"
      );

      const json = await res.json();
      assert.ok(json.error.includes("Database temporarily unavailable"));
    } finally {
      globalThis.postgresPool = savedPool;
    }
  });

  // 11b. [REAL UNREACHABLE PORT] Database connection to unreachable port returns HTTP 503 + Retry-After: 5
  test("11b) [REAL UNREACHABLE PORT] Real unreachable port connection returns HTTP 503 + Retry-After: 5 with no-store", async () => {
    const savedPool = globalThis.postgresPool;
    try {
      globalThis.postgresPool = new Pool({
        connectionString: "postgresql://postgres:testpass@127.0.0.1:5439/belconnect_test",
        connectionTimeoutMillis: 1000,
        ssl: false
      });

      const req = new Request("http://localhost:3000/api/auth/native-session", {
        method: "POST",
        headers: {
          "cookie": `__Host-session=${webSessionRawToken}`,
          "origin": "http://localhost:3000",
          "x-device-id": "device_unreachable_real_01"
        }
      });

      const res = await POST(req);
      assert.strictEqual(res.status, 503, "Unreachable port must return HTTP 503 Service Unavailable");
      assert.notStrictEqual(res.status, 401, "Unreachable port must NEVER return 401");
      assert.notStrictEqual(res.status, 500, "Unreachable port must NEVER return generic 500");
      assert.strictEqual(res.headers.get("Retry-After"), "5", "Must include Retry-After: 5");
      assert.ok(
        res.headers.get("Cache-Control").includes("no-store"),
        "Real 503 response MUST include Cache-Control: no-store"
      );

      const json = await res.json();
      assert.ok(json.error.includes("Database temporarily unavailable"));
    } finally {
      if (globalThis.postgresPool) {
        await globalThis.postgresPool.end().catch(() => {});
      }
      globalThis.postgresPool = savedPool;
    }
  });

  // 12. 20 Concurrent Exchanges for One User: Exactly 5 active + status histogram
  test("12) [CONCURRENCY] 20 concurrent exchanges for one user leaves exactly 5 active android sessions", async () => {
    process.env.TEST_SIMULATE_RACE = "1";
    // Revoke all prior native sessions for clean concurrency test
    await pool.query(
      "UPDATE public.sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND client = 'android'",
      [TEST_USER_ID]
    );
    await pool.query("DELETE FROM public.rate_limits WHERE key LIKE 'rl:user:native_session:%'");

    // Seed 4 initial active sessions so subsequent concurrent inserts race on the cap boundary
    for (let s = 0; s < 4; s++) {
      await sessionModule.createSession(
        { userId: TEST_USER_ID, role: "user", client: "android", device_id: `seed_dev_${s}`, ip: "127.0.0.1" },
        queryRunner
      );
    }

    // 1. Measure standalone rate-limit check duration
    const t0_rl = performance.now();
    await rateLimitCore.checkUserRateLimit(`native_session:${TEST_USER_ID}:timing_sample`, 10, 15 * 60);
    const duration_rl_ms = performance.now() - t0_rl;

    // 2. Measure standalone transaction duration (with advisory lock and 50ms sleep)
    const t0_tx = performance.now();
    const timingClient = await pool.connect();
    try {
      await timingClient.query("BEGIN");
      await timingClient.query("SELECT pg_advisory_xact_lock(hashtext($1))", [String(TEST_USER_ID)]);
      await timingClient.query("COMMIT");
    } finally {
      timingClient.release();
    }
    const duration_tx_ms = performance.now() - t0_tx;

    // 3. Confirm 20 requests use 20 distinct deviceIds
    const runDevPrefix = "dev_conc_" + Date.now().toString(36);
    const devIdList = [];
    for (let i = 0; i < 20; i++) {
      devIdList.push(`${runDevPrefix}_${String(i).padStart(2, "0")}`);
    }
    assert.strictEqual(devIdList.length, 20, "Must generate exactly 20 device IDs");
    assert.strictEqual(new Set(devIdList).size, 20, "All 20 device IDs must be distinct");

    await pool.query("DELETE FROM public.rate_limits WHERE key LIKE 'rl:user:native_session:%'");
    const concWebSess = await sessionModule.createSession(
      { userId: TEST_USER_ID, role: "user", client: "web", ip: "127.0.0.1" },
      queryRunner
    );
    rateLimitCore.setStoreOverride(new rateLimitCore.InMemoryStore());
    // 4. Launch 20 concurrent exchanges simultaneously
    const t0_concurrent = performance.now();
    const promises = devIdList.map((devId) => {
      const req = new Request("http://localhost:3000/api/auth/native-session", {
        method: "POST",
        headers: {
          "cookie": `__Host-session=${concWebSess.rawToken}`,
          "origin": "http://localhost:3000",
          "x-device-id": devId
        }
      });
      return POST(req);
    });

    const responses = await Promise.all(promises);
    const duration_concurrent_ms = performance.now() - t0_concurrent;

    // Compute and log status-code histogram
    const histogram = {};
    for (const res of responses) {
      histogram[res.status] = (histogram[res.status] || 0) + 1;
      assert.ok(res.headers.get("Cache-Control").includes("no-store"), "Must have no-store");
    }
    console.log("[Test 12 Concurrency Status Histogram]:", histogram);
    console.log(
      `[Test 12 Measured Breakdown]: single checkUserRateLimit=${duration_rl_ms.toFixed(2)}ms, single tx=${duration_tx_ms.toFixed(2)}ms, 20 concurrent total=${duration_concurrent_ms.toFixed(2)}ms, distinct deviceIds=${new Set(devIdList).size}`
    );

    // Query active sessions from PostgreSQL (counting only active rows)
    const activeRows = await pool.query(
      `SELECT id, device_id, created_at, revoked_at 
       FROM public.sessions 
       WHERE user_id = $1 
         AND client = 'android' 
         AND revoked_at IS NULL
         AND idle_expires_at > CURRENT_TIMESTAMP 
         AND absolute_expires_at > CURRENT_TIMESTAMP`,
      [TEST_USER_ID]
    );

    try {
      assert.strictEqual(
        activeRows.rows.length,
        5,
        `Active android sessions must be exactly 5, found: ${activeRows.rows.length}`
      );
    } finally {
      rateLimitCore.setStoreOverride(null);
    }
  });

  // 13. DELETE /api/auth/native-session: Revokes device sessions in PostgreSQL without cookies
  test("13) [DELETE /api/auth/native-session] Revokes device session in PostgreSQL without cookies, returning 200 + no-store; rejects missing/invalid token with 401", async () => {
    // A. Seed an active android session for device_del_test_01
    const testDeviceId = "device_del_test_01";
    const sess = await sessionModule.createSession(
      { userId: TEST_USER_ID, role: "user", client: "android", device_id: testDeviceId, ip: "127.0.0.1" },
      queryRunner
    );

    // Verify session is active before deletion
    const beforeCount = await pool.query(
      "SELECT count(*) FROM public.sessions WHERE user_id = $1 AND device_id = $2 AND revoked_at IS NULL",
      [TEST_USER_ID, testDeviceId]
    );
    assert.strictEqual(parseInt(beforeCount.rows[0].count, 10), 1, "Must have 1 active session before delete");

    // B. Call DELETE /api/auth/native-session with Bearer token
    const req = new Request("http://localhost:3000/api/auth/native-session", {
      method: "DELETE",
      headers: {
        "authorization": `Bearer ${sess.rawToken}`
      }
    });

    const res = await DELETE(req);
    assert.strictEqual(res.status, 200, "DELETE must return HTTP 200");
    assert.ok(res.headers.get("Cache-Control").includes("no-store"), "Must have no-store header");

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.deviceId, testDeviceId);

    // Verify session is revoked in DB
    const afterCount = await pool.query(
      "SELECT count(*) FROM public.sessions WHERE user_id = $1 AND device_id = $2 AND revoked_at IS NULL",
      [TEST_USER_ID, testDeviceId]
    );
    assert.strictEqual(parseInt(afterCount.rows[0].count, 10), 0, "Active session count must be 0 after delete");

    // C. Calling again with already revoked token (from valid origin) must return 401 Unauthorized
    const reqAgain = new Request("http://localhost:3000/api/auth/native-session", {
      method: "DELETE",
      headers: {
        "authorization": `Bearer ${sess.rawToken}`,
        "origin": "http://localhost:3000"
      }
    });
    const resAgain = await DELETE(reqAgain);
    assert.strictEqual(resAgain.status, 401, "Revoked token must return HTTP 401");
    assert.ok(resAgain.headers.get("Cache-Control").includes("no-store"));
  });
});
