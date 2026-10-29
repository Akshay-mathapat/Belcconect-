const { test, describe } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

const dbModulePath = path.resolve(__dirname, "../../frontend/src/lib/db.ts");

describe("db.ts Production Mode vs Test Mode Guard Tests", () => {
  const originalEnv = { ...process.env };

  const cleanup = () => {
    process.env = { ...originalEnv };
    if (globalThis.postgresPool) {
      delete globalThis.postgresPool;
    }
  };

  test("1) Production mode: remote database host connects normally without throwing", () => {
    cleanup();
    process.env.NODE_ENV = "production";
    delete process.env.BELCONNECT_TEST_MODE;
    delete process.env.ALLOW_PROD_DB;
    delete process.env.TEST_DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://user:pass@dpg-prod-cloud-db.oregon-postgres.render.com:5432/belconnect_prod";

    // Delete require cache so db.ts re-evaluates
    delete require.cache[require.resolve(dbModulePath)];
    const db = require(dbModulePath);

    const resolved = db.resolveDatabaseUrl();
    assert.strictEqual(
      resolved,
      "postgresql://user:pass@dpg-prod-cloud-db.oregon-postgres.render.com:5432/belconnect_prod",
      "Production must resolve DATABASE_URL directly"
    );

    // In production mode, getPool() must NOT throw for remote host
    let pool;
    assert.doesNotThrow(() => {
      pool = db.getPool();
    }, "Production mode must allow connecting to remote cloud database host");

    assert.ok(pool, "Pool must be initialized");
    cleanup();
  });

  test("2) Test mode (NODE_ENV=test): remote database host is blocked and throws FATAL error", () => {
    cleanup();
    process.env.NODE_ENV = "test";
    delete process.env.ALLOW_PROD_DB;
    delete process.env.TEST_DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://user:pass@dpg-prod-cloud-db.oregon-postgres.render.com:5432/belconnect_prod";

    delete require.cache[require.resolve(dbModulePath)];
    const db = require(dbModulePath);

    assert.throws(
      () => {
        db.getPool();
      },
      /FATAL: Refusing connection to non-local host \(dpg-prod-cloud-db\.oregon-postgres\.render\.com\) in test mode/,
      "Test mode must block non-local hosts and throw FATAL error"
    );

    cleanup();
  });

  test("3) Test mode (BELCONNECT_TEST_MODE=1): remote database host is blocked and throws FATAL error", () => {
    cleanup();
    process.env.NODE_ENV = "development";
    process.env.BELCONNECT_TEST_MODE = "1";
    delete process.env.ALLOW_PROD_DB;
    delete process.env.TEST_DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://user:pass@dpg-prod-cloud-db.oregon-postgres.render.com:5432/belconnect_prod";

    delete require.cache[require.resolve(dbModulePath)];
    const db = require(dbModulePath);

    assert.throws(
      () => {
        db.getPool();
      },
      /FATAL: Refusing connection to non-local host \(dpg-prod-cloud-db\.oregon-postgres\.render\.com\) in test mode/,
      "BELCONNECT_TEST_MODE=1 must block non-local hosts"
    );

    cleanup();
  });

  test("4) Test mode + ALLOW_PROD_DB=1: remote database host connects with explicit override", () => {
    cleanup();
    process.env.NODE_ENV = "test";
    process.env.ALLOW_PROD_DB = "1";
    delete process.env.TEST_DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://user:pass@dpg-prod-cloud-db.oregon-postgres.render.com:5432/belconnect_prod";

    delete require.cache[require.resolve(dbModulePath)];
    const db = require(dbModulePath);

    let pool;
    assert.doesNotThrow(() => {
      pool = db.getPool();
    }, "ALLOW_PROD_DB=1 must allow connection to proceed");

    assert.ok(pool);
    cleanup();
  });
});

