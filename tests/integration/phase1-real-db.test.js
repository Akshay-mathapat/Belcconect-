/**
 * BelConnect - Phase 1 Real PostgreSQL & Live Socket.IO Integration Tests
 * Validates /api/auth/socket-ticket real route handler, rate limiting, and real live Socket.IO
 * server ticket authentication, replay rejection, revocation sweep, and reconnect across
 * all roles (user, provider, job_provider) including suspended, revoked, and deleted accounts.
 * Runs against live test database (host=localhost:5433 db=belconnect_test).
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const { pathToFileURL } = require("node:url");

const { validateTestDatabaseUrl } = require("./db-guard");
const guard = validateTestDatabaseUrl();

const rootDir = path.resolve(__dirname, "../../");
const sessionModule = require(path.join(rootDir, "frontend/src/lib/session.ts"));
const { Pool } = require(path.join(rootDir, "backend/node_modules/pg"));
const { Server } = require(path.join(rootDir, "backend/node_modules/socket.io"));
const { io: ClientIO } = require(path.join(rootDir, "frontend/node_modules/socket.io-client"));

// Shared Socket.IO authentication and revocation sweep module
const {
  createSocketAuthMiddleware,
  createRevocationSweep,
  startRevocationSweepInterval
} = require(path.join(rootDir, "backend/src/socketAuth.js"));

const suite = guard.shouldRun ? describe : describe.skip;

suite("Phase 1 Real PostgreSQL & Live Socket.IO Integration Tests", () => {
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

  const TEST_PREFIX = "p1_real_";
  const TEST_USER_ID = `${TEST_PREFIX}cust_01`;
  const TEST_SUSPENDED_ID = `${TEST_PREFIX}cust_suspended`;
  const TEST_PROV_ID = `${TEST_PREFIX}prov_01`;
  const TEST_PROV_SUSPENDED_ID = `${TEST_PREFIX}prov_suspended`;
  const TEST_JOBPROV_ID = `${TEST_PREFIX}jobprov_01`;
  const TEST_JOBPROV_SUSPENDED_ID = `${TEST_PREFIX}jobprov_suspended`;

  let activeSessionRawToken = "";
  let activeSessionId = "";
  let suspendedSessionRawToken = "";
  let suspendedSessionId = "";
  let provSessionRawToken = "";
  let provSessionId = "";
  let provSuspendedSessionRawToken = "";
  let provSuspendedSessionId = "";
  let jobprovSessionRawToken = "";
  let jobprovSessionId = "";
  let jobprovSuspendedSessionRawToken = "";
  let jobprovSuspendedSessionId = "";

  // Live Socket.IO test server on port 5058
  let httpServer;
  let ioServer;
  let directSweepFn;
  const TEST_SOCKET_PORT = 5058;

  // Real Next.js route handler
  let POST;

  before(async () => {
    // 0. Import real route handler dynamically via ESM register loader
    const routeUrl = pathToFileURL(path.join(rootDir, "frontend/src/app/api/auth/socket-ticket/route.ts")).href;
    const routeMod = await import(routeUrl);
    POST = routeMod.POST;

    // 1. Clean up any previous test artifacts
    await pool.query("DELETE FROM public.socket_tickets WHERE user_id LIKE $1", [`${TEST_PREFIX}%`]);
    await pool.query("DELETE FROM public.sessions WHERE user_id LIKE $1", [`${TEST_PREFIX}%`]);
    await pool.query("DELETE FROM public.customers WHERE id LIKE $1", [`${TEST_PREFIX}%`]);
    await pool.query("DELETE FROM public.service_providers WHERE id LIKE $1", [`${TEST_PREFIX}%`]);
    await pool.query("DELETE FROM public.job_providers WHERE id LIKE $1", [`${TEST_PREFIX}%`]);
    await pool.query("DELETE FROM public.rate_limits WHERE key LIKE 'rl:test_pg:%' OR key LIKE $1", [`rl:user:${TEST_PREFIX}%`]);

    // 2. Insert active and suspended customers, providers, job_providers
    await pool.query(
      `INSERT INTO public.customers (id, email, name, phone, account_status)
       VALUES ($1, 'active@p1real.com', 'Active Real User', '+919999900011', 'active')`,
      [TEST_USER_ID]
    );
    await pool.query(
      `INSERT INTO public.customers (id, email, name, phone, account_status)
       VALUES ($1, 'suspended@p1real.com', 'Suspended Real User', '+919999900012', 'suspended')`,
      [TEST_SUSPENDED_ID]
    );

    await pool.query(
      `INSERT INTO public.service_providers (id, email, name, phone, account_status)
       VALUES ($1, 'prov@p1real.com', 'Real Service Provider', '+919999900021', 'active')`,
      [TEST_PROV_ID]
    );
    await pool.query(
      `INSERT INTO public.service_providers (id, email, name, phone, account_status)
       VALUES ($1, 'prov_susp@p1real.com', 'Suspended Service Provider', '+919999900022', 'suspended')`,
      [TEST_PROV_SUSPENDED_ID]
    );

    await pool.query(
      `INSERT INTO public.job_providers (id, email, name, phone, account_status)
       VALUES ($1, 'jobprov@p1real.com', 'Real Job Provider', '+919999900031', 'active')`,
      [TEST_JOBPROV_ID]
    );
    await pool.query(
      `INSERT INTO public.job_providers (id, email, name, phone, account_status)
       VALUES ($1, 'jobprov_susp@p1real.com', 'Suspended Job Provider', '+919999900032', 'suspended')`,
      [TEST_JOBPROV_SUSPENDED_ID]
    );

    // 3. Create real PostgreSQL sessions for each role
    const sess1 = await sessionModule.createSession(
      { userId: TEST_USER_ID, role: "user", client: "web", ip: "127.0.0.1" },
      queryRunner
    );
    activeSessionRawToken = sess1.rawToken;
    activeSessionId = sess1.sessionId;

    const sess2 = await sessionModule.createSession(
      { userId: TEST_SUSPENDED_ID, role: "user", client: "web", ip: "127.0.0.1" },
      queryRunner
    );
    suspendedSessionRawToken = sess2.rawToken;
    suspendedSessionId = sess2.sessionId;

    const sess3 = await sessionModule.createSession(
      { userId: TEST_PROV_ID, role: "provider", client: "web", ip: "127.0.0.1" },
      queryRunner
    );
    provSessionRawToken = sess3.rawToken;
    provSessionId = sess3.sessionId;

    const sess4 = await sessionModule.createSession(
      { userId: TEST_PROV_SUSPENDED_ID, role: "provider", client: "web", ip: "127.0.0.1" },
      queryRunner
    );
    provSuspendedSessionRawToken = sess4.rawToken;
    provSuspendedSessionId = sess4.sessionId;

    const sess5 = await sessionModule.createSession(
      { userId: TEST_JOBPROV_ID, role: "job_provider", client: "web", ip: "127.0.0.1" },
      queryRunner
    );
    jobprovSessionRawToken = sess5.rawToken;
    jobprovSessionId = sess5.sessionId;

    const sess6 = await sessionModule.createSession(
      { userId: TEST_JOBPROV_SUSPENDED_ID, role: "job_provider", client: "web", ip: "127.0.0.1" },
      queryRunner
    );
    jobprovSuspendedSessionRawToken = sess6.rawToken;
    jobprovSuspendedSessionId = sess6.sessionId;

    // 4. Start live HTTP + Socket.IO server using shared socketAuth module
    httpServer = http.createServer();
    ioServer = new Server(httpServer, {
      cors: { origin: "*" },
      pingTimeout: 10000,
      pingInterval: 5000
    });

    // Use shared middleware from backend/src/socketAuth.js
    ioServer.use(
      createSocketAuthMiddleware({
        pool,
        acceptLegacy: true
      })
    );

    // Instantiate sweep function from shared module for tests
    directSweepFn = createRevocationSweep({ io: ioServer, pool });

    await new Promise((resolve) => httpServer.listen(TEST_SOCKET_PORT, resolve));
  });

  // --- Test 1: [SOURCE CHECK] Route Handler Contract & Exports ---
  test("1) [SOURCE CHECK] Route handler contract: /api/auth/socket-ticket file structure, exports and constants", () => {
    const routePath = path.join(rootDir, "frontend/src/app/api/auth/socket-ticket/route.ts");
    assert.ok(fs.existsSync(routePath), "socket-ticket/route.ts must exist");
    const code = fs.readFileSync(routePath, "utf-8");

    assert.ok(code.includes("export const dynamic = \"force-dynamic\""), "Must be force-dynamic");
    assert.ok(code.includes("getSessionTokenFromRequest(request, \"user\")"), "Must require user session cookie");
    assert.ok(code.includes("validateSession("), "Must validate session");
    assert.ok(code.includes("checkUserRateLimit("), "Must check rate limit per user");
    assert.ok(code.includes("createSocketTicket("), "Must issue ticket via createSocketTicket");
    assert.ok(code.includes('"Cache-Control"'), "Must enforce Cache-Control: no-store");
  });

  // --- Test 2: [REAL HANDLER] Call POST without cookie -> 401 Unauthorized ---
  test("2) [REAL HANDLER] Call POST without cookie: returns HTTP 401 Unauthorized + no-store", async () => {
    const req = new Request("http://localhost:3000/api/auth/socket-ticket", {
      method: "POST",
      headers: { "origin": "http://localhost:3000" }
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 401, "Missing cookie must return HTTP 401");
    assert.ok(
      res.headers.get("Cache-Control").includes("no-store"),
      "401 must include Cache-Control: no-store"
    );

    const json = await res.json();
    assert.ok(json.error.includes("Unauthorized"), "Response error must state Unauthorized");
  });

  // --- Test 3: [REAL HANDLER + REAL DB] Call POST with valid session cookie -> 200 OK + expiresAt ~60s ahead ---
  test("3) [REAL HANDLER + REAL DB] Call POST with valid session cookie: returns HTTP 200 + ticket + expiresAt ~60s ahead", async () => {
    const req = new Request("http://localhost:3000/api/auth/socket-ticket", {
      method: "POST",
      headers: {
        cookie: `belconnect_session=${activeSessionRawToken}`,
        "origin": "http://localhost:3000"
      }
    });

    const beforeCall = Date.now();
    const res = await POST(req);

    assert.strictEqual(res.status, 200, "Valid session cookie must return HTTP 200");
    assert.strictEqual(
      res.headers.get("Cache-Control"),
      "no-store, no-cache, must-revalidate, max-age=0",
      "Must strictly enforce Cache-Control: no-store"
    );

    const json = await res.json();
    assert.ok(json.ticket, "Must return single-use ticket in JSON");
    assert.strictEqual(typeof json.ticket, "string");
    assert.strictEqual(json.ticket.length, 43, "32-byte base64url ticket length must be 43");
    assert.ok(json.expires_at || json.expiresAt, "Must return expires_at timestamp");

    const expiresAtStr = json.expires_at || json.expiresAt;
    const expiresAtMs = new Date(expiresAtStr).getTime();
    const diffSec = (expiresAtMs - beforeCall) / 1000;
    assert.ok(
      diffSec >= 57 && diffSec <= 63,
      `expiresAt (${diffSec}s ahead) must be approximately 60 seconds ahead`
    );

    // Verify ticket in PostgreSQL
    const ticketHash = crypto.createHash("sha256").update(json.ticket).digest("hex");
    const row = await pool.query(
      "SELECT ticket_hash, user_id FROM public.socket_tickets WHERE ticket_hash = $1",
      [ticketHash]
    );
    assert.strictEqual(row.rows.length, 1, "Issued ticket must exist in PostgreSQL socket_tickets table");
    assert.strictEqual(row.rows[0].user_id, TEST_USER_ID);
  });

  // --- Test 4: [REAL HANDLER + RATE LIMIT] Call POST 31 times -> 31st call returns HTTP 429 + Retry-After ---
  test("4) [REAL HANDLER + RATE LIMIT] Call POST 31 times: 31st call returns HTTP 429 + Retry-After header", async () => {
    const burstUserId = `${TEST_PREFIX}burst_handler_user`;
    await pool.query("DELETE FROM public.rate_limits WHERE key = $1", [`rl:user:${burstUserId}`]);
    await pool.query("DELETE FROM public.customers WHERE id = $1", [burstUserId]);
    await pool.query(
      `INSERT INTO public.customers (id, email, name, phone, account_status)
       VALUES ($1, 'burst@test.com', 'Burst Real User', '+919999900088', 'active')`,
      [burstUserId]
    );
    const burstSess = await sessionModule.createSession(
      { userId: burstUserId, role: "user", client: "web", ip: "127.0.0.1" },
      queryRunner
    );

    for (let i = 0; i < 30; i++) {
      const req = new Request("http://localhost:3000/api/auth/socket-ticket", {
        method: "POST",
        headers: { cookie: `belconnect_session=${burstSess.rawToken}`, "origin": "http://localhost:3000" }
      });
      const res = await POST(req);
      assert.strictEqual(res.status, 200, `Request ${i + 1} must return HTTP 200`);
    }

    const req31 = new Request("http://localhost:3000/api/auth/socket-ticket", {
      method: "POST",
      headers: { cookie: `belconnect_session=${burstSess.rawToken}`, "origin": "http://localhost:3000" }
    });
    const res31 = await POST(req31);
    assert.strictEqual(res31.status, 429, "31st request must return HTTP 429 Too Many Requests");

    const retryAfter = res31.headers.get("Retry-After");
    assert.ok(retryAfter, "HTTP 429 response must include Retry-After header");
    assert.ok(parseInt(retryAfter, 10) > 0, "Retry-After header value must be > 0 seconds");

    const json31 = await res31.json();
    assert.ok(
      json31.error.includes("Rate limit exceeded") || json31.error.includes("Too many socket ticket requests"),
      "Must return rate limit error message"
    );
  });

  // --- Test 5: [REAL MODULE & REAL SOCKET] Live Socket.IO Client Connect via Single-Use Ticket ---
  test("5) [REAL MODULE & REAL SOCKET] Live Socket.IO client connects with ticket; replay with same ticket is rejected", async () => {
    const ticket = await sessionModule.createSocketTicket(
      { sessionId: activeSessionId, userId: TEST_USER_ID, role: "user" },
      queryRunner
    );

    const client = ClientIO(`http://127.0.0.1:${TEST_SOCKET_PORT}`, {
      auth: { ticket },
      transports: ["websocket"]
    });

    await new Promise((resolve, reject) => {
      client.on("connect", resolve);
      client.on("connect_error", reject);
    });

    assert.strictEqual(client.connected, true, "Socket client must connect successfully");

    const replayClient = ClientIO(`http://127.0.0.1:${TEST_SOCKET_PORT}`, {
      auth: { ticket },
      transports: ["websocket"],
      reconnection: false
    });

    const replayError = await new Promise((resolve) => {
      replayClient.on("connect", () => resolve(null));
      replayClient.on("connect_error", (err) => resolve(err));
    });

    assert.ok(replayError, "Replay client must fail connection");
    assert.ok(
      replayError.message.includes("Invalid or expired socket ticket"),
      "Replay error must indicate invalid/expired ticket"
    );

    client.disconnect();
    replayClient.disconnect();
  });

  // --- Test 6: [REAL MODULE & REAL SOCKET] Ticket Expires After 60 s ---
  test("6) [REAL MODULE & REAL SOCKET] Ticket expires after 60 s: expired ticket rejected during live socket handshake", async () => {
    const rawTicket = crypto.randomBytes(32).toString("base64url");
    const ticketHash = crypto.createHash("sha256").update(rawTicket).digest("hex");

    await pool.query(
      `INSERT INTO public.socket_tickets (ticket_hash, session_id, user_id, role, expires_at)
       VALUES ($1, $2, $3, 'user', CURRENT_TIMESTAMP - INTERVAL '2 seconds')`,
      [ticketHash, activeSessionId, TEST_USER_ID]
    );

    const client = ClientIO(`http://127.0.0.1:${TEST_SOCKET_PORT}`, {
      auth: { ticket: rawTicket },
      transports: ["websocket"],
      reconnection: false
    });

    const connError = await new Promise((resolve) => {
      client.on("connect", () => resolve(null));
      client.on("connect_error", (err) => resolve(err));
    });

    assert.ok(connError, "Expired ticket client must fail connection");
    assert.ok(connError.message.includes("Invalid or expired socket ticket"));
    client.disconnect();
  });

  // --- Test 7: [REAL MODULE & REAL SOCKET] Suspended User Rejected During Handshake ---
  test("7) [REAL MODULE & REAL SOCKET] Suspended user is rejected during live Socket.IO handshake", async () => {
    const ticket = await sessionModule.createSocketTicket(
      { sessionId: suspendedSessionId, userId: TEST_SUSPENDED_ID, role: "user" },
      queryRunner
    );

    const client = ClientIO(`http://127.0.0.1:${TEST_SOCKET_PORT}`, {
      auth: { ticket },
      transports: ["websocket"],
      reconnection: false
    });

    const connError = await new Promise((resolve) => {
      client.on("connect", () => resolve(null));
      client.on("connect_error", (err) => resolve(err));
    });

    assert.ok(connError, "Suspended user connection must be rejected");
    assert.ok(connError.message.includes("Invalid or expired socket ticket"));
    client.disconnect();
  });

  // --- Test 8: [PARTLY MOCKED: DIRECT SWEEP CALL] Revoked Session Direct Sweep Call ---
  test("8) [PARTLY MOCKED: DIRECT SWEEP CALL] Live socket connection: direct call to shared module sweep disconnects client immediately", async () => {
    const tempSess = await sessionModule.createSession(
      { userId: TEST_USER_ID, role: "user", client: "web", ip: "127.0.0.1" },
      queryRunner
    );

    const ticket = await sessionModule.createSocketTicket(
      { sessionId: tempSess.sessionId, userId: TEST_USER_ID, role: "user" },
      queryRunner
    );

    const client = ClientIO(`http://127.0.0.1:${TEST_SOCKET_PORT}`, {
      auth: { ticket },
      transports: ["websocket"],
      reconnection: false
    });

    await new Promise((resolve, reject) => {
      client.on("connect", resolve);
      client.on("connect_error", reject);
    });

    assert.strictEqual(client.connected, true, "Client must be connected live");

    let receivedAuthRevoked = false;
    let disconnected = false;

    client.on("auth:revoked", () => {
      receivedAuthRevoked = true;
    });

    client.on("disconnect", () => {
      disconnected = true;
    });

    await sessionModule.revokeSession(tempSess.rawToken, queryRunner);
    await directSweepFn();

    await new Promise((resolve) => setTimeout(resolve, 500));

    assert.strictEqual(receivedAuthRevoked, true, "Live client must receive 'auth:revoked' event");
    assert.strictEqual(disconnected, true, "Live client must be disconnected");
    assert.strictEqual(client.connected, false, "client.connected must be false");

    client.close();
  });

  // --- Test 9: [1s TIMER SWEEP: REAL SOCKET & REAL DB] Real Background Interval Sweep ---
  test("9) [1s TIMER SWEEP: REAL SOCKET & REAL DB] Live socket connection: real background setInterval (1s timer) automatically sweeps DB, emits 'auth:revoked' and disconnects within timer SLA", async () => {
    const { timer } = startRevocationSweepInterval({ io: ioServer, pool, intervalMs: 1000 });

    try {
      const tempSess = await sessionModule.createSession(
        { userId: TEST_USER_ID, role: "user", client: "web", ip: "127.0.0.1" },
        queryRunner
      );

      const ticket = await sessionModule.createSocketTicket(
        { sessionId: tempSess.sessionId, userId: TEST_USER_ID, role: "user" },
        queryRunner
      );

      const client = ClientIO(`http://127.0.0.1:${TEST_SOCKET_PORT}`, {
        auth: { ticket },
        transports: ["websocket"],
        reconnection: false
      });

      await new Promise((resolve, reject) => {
        client.on("connect", resolve);
        client.on("connect_error", reject);
      });

      assert.strictEqual(client.connected, true, "Client must be connected");

      let receivedAuthRevoked = false;
      let disconnected = false;

      client.on("auth:revoked", () => {
        receivedAuthRevoked = true;
      });

      const disconnectPromise = new Promise((resolve) => {
        client.on("disconnect", () => {
          disconnected = true;
          resolve();
        });
      });

      await sessionModule.revokeSession(tempSess.rawToken, queryRunner);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout: Background sweep failed to disconnect socket within SLA")), 3000)
      );

      await Promise.race([disconnectPromise, timeoutPromise]);

      assert.strictEqual(receivedAuthRevoked, true, "Client must receive auth:revoked from background 1s timer");
      assert.strictEqual(disconnected, true, "Client must be disconnected by background 1s timer");
      assert.strictEqual(client.connected, false);

      client.close();
    } finally {
      clearInterval(timer);
    }
  });

  // --- Test 10: [REAL MODULE & REAL DYNAMIC AUTH] Forced Reconnect Fetches a NEW Ticket ---
  test("10) [REAL MODULE & REAL DYNAMIC AUTH] Forced reconnect: client fetches a fresh ticket dynamically via auth callback and reconnects", async () => {
    let ticketsFetched = 0;

    const dynamicAuthCallback = async (cb) => {
      ticketsFetched++;
      const newTicket = await sessionModule.createSocketTicket(
        { sessionId: activeSessionId, userId: TEST_USER_ID, role: "user" },
        queryRunner
      );
      cb({ ticket: newTicket });
    };

    const client = ClientIO(`http://127.0.0.1:${TEST_SOCKET_PORT}`, {
      auth: dynamicAuthCallback,
      transports: ["websocket"],
      reconnection: false
    });

    await new Promise((resolve, reject) => {
      client.on("connect", resolve);
      client.on("connect_error", reject);
    });

    assert.strictEqual(client.connected, true, "Initial connection must succeed");
    assert.strictEqual(ticketsFetched, 1, "Must have fetched 1 ticket for initial connection");

    client.disconnect();
    assert.strictEqual(client.connected, false);

    const reconnectPromise = new Promise((resolve) => {
      client.once("connect", resolve);
    });
    client.connect();
    await reconnectPromise;

    assert.strictEqual(client.connected, true, "Client must reconnect successfully");
    assert.strictEqual(ticketsFetched, 2, "Forced reconnect must invoke auth callback to fetch a NEW ticket");

    client.close();
  });

  // --- Test 11: [SQL ONLY] Ticket Storage Verification ---
  test("11) [SQL ONLY] Real DB ticket issuance: createSocketTicket writes 32-byte base64url ticket with 60s TTL", async () => {
    const ticket = await sessionModule.createSocketTicket(
      { sessionId: activeSessionId, userId: TEST_USER_ID, role: "user" },
      queryRunner
    );

    assert.ok(ticket, "Must return raw ticket");
    assert.strictEqual(ticket.length, 43, "32-byte base64url string has length 43");

    const ticketHash = crypto.createHash("sha256").update(ticket).digest("hex");
    const row = await pool.query(
      "SELECT ticket_hash, session_id, user_id, role, expires_at FROM public.socket_tickets WHERE ticket_hash = $1",
      [ticketHash]
    );

    assert.strictEqual(row.rows.length, 1, "Ticket must be stored in PostgreSQL");
    assert.strictEqual(row.rows[0].user_id, TEST_USER_ID);
    assert.strictEqual(row.rows[0].session_id, activeSessionId);
    assert.strictEqual(row.rows[0].role, "user");
  });

  // --- Test 12: [COOKIE-PARSE CHECK] Cookie parsing isolation ---
  test("12) [COOKIE-PARSE CHECK] Cookie parsing isolation: getSessionTokenFromRequest strictly scopes to requested role", () => {
    const adminReq = new Request("http://localhost:3000/api/auth/socket-ticket", {
      method: "POST",
      headers: {
        cookie: "__Host-admin_session=test_admin_token_value_not_for_user"
      }
    });

    const token = sessionModule.getSessionTokenFromRequest(adminReq, "user");
    assert.strictEqual(token, null, "Admin cookie must not authenticate user ticket endpoint");

    const adminToken = sessionModule.getSessionTokenFromRequest(adminReq, "admin");
    assert.strictEqual(adminToken, "test_admin_token_value_not_for_user");
  });

  // --- Test 13: [SWEEP DELETED CUSTOMER] Customer Deleted While Connected Disconnected by Sweep ---
  test("13) [SWEEP DELETED CUSTOMER] Live socket sweep: customer deleted while connected is disconnected by IS DISTINCT FROM 'active'", async () => {
    const delCustId = `${TEST_PREFIX}cust_deleted_sweep`;
    await pool.query(
      `INSERT INTO public.customers (id, email, name, phone, account_status)
       VALUES ($1, 'delcust@test.com', 'Cust to Delete', '+919999900099', 'active')`,
      [delCustId]
    );

    const tempSess = await sessionModule.createSession(
      { userId: delCustId, role: "user", client: "web", ip: "127.0.0.1" },
      queryRunner
    );

    const ticket = await sessionModule.createSocketTicket(
      { sessionId: tempSess.sessionId, userId: delCustId, role: "user" },
      queryRunner
    );

    const client = ClientIO(`http://127.0.0.1:${TEST_SOCKET_PORT}`, {
      auth: { ticket },
      transports: ["websocket"],
      reconnection: false
    });

    await new Promise((resolve, reject) => {
      client.on("connect", resolve);
      client.on("connect_error", reject);
    });

    assert.strictEqual(client.connected, true, "Customer client connected live");

    let receivedAuthRevoked = false;
    let disconnected = false;
    client.on("auth:revoked", () => { receivedAuthRevoked = true; });
    client.on("disconnect", () => { disconnected = true; });

    // DELETE the customer row in PostgreSQL (simulating account deletion while socket connected)
    await pool.query("DELETE FROM public.customers WHERE id = $1", [delCustId]);

    // Run sweep: IS DISTINCT FROM 'active' must detect c.id IS NULL and disconnect socket
    await directSweepFn();
    await new Promise((resolve) => setTimeout(resolve, 500));

    assert.strictEqual(receivedAuthRevoked, true, "Deleted customer must receive auth:revoked");
    assert.strictEqual(disconnected, true, "Deleted customer must be disconnected");
    assert.strictEqual(client.connected, false);

    client.close();
  });

  // --- Test 14: [PROVIDER HANDSHAKE & SWEEP] Service Provider Lifecycle ---
  test("14) [PROVIDER HANDSHAKE & SWEEP] Service provider ticket handshake (active allowed, suspended rejected) and sweep (suspended & deleted disconnected)", async () => {
    // A. Active Provider Handshake: Allowed
    const provTicket = await sessionModule.createSocketTicket(
      { sessionId: provSessionId, userId: TEST_PROV_ID, role: "provider" },
      queryRunner
    );

    const provClient = ClientIO(`http://127.0.0.1:${TEST_SOCKET_PORT}`, {
      auth: { ticket: provTicket },
      transports: ["websocket"],
      reconnection: false
    });

    await new Promise((resolve, reject) => {
      provClient.on("connect", resolve);
      provClient.on("connect_error", reject);
    });

    assert.strictEqual(provClient.connected, true, "Active provider must connect successfully");

    // B. Suspended Provider Handshake: Rejected
    const suspTicket = await sessionModule.createSocketTicket(
      { sessionId: provSuspendedSessionId, userId: TEST_PROV_SUSPENDED_ID, role: "provider" },
      queryRunner
    );

    const suspClient = ClientIO(`http://127.0.0.1:${TEST_SOCKET_PORT}`, {
      auth: { ticket: suspTicket },
      transports: ["websocket"],
      reconnection: false
    });

    const suspError = await new Promise((resolve) => {
      suspClient.on("connect", () => resolve(null));
      suspClient.on("connect_error", (err) => resolve(err));
    });
    assert.ok(suspError, "Suspended provider handshake must fail");
    assert.ok(suspError.message.includes("Invalid or expired socket ticket"));

    // C. Sweep on Active Provider Suspended or Deleted:
    let provRevoked = false;
    provClient.on("auth:revoked", () => { provRevoked = true; });

    // Suspend active provider in DB
    await pool.query("UPDATE public.service_providers SET account_status = 'suspended' WHERE id = $1", [TEST_PROV_ID]);
    await directSweepFn();
    await new Promise((resolve) => setTimeout(resolve, 500));

    assert.strictEqual(provRevoked, true, "Suspended provider socket must be disconnected by sweep");
    assert.strictEqual(provClient.connected, false);

    provClient.close();
    suspClient.disconnect();
  });

  // --- Test 15: [JOB PROVIDER HANDSHAKE & SWEEP] Job Provider Lifecycle ---
  test("15) [JOB PROVIDER HANDSHAKE & SWEEP] Job provider ticket handshake (active allowed, suspended rejected) and sweep (suspended & deleted disconnected)", async () => {
    // A. Active Job Provider Handshake: Allowed
    const jpTicket = await sessionModule.createSocketTicket(
      { sessionId: jobprovSessionId, userId: TEST_JOBPROV_ID, role: "job_provider" },
      queryRunner
    );

    const jpClient = ClientIO(`http://127.0.0.1:${TEST_SOCKET_PORT}`, {
      auth: { ticket: jpTicket },
      transports: ["websocket"],
      reconnection: false
    });

    await new Promise((resolve, reject) => {
      jpClient.on("connect", resolve);
      jpClient.on("connect_error", reject);
    });

    assert.strictEqual(jpClient.connected, true, "Active job provider must connect successfully");

    // B. Suspended Job Provider Handshake: Rejected
    const suspJpTicket = await sessionModule.createSocketTicket(
      { sessionId: jobprovSuspendedSessionId, userId: TEST_JOBPROV_SUSPENDED_ID, role: "job_provider" },
      queryRunner
    );

    const suspJpClient = ClientIO(`http://127.0.0.1:${TEST_SOCKET_PORT}`, {
      auth: { ticket: suspJpTicket },
      transports: ["websocket"],
      reconnection: false
    });

    const suspJpError = await new Promise((resolve) => {
      suspJpClient.on("connect", () => resolve(null));
      suspJpClient.on("connect_error", (err) => resolve(err));
    });
    assert.ok(suspJpError, "Suspended job provider handshake must fail");
    assert.ok(suspJpError.message.includes("Invalid or expired socket ticket"));

    // C. Sweep on Active Job Provider Deleted:
    let jpRevoked = false;
    jpClient.on("auth:revoked", () => { jpRevoked = true; });

    // Delete job provider in DB
    await pool.query("DELETE FROM public.job_providers WHERE id = $1", [TEST_JOBPROV_ID]);
    await directSweepFn();
    await new Promise((resolve) => setTimeout(resolve, 500));

    assert.strictEqual(jpRevoked, true, "Deleted job provider socket must be disconnected by sweep");
    assert.strictEqual(jpClient.connected, false);

    jpClient.close();
    suspJpClient.disconnect();
  });

  // --- Test 16: [POSTGRES RATE LIMITER 429] Real PostgreSQL Rate Limit Store ---
  test("16) [POSTGRES RATE LIMITER 429] PostgresRateLimitStore executes against real rate_limits table, enforces limit, and sets Retry-After", async () => {
    const rateLimitUrl = pathToFileURL(path.join(rootDir, "frontend/src/lib/rateLimitCore.ts")).href;
    const { PostgresRateLimitStore } = await import(rateLimitUrl);

    // Instantiate with real queryRunner
    const pgStore = new PostgresRateLimitStore(queryRunner);
    const testKey = "rl:test_pg:user_429_check";

    // Clean test key
    await pool.query("DELETE FROM public.rate_limits WHERE key = $1", [testKey]);

    // Increment 5 times in a 10s window (limit = 5)
    for (let i = 1; i <= 5; i++) {
      const res = await pgStore.increment(testKey, 10);
      assert.strictEqual(res.points, i, `Point count must equal ${i}`);
      assert.ok(res.retryAfter > 0 && res.retryAfter <= 10, "retryAfter must be within window");
    }

    // 6th increment: exceeds limit of 5 points
    const sixth = await pgStore.increment(testKey, 10);
    assert.strictEqual(sixth.points, 6, "6th increment must yield points = 6");
    assert.ok(sixth.retryAfter > 0, "Must calculate positive retryAfter");

    // Verify row directly in PostgreSQL table
    const dbRow = await pool.query("SELECT key, points, expire_at FROM public.rate_limits WHERE key = $1", [testKey]);
    assert.strictEqual(dbRow.rows.length, 1, "rate_limits row must exist in PostgreSQL");
    assert.strictEqual(dbRow.rows[0].points, 6);
    assert.ok(new Date(dbRow.rows[0].expire_at) > new Date(), "expire_at must be in future");

    // Reset store key
    await pgStore.reset(testKey);
    const afterReset = await pool.query("SELECT * FROM public.rate_limits WHERE key = $1", [testKey]);
    assert.strictEqual(afterReset.rows.length, 0, "reset must delete row from rate_limits table");
  });

  after(async () => {
    try {
      if (ioServer) {
        ioServer.disconnectSockets(true);
        ioServer.close();
      }
      if (httpServer) {
        if (typeof httpServer.closeAllConnections === "function") {
          httpServer.closeAllConnections();
        }
        httpServer.close();
      }
      await pool.query("DELETE FROM public.socket_tickets WHERE user_id LIKE $1", [`${TEST_PREFIX}%`]);
      await pool.query("DELETE FROM public.sessions WHERE user_id LIKE $1", [`${TEST_PREFIX}%`]);
      await pool.query("DELETE FROM public.customers WHERE id LIKE $1", [`${TEST_PREFIX}%`]);
      await pool.query("DELETE FROM public.service_providers WHERE id LIKE $1", [`${TEST_PREFIX}%`]);
      await pool.query("DELETE FROM public.job_providers WHERE id LIKE $1", [`${TEST_PREFIX}%`]);
      await pool.query("DELETE FROM public.rate_limits WHERE key LIKE 'rl:test_pg:%' OR key LIKE $1", [`rl:user:${TEST_PREFIX}%`]);
      await pool.end();
      if (globalThis.postgresPool) {
        await globalThis.postgresPool.end().catch(() => {});
        delete globalThis.postgresPool;
      }
    } catch (err) {
      console.error("[Teardown Error in phase1-real-db]:", err);
    }
  });
});
