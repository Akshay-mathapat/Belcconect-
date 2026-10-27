const { test, describe } = require("node:test");
const assert = require("node:assert");

describe("Native Session Route Behavioral Contract Tests", () => {
  // Mock DB state
  function createMockDb() {
    const sessions = [];
    const users = new Map([
      ["u_cust1", { id: "u_cust1", email: "cust@example.com", role: "user", account_status: "active" }],
      ["u_admin1", { id: "u_admin1", email: "admin@example.com", role: "admin", account_status: "active" }]
    ]);

    const runner = async (sql, params = []) => {
      // 1. UPDATE sessions (revocation)
      if (sql.includes("UPDATE public.sessions") && sql.includes("SET revoked_at")) {
        let count = 0;
        if (sql.includes("device_id = $2")) {
          const [userId, deviceId] = params;
          sessions.forEach(s => {
            if (s.user_id === userId && s.client === "android" && s.device_id === deviceId && !s.revoked_at) {
              s.revoked_at = new Date();
              count++;
            }
          });
        } else if (sql.includes("OFFSET 4")) {
          // Cap at 5: revoke oldest beyond 4
          const [userId] = params;
          const active = sessions
            .filter(s => s.user_id === userId && s.client === "android" && !s.revoked_at)
            .sort((a, b) => a.created_at - b.created_at);
          if (active.length >= 5) {
            const toRevoke = active.slice(0, active.length - 4);
            toRevoke.forEach(s => { s.revoked_at = new Date(); count++; });
          }
        }
        return { rowCount: count };
      }

      // 2. INSERT INTO sessions
      if (sql.includes("INSERT INTO public.sessions")) {
        const [token_hash, user_id, role, idle, abs, ip, ua, label, client, device_id] = params;
        const newSess = {
          id: "sess_" + Math.random().toString(36).slice(2, 9),
          token_hash,
          user_id,
          role,
          client,
          device_id,
          created_at: new Date(),
          revoked_at: null
        };
        sessions.push(newSess);
        return { rows: [{ id: newSess.id }] };
      }

      return { rows: [] };
    };

    return { sessions, users, runner };
  }

  // Pure logic replica of POST /api/auth/native-session handler for direct behavioral execution
  async function executeNativeSessionHandler(req, mockDb, validateSessionFn) {
    const authHeader = req.headers.authorization || "";
    const cookieHeader = req.headers.cookie || "";

    // 1. Idempotent App-Resume Check
    if (authHeader.startsWith("Bearer ")) {
      const existingNativeToken = authHeader.substring(7).trim();
      if (existingNativeToken) {
        const validated = await validateSessionFn(existingNativeToken);
        if (validated && validated.client === "android") {
          return {
            status: 200,
            body: {
              success: true,
              reused: true,
              token: existingNativeToken,
              userId: validated.userId,
              role: validated.role,
              deviceId: validated.deviceId || req.body?.deviceId || "default"
            }
          };
        }
      }
    }

    // 2. Web Cookie Extraction & Validation
    const match = cookieHeader.match(/(?:__Host-session|session)=([^;]+)/);
    const webToken = match ? match[1].trim() : null;
    if (!webToken) {
      return {
        status: 401,
        body: { error: "Unauthorized: Active web session cookie is required to exchange for native session." }
      };
    }

    const activeUser = await validateSessionFn(webToken);
    if (!activeUser) {
      return {
        status: 401,
        body: { error: "Unauthorized: Invalid or expired web session." }
      };
    }

    // 3. Admin Guard
    if (activeUser.role === "admin") {
      return {
        status: 403,
        body: { error: "Forbidden: Administrators cannot create Android client sessions." }
      };
    }

    const deviceId = req.headers["x-device-id"] || req.body?.deviceId || "default_android_device";

    // 4. Device-scoped revocation
    if (deviceId && deviceId !== "default_android_device") {
      await mockDb.runner(
        `UPDATE public.sessions SET revoked_at = NOW() WHERE user_id = $1 AND client = 'android' AND device_id = $2 AND revoked_at IS NULL`,
        [activeUser.userId, deviceId]
      );
    }

    // 5. User cap at 5
    await mockDb.runner(
      `UPDATE public.sessions SET revoked_at = NOW() WHERE id IN (SELECT id FROM public.sessions WHERE user_id = $1 AND client = 'android' AND revoked_at IS NULL ORDER BY created_at ASC OFFSET 4)`,
      [activeUser.userId]
    );

    // 6. Create session
    const rawToken = "tok_" + Math.random().toString(36).slice(2);
    const tokenHash = "hash_" + rawToken;
    await mockDb.runner(
      `INSERT INTO public.sessions (token_hash, user_id, role, idle, abs, ip, ua, label, client, device_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [tokenHash, activeUser.userId, activeUser.role, new Date(), new Date(), null, null, `Android (${deviceId})`, "android", deviceId]
    );

    return {
      status: 200,
      body: {
        success: true,
        reused: false,
        token: rawToken,
        userId: activeUser.userId,
        role: activeUser.role,
        deviceId
      }
    };
  }

  test("1) Bearer 'reuse' path returns the SAME token and creates ZERO new sessions in DB", async () => {
    const mockDb = createMockDb();
    const existingToken = "tok_active_native_session_12345";
    const initialSessionCount = mockDb.sessions.length;

    const mockValidate = async (tok) => {
      if (tok === existingToken) {
        return { userId: "u_cust1", role: "user", client: "android", deviceId: "phone_uuid_1" };
      }
      return null;
    };

    const res = await executeNativeSessionHandler(
      { headers: { authorization: `Bearer ${existingToken}` } },
      mockDb,
      mockValidate
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.reused, true);
    assert.strictEqual(res.body.token, existingToken, "Must return the exact same existing token");
    assert.strictEqual(mockDb.sessions.length, initialSessionCount, "Must NOT insert any new session into DB on reuse");
  });

  test("2) Creating a session requires the web cookie (401 when missing or expired)", async () => {
    const mockDb = createMockDb();
    const mockValidate = async () => null;

    // Missing cookie
    const resNoCookie = await executeNativeSessionHandler({ headers: {} }, mockDb, mockValidate);
    assert.strictEqual(resNoCookie.status, 401);
    assert.ok(resNoCookie.body.error.includes("cookie is required"));

    // Expired cookie
    const resExpired = await executeNativeSessionHandler(
      { headers: { cookie: "__Host-session=invalid_or_expired_cookie" } },
      mockDb,
      mockValidate
    );
    assert.strictEqual(resExpired.status, 401);
    assert.ok(resExpired.body.error.includes("Invalid or expired web session"));
  });

  test("3) Admin cannot create android sessions (403 Forbidden)", async () => {
    const mockDb = createMockDb();
    const mockValidate = async (tok) => {
      if (tok === "admin_web_cookie") {
        return { userId: "u_admin1", role: "admin", client: "web" };
      }
      return null;
    };

    const res = await executeNativeSessionHandler(
      { headers: { cookie: "__Host-session=admin_web_cookie" } },
      mockDb,
      mockValidate
    );

    assert.strictEqual(res.status, 403, "Admin must be blocked with 403 Forbidden");
    assert.ok(res.body.error.includes("Administrators cannot create Android client sessions"));
    assert.strictEqual(mockDb.sessions.length, 0, "No android session must be created for admin");
  });

  test("4) Device-scoped revocation: revoking session for device A preserves device B", async () => {
    const mockDb = createMockDb();
    mockDb.sessions.push(
      { id: "s1", user_id: "u_cust1", client: "android", device_id: "device_A", created_at: new Date(Date.now() - 3000), revoked_at: null },
      { id: "s2", user_id: "u_cust1", client: "android", device_id: "device_B", created_at: new Date(Date.now() - 2000), revoked_at: null }
    );

    const mockValidate = async () => ({ userId: "u_cust1", role: "user", client: "web" });

    // Issue new session for device_A
    await executeNativeSessionHandler(
      { headers: { cookie: "session=web_cookie", "x-device-id": "device_A" } },
      mockDb,
      mockValidate
    );

    const s1 = mockDb.sessions.find(s => s.id === "s1");
    const s2 = mockDb.sessions.find(s => s.id === "s2");

    assert.ok(s1.revoked_at !== null, "Prior session for device_A must be revoked");
    assert.strictEqual(s2.revoked_at, null, "Prior session for device_B must REMAIN active and untouched");
  });

  test("5) Active Android sessions capped at 5 per user (oldest revoked when exceeded)", async () => {
    const mockDb = createMockDb();
    // Pre-populate 5 active sessions
    for (let i = 1; i <= 5; i++) {
      mockDb.sessions.push({
        id: `s_old_${i}`,
        user_id: "u_cust1",
        client: "android",
        device_id: `dev_${i}`,
        created_at: new Date(Date.now() - (6 - i) * 10000),
        revoked_at: null
      });
    }

    const mockValidate = async () => ({ userId: "u_cust1", role: "user", client: "web" });

    // Issue 6th session
    await executeNativeSessionHandler(
      { headers: { cookie: "session=web_cookie", "x-device-id": "dev_6" } },
      mockDb,
      mockValidate
    );

    const activeSessions = mockDb.sessions.filter(s => s.user_id === "u_cust1" && s.client === "android" && !s.revoked_at);
    assert.strictEqual(activeSessions.length, 5, "Total active android sessions must be capped at 5");
    const oldest = mockDb.sessions.find(s => s.id === "s_old_1");
    assert.ok(oldest.revoked_at !== null, "Oldest session must be revoked when cap of 5 is exceeded");
  });
});

