/**
 * BelConnect - PostgreSQL Real Database Integration Test
 * Validates Migration 035 and Session Engine against live test database.
 * Strictly requires TEST_DATABASE_URL with 'test' or 'staging' in db name.
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const { validateTestDatabaseUrl } = require("./db-guard");
const guard = validateTestDatabaseUrl();

const rootDir = path.resolve(__dirname, "../../");
const sessionModule = require(path.join(rootDir, "frontend/src/lib/session.ts"));

const suite = guard.shouldRun ? describe : describe.skip;

suite("PostgreSQL Real Integration Tests: Migration 035 & Session Engine", () => {
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

  const TEST_PREFIX = "test_pg_sess_";
  const TEST_CUSTOMER_ID = `${TEST_PREFIX}cust_01`;
  const TEST_PROVIDER_ID = `${TEST_PREFIX}prov_01`;
  const TEST_JOB_PROVIDER_ID = `${TEST_PREFIX}jobprov_01`;
  const TEST_ADMIN_ID = `${TEST_PREFIX}admin_01`;
  const TEST_SUSPENDED_ID = `${TEST_PREFIX}cust_suspended`;

  before(async () => {
    console.log("Applying Migration 035 to Test PostgreSQL...");
    const migrationSql = fs.readFileSync(
      path.join(rootDir, "database/migrations/035_server_side_sessions.sql"),
      "utf8"
    );
    await pool.query(migrationSql);

    // Clean up test prefix
    await pool.query("DELETE FROM public.socket_tickets WHERE user_id LIKE $1", [`${TEST_PREFIX}%`]);
    await pool.query("DELETE FROM public.sessions WHERE user_id LIKE $1", [`${TEST_PREFIX}%`]);
    await pool.query("DELETE FROM public.customers WHERE id LIKE $1", [`${TEST_PREFIX}%`]);
    await pool.query("DELETE FROM public.service_providers WHERE id LIKE $1", [`${TEST_PREFIX}%`]);
    await pool.query("DELETE FROM public.job_providers WHERE id LIKE $1", [`${TEST_PREFIX}%`]);
    await pool.query("DELETE FROM public.admins WHERE id LIKE $1", [`${TEST_PREFIX}%`]);

    await pool.query(
      `INSERT INTO public.customers (id, email, name, phone, account_status)
       VALUES ($1, 'test.cust@belconnect.com', 'Test Customer', '9876543210', 'active')`,
      [TEST_CUSTOMER_ID]
    );

    await pool.query(
      `INSERT INTO public.customers (id, email, name, phone, account_status)
       VALUES ($1, 'suspended.cust@belconnect.com', 'Suspended Customer', '9876543211', 'suspended')`,
      [TEST_SUSPENDED_ID]
    );

    await pool.query(
      `INSERT INTO public.service_providers (id, email, name, phone, account_status)
       VALUES ($1, 'test.prov@belconnect.com', 'Test Provider', '9876543212', 'active')`,
      [TEST_PROVIDER_ID]
    );

    await pool.query(
      `INSERT INTO public.job_providers (id, email, name, phone, account_status)
       VALUES ($1, 'test.jobprov@belconnect.com', 'Test JobProvider', '9876543213', 'active')`,
      [TEST_JOB_PROVIDER_ID]
    );

    await pool.query(
      `INSERT INTO public.admins (id, email, password_hash)
       VALUES ($1, 'test.admin@belconnect.com', '$argon2id$mockedhash')`,
      [TEST_ADMIN_ID]
    );
  });

  after(async () => {
    await pool.query("DELETE FROM public.socket_tickets WHERE user_id LIKE $1", [`${TEST_PREFIX}%`]);
    await pool.query("DELETE FROM public.sessions WHERE user_id LIKE $1", [`${TEST_PREFIX}%`]);
    await pool.query("DELETE FROM public.customers WHERE id LIKE $1", [`${TEST_PREFIX}%`]);
    await pool.query("DELETE FROM public.service_providers WHERE id LIKE $1", [`${TEST_PREFIX}%`]);
    await pool.query("DELETE FROM public.job_providers WHERE id LIKE $1", [`${TEST_PREFIX}%`]);
    await pool.query("DELETE FROM public.admins WHERE id LIKE $1", [`${TEST_PREFIX}%`]);
    await pool.end();
  });

  test("1) Create and validate session for customer (user role)", async () => {
    const { rawToken, sessionId } = await sessionModule.createSession(
      { userId: TEST_CUSTOMER_ID, role: "user" },
      queryRunner
    );
    assert.ok(rawToken && sessionId);

    const user = await sessionModule.validateSession(rawToken, queryRunner);
    assert.ok(user, "Customer session must validate");
    assert.strictEqual(user.userId, TEST_CUSTOMER_ID);
    assert.strictEqual(user.email, "test.cust@belconnect.com");
    assert.strictEqual(user.name, "Test Customer");
    assert.strictEqual(user.role, "user");
  });

  test("2) Create and validate session for service_provider (provider role)", async () => {
    const { rawToken } = await sessionModule.createSession(
      { userId: TEST_PROVIDER_ID, role: "provider" },
      queryRunner
    );
    const user = await sessionModule.validateSession(rawToken, queryRunner);
    assert.ok(user, "Provider session must validate");
    assert.strictEqual(user.userId, TEST_PROVIDER_ID);
    assert.strictEqual(user.email, "test.prov@belconnect.com");
    assert.strictEqual(user.name, "Test Provider");
    assert.strictEqual(user.role, "provider");
  });

  test("3) Create and validate session for job_provider", async () => {
    const { rawToken } = await sessionModule.createSession(
      { userId: TEST_JOB_PROVIDER_ID, role: "job_provider" },
      queryRunner
    );
    const user = await sessionModule.validateSession(rawToken, queryRunner);
    assert.ok(user, "Job provider session must validate");
    assert.strictEqual(user.userId, TEST_JOB_PROVIDER_ID);
    assert.strictEqual(user.email, "test.jobprov@belconnect.com");
    assert.strictEqual(user.role, "job_provider");
  });

  test("4) Create and validate session for admin (without a.name column)", async () => {
    const { rawToken } = await sessionModule.createSession(
      { userId: TEST_ADMIN_ID, role: "admin" },
      queryRunner
    );
    const user = await sessionModule.validateSession(rawToken, queryRunner);
    assert.ok(user, "Admin session must validate against PostgreSQL without runtime column errors");
    assert.strictEqual(user.userId, TEST_ADMIN_ID);
    assert.strictEqual(user.email, "test.admin@belconnect.com");
    assert.strictEqual(user.role, "admin");
    assert.strictEqual(user.name, "test.admin@belconnect.com");
  });

  test("5) Revoked session is rejected immediately", async () => {
    const { rawToken } = await sessionModule.createSession(
      { userId: TEST_CUSTOMER_ID, role: "user" },
      queryRunner
    );
    const revRes = await sessionModule.revokeSession(rawToken, queryRunner);
    assert.strictEqual(revRes, true);

    const check = await sessionModule.validateSession(rawToken, queryRunner);
    assert.strictEqual(check, null, "Revoked session must return null");
  });

  test("6) Idle-expired session is rejected by database CURRENT_TIMESTAMP", async () => {
    const { rawToken, sessionId } = await sessionModule.createSession(
      { userId: TEST_CUSTOMER_ID, role: "user" },
      queryRunner
    );
    await pool.query(
      "UPDATE public.sessions SET idle_expires_at = CURRENT_TIMESTAMP - INTERVAL '10 seconds' WHERE id = $1",
      [sessionId]
    );

    const check = await sessionModule.validateSession(rawToken, queryRunner);
    assert.strictEqual(check, null, "Idle expired session must return null");
  });

  test("7) Absolute-expired session is rejected by database CURRENT_TIMESTAMP", async () => {
    const { rawToken, sessionId } = await sessionModule.createSession(
      { userId: TEST_CUSTOMER_ID, role: "user" },
      queryRunner
    );
    await pool.query(
      "UPDATE public.sessions SET absolute_expires_at = CURRENT_TIMESTAMP - INTERVAL '10 seconds' WHERE id = $1",
      [sessionId]
    );

    const check = await sessionModule.validateSession(rawToken, queryRunner);
    assert.strictEqual(check, null, "Absolute expired session must return null");
  });

  test("8) Suspended account session is rejected immediately", async () => {
    const { rawToken } = await sessionModule.createSession(
      { userId: TEST_SUSPENDED_ID, role: "user" },
      queryRunner
    );
    const check = await sessionModule.validateSession(rawToken, queryRunner);
    assert.strictEqual(check, null, "Suspended account session must return null");
  });

  test("9) Deleted row user session is rejected immediately", async () => {
    const nonExistentUserId = `${TEST_PREFIX}ghost_user`;
    const { rawToken } = await sessionModule.createSession(
      { userId: nonExistentUserId, role: "user" },
      queryRunner
    );
    const check = await sessionModule.validateSession(rawToken, queryRunner);
    assert.strictEqual(check, null, "Deleted/non-existent user session must return null");
  });

  test("10) Revoke-all with and without exceptSessionId", async () => {
    const s1 = await sessionModule.createSession({ userId: TEST_CUSTOMER_ID, role: "user" }, queryRunner);
    const s2 = await sessionModule.createSession({ userId: TEST_CUSTOMER_ID, role: "user" }, queryRunner);
    const s3 = await sessionModule.createSession({ userId: TEST_CUSTOMER_ID, role: "user" }, queryRunner);

    const countExcluding = await sessionModule.revokeAllSessionsForUser(TEST_CUSTOMER_ID, s3.sessionId, queryRunner);
    assert.ok(countExcluding >= 2, "Must revoke at least 2 sessions");

    assert.strictEqual(await sessionModule.validateSession(s1.rawToken, queryRunner), null);
    assert.strictEqual(await sessionModule.validateSession(s2.rawToken, queryRunner), null);
    const s3Check = await sessionModule.validateSession(s3.rawToken, queryRunner);
    assert.ok(s3Check, "Excluded session must remain active");

    await sessionModule.revokeAllSessionsForUser(TEST_CUSTOMER_ID, undefined, queryRunner);
    assert.strictEqual(await sessionModule.validateSession(s3.rawToken, queryRunner), null);
  });

  test("11) Throttled session touch: no write inside 60s, slides idle after 60s, bounded by absolute cap", async () => {
    const { rawToken, sessionId } = await sessionModule.createSession(
      { userId: TEST_CUSTOMER_ID, role: "user" },
      queryRunner
    );

    const resInitial = await pool.query(
      "SELECT last_seen_at, idle_expires_at, absolute_expires_at FROM public.sessions WHERE id = $1",
      [sessionId]
    );
    const initialLastSeen = new Date(resInitial.rows[0].last_seen_at).getTime();

    await sessionModule.validateSession(rawToken, queryRunner);
    const resAfterImmediate = await pool.query(
      "SELECT last_seen_at FROM public.sessions WHERE id = $1",
      [sessionId]
    );
    const postImmediateLastSeen = new Date(resAfterImmediate.rows[0].last_seen_at).getTime();
    assert.strictEqual(initialLastSeen, postImmediateLastSeen, "No touch write should occur inside 60s");

    await pool.query(
      "UPDATE public.sessions SET last_seen_at = CURRENT_TIMESTAMP - INTERVAL '75 seconds' WHERE id = $1",
      [sessionId]
    );

    await sessionModule.validateSession(rawToken, queryRunner);
    const resAfterTouch = await pool.query(
      "SELECT last_seen_at, idle_expires_at, absolute_expires_at FROM public.sessions WHERE id = $1",
      [sessionId]
    );
    const updatedLastSeen = new Date(resAfterTouch.rows[0].last_seen_at).getTime();
    assert.ok(updatedLastSeen > postImmediateLastSeen, "last_seen_at must be updated after 60s");

    await pool.query(
      `UPDATE public.sessions 
       SET absolute_expires_at = CURRENT_TIMESTAMP + INTERVAL '10 minutes',
           idle_expires_at = CURRENT_TIMESTAMP + INTERVAL '5 minutes',
           last_seen_at = CURRENT_TIMESTAMP - INTERVAL '75 seconds'
       WHERE id = $1`,
      [sessionId]
    );

    await sessionModule.validateSession(rawToken, queryRunner);
    const resCapCheck = await pool.query(
      "SELECT idle_expires_at, absolute_expires_at FROM public.sessions WHERE id = $1",
      [sessionId]
    );
    const idleTime = new Date(resCapCheck.rows[0].idle_expires_at).getTime();
    const absTime = new Date(resCapCheck.rows[0].absolute_expires_at).getTime();
    assert.ok(idleTime <= absTime, "idle_expires_at must never exceed absolute_expires_at");
  });

  test("12) Single-use WebRTC socket tickets with ticket_hash", async () => {
    const { sessionId } = await sessionModule.createSession(
      { userId: TEST_CUSTOMER_ID, role: "user" },
      queryRunner
    );

    const ticket = await sessionModule.createSocketTicket(
      { sessionId, userId: TEST_CUSTOMER_ID, role: "user" },
      queryRunner
    );
    assert.ok(ticket, "Must generate raw socket ticket");

    const validated = await sessionModule.validateSocketTicket(ticket, queryRunner);
    assert.ok(validated, "Socket ticket must validate successfully");
    assert.strictEqual(validated.sessionId, sessionId);
    assert.strictEqual(validated.userId, TEST_CUSTOMER_ID);
    assert.strictEqual(validated.role, "user");

    const secondValidation = await sessionModule.validateSocketTicket(ticket, queryRunner);
    assert.strictEqual(secondValidation, null, "Consumed socket ticket must be rejected on second use");
  });
});
