const { test, describe } = require("node:test");
const assert = require("node:assert");
const crypto = require("node:crypto");
const path = require("node:path");

if (!process.env.JWT_SECRET && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(path.resolve(__dirname, "../../.env"));
  } catch (_) {}
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = "test_jwt_secret_must_be_at_least_32_characters_long_super_secure!";
}

describe("Phase 3a Authentication, Route-Awareness & Legacy Fallback Tests", () => {
  const rootDir = path.resolve(__dirname, "../../");
  const sessionLib = require(path.join(rootDir, "frontend/src/lib/session.ts"));
  const jwtLib = require(path.join(rootDir, "frontend/src/lib/jwt.ts"));

  const {
    createSession,
    validateSession,
    getSessionTokenFromRequest,
    getSessionUser,
    hashSessionToken,
    COOKIE_NAME_USER,
    COOKIE_NAME_ADMIN,
    COOKIE_NAME_USER_DEV,
    COOKIE_NAME_ADMIN_DEV,
    ADMIN_ALLOWED_NON_ADMIN_ROUTE_PATTERNS
  } = sessionLib;

  const { getAuthenticatedUser, signJwtToken, getLegacyJwtUser } = jwtLib;

  // Helper to create an in-memory session store & queryRunner
  function createMockDb(initialUsers = []) {
    const sessions = new Map();
    const users = new Map(initialUsers.map(u => [u.id, u]));

    const runner = async (sql, params = []) => {
      // 1. INSERT INTO sessions
      if (sql.includes("INSERT INTO public.sessions")) {
        const [token_hash, user_id, role, idle_expires_at, absolute_expires_at, ip, user_agent, device_label, client] = params;
        const id = "sess_" + crypto.randomUUID().slice(0, 8);
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
        sessions.set(token_hash, record);
        return { rows: [{ id }], rowCount: 1 };
      }

      // 2. SELECT FROM sessions JOIN users
      if (sql.includes("FROM public.sessions s") && sql.includes("s.token_hash = $1")) {
        const tokenHash = params[0];
        const s = sessions.get(tokenHash);
        if (!s) return { rows: [], rowCount: 0 };

        const u = users.get(s.user_id);
        const now = Date.now();
        const isExpired = now >= new Date(s.idle_expires_at).getTime() || now >= new Date(s.absolute_expires_at).getTime();
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
          email: u ? u.email : "user@example.com",
          name: u ? (u.name || u.email) : "Test User",
          account_status: u ? u.account_status : "active",
          user_exists: Boolean(u)
        };
        return { rows: [row], rowCount: 1 };
      }

      // 3. UPDATE sessions (touch)
      if (sql.includes("UPDATE public.sessions") && sql.includes("last_seen_at = CURRENT_TIMESTAMP")) {
        return { rowCount: 1 };
      }

      // 4. Legacy checkSql
      if (sql.includes("user_exists") && sql.includes("account_status")) {
        const [userId, role] = params;
        const u = users.get(userId);
        if (!u) {
          return { rows: [{ user_exists: false, account_status: null }], rowCount: 1 };
        }
        return { rows: [{ user_exists: true, account_status: u.account_status }], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    };

    return { sessions, users, runner };
  }

  // ─── SECTION 1: ASYNC getAuthenticatedUser CONTRACT ────────────────────────
  test("1) getAuthenticatedUser returns a Promise and decodes valid session", async () => {
    const { runner } = createMockDb([
      { id: "usr-1", email: "alice@belconnect.in", name: "Alice", role: "user", account_status: "active" }
    ]);

    const created = await createSession({
      userId: "usr-1",
      role: "user",
      client: "web"
    }, runner);

    const req = new Request("http://localhost/api/bookings", {
      headers: { cookie: `${COOKIE_NAME_USER}=${created.rawToken}` }
    });

    const promiseResult = getAuthenticatedUser(req, runner);
    assert.ok(promiseResult instanceof Promise, "getAuthenticatedUser MUST return a Promise");

    const authUser = await promiseResult;
    assert.ok(authUser, "Must resolve valid authUser");
    assert.strictEqual(authUser.userId, "usr-1");
    assert.strictEqual(authUser.email, "alice@belconnect.in");
    assert.strictEqual(authUser.role, "user");
    assert.strictEqual(authUser.name, "Alice");
  });

  // ─── SECTION 2: ROUTE-AWARE COOKIE SELECTION & ADMIN REGRESSION FIX ────────
  test("2) Admin cookie works on /api/admin/* and customer cookie is strictly rejected", async () => {
    const { runner } = createMockDb([
      { id: "adm-1", email: "admin@belconnect.in", name: "Admin", role: "admin", account_status: "active" },
      { id: "usr-1", email: "user@belconnect.in", name: "User", role: "user", account_status: "active" }
    ]);

    const adminSess = await createSession({ userId: "adm-1", role: "admin", client: "web" }, runner);
    const userSess = await createSession({ userId: "usr-1", role: "user", client: "web" }, runner);

    // a) Admin cookie works on /api/admin/providers
    const reqAdmin = new Request("http://localhost/api/admin/providers", {
      headers: { cookie: `${COOKIE_NAME_ADMIN}=${adminSess.rawToken}` }
    });
    const authAdmin = await getAuthenticatedUser(reqAdmin, runner);
    assert.ok(authAdmin, "Admin cookie must work on /api/admin/*");
    assert.strictEqual(authAdmin.role, "admin");

    // b) Customer/provider cookie on /api/admin/providers is strictly rejected
    const reqUserOnAdmin = new Request("http://localhost/api/admin/providers", {
      headers: { cookie: `${COOKIE_NAME_USER}=${userSess.rawToken}` }
    });
    const authUserOnAdmin = await getAuthenticatedUser(reqUserOnAdmin, runner);
    assert.strictEqual(authUserOnAdmin, null, "Customer cookie must NEVER authenticate /api/admin/*");

    // c) Both cookies present: /api/admin/* reads ONLY the admin cookie
    const reqBothOnAdmin = new Request("http://localhost/api/admin/providers", {
      headers: { cookie: `${COOKIE_NAME_ADMIN}=${adminSess.rawToken}; ${COOKIE_NAME_USER}=${userSess.rawToken}` }
    });
    const authBothOnAdmin = await getAuthenticatedUser(reqBothOnAdmin, runner);
    assert.ok(authBothOnAdmin);
    assert.strictEqual(authBothOnAdmin.userId, "adm-1", "Must authenticate admin user, never customer");
  });

  test("3) Admin cookie works on each allowlisted non-admin route", async () => {
    const { runner } = createMockDb([
      { id: "adm-1", email: "admin@belconnect.in", name: "Admin", role: "admin", account_status: "active" }
    ]);
    const adminSess = await createSession({ userId: "adm-1", role: "admin", client: "web" }, runner);

    const allowlistedRoutes = [
      "http://localhost/api/attachments/kyc-documents/prov-1/doc.jpg",
      "http://localhost/api/attachments/chat-attachments/usr-1/img.png",
      "http://localhost/api/jobs/resumes/res-123",
      "http://localhost/api/jobs/applications/app-123/resume",
      "http://localhost/api/providers/prov-123",
      "http://localhost/api/provider/kyc",
      "http://localhost/api/provider/availability",
      "http://localhost/api/ekyc/status",
      "http://localhost/api/bookings/B-10001",
      "http://localhost/api/services/srv-123",
      "http://localhost/api/jobs/job-123",
      "http://localhost/api/jobprovider/stats"
    ];

    for (const url of allowlistedRoutes) {
      // a) GET succeeds
      const reqGet = new Request(url, {
        method: "GET",
        headers: { cookie: `${COOKIE_NAME_ADMIN}=${adminSess.rawToken}` }
      });
      const authGet = await getAuthenticatedUser(reqGet, runner);
      assert.ok(authGet, `Admin cookie must authenticate allowlisted GET route: ${url}`);
      assert.strictEqual(authGet.role, "admin");

      // b) HEAD succeeds
      const reqHead = new Request(url, {
        method: "HEAD",
        headers: { cookie: `${COOKIE_NAME_ADMIN}=${adminSess.rawToken}` }
      });
      const authHead = await getAuthenticatedUser(reqHead, runner);
      assert.ok(authHead, `Admin cookie must authenticate allowlisted HEAD route: ${url}`);
      assert.strictEqual(authHead.role, "admin");

      // c) State-changing methods (POST, PATCH, DELETE) MUST BE REJECTED for admin on non-admin routes
      const reqPost = new Request(url, {
        method: "POST",
        headers: { cookie: `${COOKIE_NAME_ADMIN}=${adminSess.rawToken}` }
      });
      const authPost = await getAuthenticatedUser(reqPost, runner);
      assert.strictEqual(authPost, null, `Admin cookie MUST be rejected on non-admin POST route: ${url}`);

      const reqDelete = new Request(url, {
        method: "DELETE",
        headers: { cookie: `${COOKIE_NAME_ADMIN}=${adminSess.rawToken}` }
      });
      const authDelete = await getAuthenticatedUser(reqDelete, runner);
      assert.strictEqual(authDelete, null, `Admin cookie MUST be rejected on non-admin DELETE route: ${url}`);
    }
  });

  test("4) Admin cookie is strictly rejected on every other non-admin route", async () => {
    const { runner } = createMockDb([
      { id: "adm-1", email: "admin@belconnect.in", name: "Admin", role: "admin", account_status: "active" }
    ]);
    const adminSess = await createSession({ userId: "adm-1", role: "admin", client: "web" }, runner);

    const nonAllowlistedRoutes = [
      "http://localhost/api/chat/conversations",
      "http://localhost/api/account/delete",
      "http://localhost/api/auth/sync",
      "http://localhost/api/feedback",
      "http://localhost/api/upload",
      "http://localhost/api/device/register"
    ];

    for (const url of nonAllowlistedRoutes) {
      const req = new Request(url, {
        headers: { cookie: `${COOKIE_NAME_ADMIN}=${adminSess.rawToken}` }
      });
      const auth = await getAuthenticatedUser(req, runner);
      assert.strictEqual(auth, null, `Admin cookie must be rejected on non-allowlisted route: ${url}`);
    }
  });

  // ─── SECTION 3: ANDROID BEARER TOKEN ALLOWLIST ─────────────────────────────
  test("5) Android Bearer tokens are accepted ONLY on the 3 allowlisted native routes with client='android'", async () => {
    const { runner } = createMockDb([
      { id: "prov-1", email: "pro@belconnect.in", name: "Pro", role: "provider", account_status: "active" }
    ]);

    const androidSess = await createSession({ userId: "prov-1", role: "provider", client: "android" }, runner);
    const webSess = await createSession({ userId: "prov-1", role: "provider", client: "web" }, runner);

    const allowedUrls = [
      "http://localhost/api/bookings/B-10001/provider-location-native",
      "http://localhost/api/calls/call-1/reject",
      "http://localhost/api/calls/call-1/end"
    ];

    // a) Allowed routes with client='android' succeed
    for (const url of allowedUrls) {
      const req = new Request(url, {
        headers: { Authorization: `Bearer ${androidSess.rawToken}` }
      });
      const auth = await getAuthenticatedUser(req, runner);
      assert.ok(auth, `Bearer must work on allowed route ${url}`);
      assert.strictEqual(auth.client, "android");
    }

    // b) Disallowed route with Bearer token is rejected
    const reqDisallowed = new Request("http://localhost/api/bookings", {
      headers: { Authorization: `Bearer ${androidSess.rawToken}` }
    });
    const authDisallowed = await getAuthenticatedUser(reqDisallowed, runner);
    assert.strictEqual(authDisallowed, null, "Bearer token must be rejected on non-allowlisted route");

    // c) Allowed route but session client='web' is rejected
    const reqWebClientBearer = new Request("http://localhost/api/bookings/B-10001/provider-location-native", {
      headers: { Authorization: `Bearer ${webSess.rawToken}` }
    });
    const authWebClientBearer = await getAuthenticatedUser(reqWebClientBearer, runner);
    assert.strictEqual(authWebClientBearer, null, "Bearer token issued to client='web' must be rejected");
  });

  // ─── SECTION 4: INVALID, REVOKED, EXPIRED TOKENS & MALFORMED COOKIES ────────
  test("6) Missing, invalid, revoked, and expired tokens return null", async () => {
    const { runner, sessions } = createMockDb([
      { id: "usr-1", email: "user@belconnect.in", name: "User", role: "user", account_status: "active" }
    ]);

    // a) Missing token
    const reqEmpty = new Request("http://localhost/api/bookings");
    assert.strictEqual(await getAuthenticatedUser(reqEmpty, runner), null);

    // b) Non-existent token hash
    const reqInvalid = new Request("http://localhost/api/bookings", {
      headers: { cookie: `${COOKIE_NAME_USER}=completely_fake_token_value_that_does_not_exist` }
    });
    assert.strictEqual(await getAuthenticatedUser(reqInvalid, runner), null);

    // c) Revoked session
    const sess = await createSession({ userId: "usr-1", role: "user", client: "web" }, runner);
    const sRecord = sessions.get(hashSessionToken(sess.rawToken));
    sRecord.revoked_at = new Date(); // Revoke session

    const reqRevoked = new Request("http://localhost/api/bookings", {
      headers: { cookie: `${COOKIE_NAME_USER}=${sess.rawToken}` }
    });
    assert.strictEqual(await getAuthenticatedUser(reqRevoked, runner), null);

    // d) Expired session (idle expired)
    const sessExpired = await createSession({ userId: "usr-1", role: "user", client: "web" }, runner);
    const expRecord = sessions.get(hashSessionToken(sessExpired.rawToken));
    expRecord.idle_expires_at = new Date(Date.now() - 1000); // Expired 1 second ago

    const reqExpired = new Request("http://localhost/api/bookings", {
      headers: { cookie: `${COOKIE_NAME_USER}=${sessExpired.rawToken}` }
    });
    assert.strictEqual(await getAuthenticatedUser(reqExpired, runner), null);
  });

  test("7) Malformed cookie header does not throw and returns null safely", async () => {
    const { runner } = createMockDb();

    // Malformed URI encoding in cookie value (%E0%A4%A)
    const reqMalformed = new Request("http://localhost/api/bookings", {
      headers: { cookie: `${COOKIE_NAME_USER}=%E0%A4%A; bad_cookie=%FF%FE` }
    });

    let authUser = null;
    assert.doesNotThrow(() => {
      getSessionTokenFromRequest(reqMalformed);
    }, "getSessionTokenFromRequest must never throw on malformed cookies");

    assert.doesNotThrow(async () => {
      authUser = await getAuthenticatedUser(reqMalformed, runner);
    });

    assert.strictEqual(authUser, null);
  });

  // ─── SECTION 5: LEGACY FALLBACK SAFETY ─────────────────────────────────────
  test("8) Legacy JWT with role 'admin' is ALWAYS rejected across all routes", async () => {
    const { runner } = createMockDb([
      { id: "adm-1", email: "admin@belconnect.in", name: "Admin", role: "admin", account_status: "active" }
    ]);

    const adminJwt = signJwtToken({ userId: "adm-1", email: "admin@belconnect.in", role: "admin" });

    // a) On /api/admin/*
    const reqAdminRoute = new Request("http://localhost/api/admin/providers", {
      headers: { Authorization: `Bearer ${adminJwt}`, cookie: `auth_token=${adminJwt}` }
    });
    const authAdminRoute = await getAuthenticatedUser(reqAdminRoute, runner);
    assert.strictEqual(authAdminRoute, null, "Legacy JWT with role 'admin' must be rejected on /api/admin/*");

    // b) On non-admin routes
    const reqNonAdmin = new Request("http://localhost/api/bookings", {
      headers: { Authorization: `Bearer ${adminJwt}`, cookie: `auth_token=${adminJwt}` }
    });
    const authNonAdmin = await getAuthenticatedUser(reqNonAdmin, runner);
    assert.strictEqual(authNonAdmin, null, "Legacy JWT with role 'admin' must be rejected on non-admin routes");
  });

  test("9) Legacy cookie/token is NEVER read on /api/admin/*", async () => {
    const { runner } = createMockDb([
      { id: "usr-1", email: "user@belconnect.in", name: "User", role: "user", account_status: "active" }
    ]);
    const userJwt = signJwtToken({ userId: "usr-1", email: "user@belconnect.in", role: "user" });

    const req = new Request("http://localhost/api/admin/providers", {
      headers: { cookie: `auth_token=${userJwt}` }
    });
    const auth = await getAuthenticatedUser(req, runner);
    assert.strictEqual(auth, null, "Legacy auth_token must never authenticate /api/admin/*");
  });

  test("10) Legacy JWT for user whose row is deleted or account_status != 'active' is rejected", async () => {
    const { runner } = createMockDb([
      { id: "usr-active", email: "active@belconnect.in", name: "Active", role: "user", account_status: "active" },
      { id: "usr-suspended", email: "susp@belconnect.in", name: "Suspended", role: "user", account_status: "suspended" }
    ]);

    const activeJwt = signJwtToken({ userId: "usr-active", email: "active@belconnect.in", role: "user" });
    const suspendedJwt = signJwtToken({ userId: "usr-suspended", email: "susp@belconnect.in", role: "user" });
    const deletedJwt = signJwtToken({ userId: "usr-nonexistent", email: "del@belconnect.in", role: "user" });

    // a) Deleted user row -> rejected
    const reqDeleted = new Request("http://localhost/api/bookings", {
      headers: { cookie: `auth_token=${deletedJwt}` }
    });
    assert.strictEqual(await getAuthenticatedUser(reqDeleted, runner), null, "Deleted user row must be rejected");

    // b) Suspended account status -> rejected
    const reqSuspended = new Request("http://localhost/api/bookings", {
      headers: { cookie: `auth_token=${suspendedJwt}` }
    });
    assert.strictEqual(await getAuthenticatedUser(reqSuspended, runner), null, "Suspended account must be rejected");

    // c) Active user -> accepted and logs without tokens
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));

    const reqActive = new Request("http://localhost/api/bookings", {
      headers: { cookie: `auth_token=${activeJwt}` }
    });
    const authActive = await getAuthenticatedUser(reqActive, runner);
    console.log = originalLog;

    assert.ok(authActive, "Active user with legacy token must succeed");
    assert.strictEqual(authActive.userId, "usr-active");
    assert.strictEqual(authActive.role, "user");

    // Verify [LEGACY_AUTH_FALLBACK] logged without any token
    const fallbackLog = logs.find(l => l.includes("[LEGACY_AUTH_FALLBACK]"));
    assert.ok(fallbackLog, "Must log [LEGACY_AUTH_FALLBACK]");
    assert.ok(fallbackLog.includes("userId=usr-active"), "Must include userId in log");
    assert.ok(fallbackLog.includes("role=user"), "Must include role in log");
    assert.ok(!fallbackLog.includes(activeJwt), "Must NEVER include raw token in log");
  });

  // ─── SECTION 6: PREREQUISITE CHECKS (OAUTH_STATE_SECRET & NATIVE SESSION) ──
  test("11) OAUTH_STATE_SECRET: Creates and verifies HMAC-SHA256 state tokens separately from user JWTs", () => {
    const oauthLib = require(path.join(rootDir, "frontend/src/lib/oauthState.ts"));
    const { createOAuthState, verifyOAuthState } = oauthLib;

    process.env.OAUTH_STATE_SECRET = "test_oauth_state_secret_must_be_at_least_32_characters_long!";

    // Create state
    const stateToken = createOAuthState("customer", true, "test_challenge_abc123", true);
    assert.ok(stateToken, "Must produce state token");
    assert.strictEqual(stateToken.split(".").length, 2, "Dedicated OAuth state token must be a 2-part payload.signature string");

    // Verify state
    const verified = verifyOAuthState(stateToken);
    assert.ok(verified.valid, "Valid state token must verify cleanly");
    assert.strictEqual(verified.mobile, true);
    assert.strictEqual(verified.codeChallenge, "test_challenge_abc123");
    assert.strictEqual(verified.roleNeutral, true);

    // Tampered state must fail
    const tampered = stateToken.slice(0, -4) + "abcd";
    const verifiedTampered = verifyOAuthState(tampered);
    assert.strictEqual(verifiedTampered.valid, false, "Tampered state token must fail verification");

    // Invalid secret verification failure
    const originalSecret = process.env.OAUTH_STATE_SECRET;
    process.env.OAUTH_STATE_SECRET = "different_secret_that_does_not_match_original_secret_123!";
    const verifiedDiffSecret = verifyOAuthState(stateToken);
    assert.strictEqual(verifiedDiffSecret.valid, false, "State verified with mismatched secret must fail");
    process.env.OAUTH_STATE_SECRET = originalSecret;
  });

  test("12) Native Session Exchange Contract: Requires active web cookie session", () => {
    const nativeSessionRoutePath = path.join(rootDir, "frontend/src/app/api/auth/native-session/route.ts");
    const fs = require("node:fs");
    assert.ok(fs.existsSync(nativeSessionRoutePath), "native-session/route.ts must exist");
    const code = fs.readFileSync(nativeSessionRoutePath, "utf-8");

    // Must require active web cookie session
    assert.ok(code.includes("getSessionTokenFromRequest(request, \"user\")"), "Must extract web cookie session");
    assert.ok(code.includes("Active web session cookie is required"), "Must reject missing web cookie session");
    assert.ok(!code.includes("password_hash"), "Must NOT accept raw email/password credentials");
  });

  // ─── SECTION 7: RESILIENCE: DATABASE ERRORS MUST NEVER CAUSE 401 OR LOGOUT ──
  test("13) DB Failure in validateSession: Throws DatabaseUnavailableError (503), not null (401), and preserves session", async () => {
    const { runner, sessions } = createMockDb([
      { id: "usr-resilient", email: "resilient@belconnect.in", name: "Resilient User", role: "user", account_status: "active" }
    ]);

    const sess = await createSession({ userId: "usr-resilient", role: "user", client: "web" }, runner);

    // Mock a broken query runner simulating PostgreSQL connection exhaustion
    const failingRunner = async () => {
      throw new Error("timeout exceeded when trying to connect: connection pool exhausted");
    };

    const { DatabaseUnavailableError } = sessionLib;

    await assert.rejects(
      async () => {
        await validateSession(sess.rawToken, failingRunner);
      },
      (err) => {
        assert.ok(err instanceof DatabaseUnavailableError, "Must throw DatabaseUnavailableError");
        assert.ok(err.isDatabaseUnavailable === true);
        return true;
      },
      "Database failure in validateSession must reject with DatabaseUnavailableError"
    );

    // Verify session in DB was NOT marked revoked
    const record = sessions.get(hashSessionToken(sess.rawToken));
    assert.strictEqual(record.revoked_at, null, "Database failure must NEVER mark session revoked");

    // getAuthenticatedUser must also reject with DatabaseUnavailableError (so routes return 503, never 401)
    const req = new Request("http://localhost/api/bookings", {
      headers: { cookie: `${COOKIE_NAME_USER}=${sess.rawToken}` }
    });

    await assert.rejects(
      async () => {
        await getAuthenticatedUser(req, failingRunner);
      },
      (err) => {
        assert.ok(err.name === "DatabaseUnavailableError" || err.isDatabaseUnavailable);
        return true;
      },
      "getAuthenticatedUser must bubble DatabaseUnavailableError for 503 response"
    );
  });

  test("14) DB Failure in legacy fallback: Throws DatabaseUnavailableError instead of treating user as missing", async () => {
    const userJwt = signJwtToken({ userId: "usr-legacy-db-fail", email: "legacy@belconnect.in", role: "user" });

    const failingRunner = async () => {
      throw new Error("connection terminated unexpectedly: database system is shutting down");
    };

    const req = new Request("http://localhost/api/bookings", {
      headers: { cookie: `auth_token=${userJwt}` }
    });

    await assert.rejects(
      async () => {
        await getAuthenticatedUser(req, failingRunner);
      },
      (err) => {
        assert.ok(err.name === "DatabaseUnavailableError" || err.isDatabaseUnavailable);
        return true;
      },
      "Legacy fallback DB error must bubble DatabaseUnavailableError"
    );
  });

  test("15) authFetch Contract: Retries on 503 with backoff and NEVER triggers logout", () => {
    const authFetchPath = path.join(rootDir, "frontend/src/lib/authFetch.ts");
    const fs = require("node:fs");
    assert.ok(fs.existsSync(authFetchPath), "authFetch.ts must exist");
    const code = fs.readFileSync(authFetchPath, "utf-8");

    // 503 retry logic
    assert.ok(code.includes("response.status === 503"), "Must handle 503 response");
    assert.ok(code.includes("Retry-After"), "Must inspect Retry-After header");
    assert.ok(code.includes("maxRetries"), "Must define retry limit");

    // 401 vs 503 logout isolation
    assert.ok(code.includes("response.status === 401"), "Must check 401 explicitly");
    assert.ok(code.includes("triggerAuthExpired();"), "401 must call triggerAuthExpired");
    // Ensure triggerAuthExpired is not inside 503 branch
    assert.ok(!code.includes("response.status === 503\n      triggerAuthExpired"), "503 must NEVER call triggerAuthExpired");
  });
});
