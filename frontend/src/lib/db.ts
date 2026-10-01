import { Pool, PoolClient } from "pg";
import crypto from "crypto";
import argon2 from "argon2";

/**
 * BelConnect PostgreSQL runtime database connection.
 *
 * IMPORTANT:
 * - Do NOT run migrations from API requests.
 * - Do NOT CREATE / ALTER / DROP tables here.
 * - Do NOT seed or delete application data here.
 * - Database schema changes belong in /migrations.
 */

declare global {
  // eslint-disable-next-line no-var
  var postgresPool: Pool | undefined;
}

/**
 * Compatibility result type for the existing BelConnect codebase.
 *
 * rows is intentionally any[] because many existing API routes dynamically
 * access and extend PostgreSQL row objects.
 */
export interface BelConnectQueryResult {
  rows: any[];
  rowCount: number | null;
  command: string;
  fields: any[];
}

/**
 * Lightweight pool statistics used only for diagnostics/load testing.
 */
export interface BelConnectPoolStats {
  total: number;
  idle: number;
  waiting: number;
}

/**
 * Safely read a positive integer environment variable.
 *
 * Prevents invalid values such as:
 *
 * DB_POOL_MAX=abc
 *
 * from becoming NaN inside node-postgres configuration.
 */
function readPositiveInt(
  value: string | undefined,
  fallback: number
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

/**
 * Return the shared PostgreSQL connection pool.
 */
export function getPool(): Pool {
  if (globalThis.postgresPool) {
    return globalThis.postgresPool;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "FATAL: DATABASE_URL environment variable is missing."
    );
  }

  let hostInfo = "unknown-host";

  try {
    const parsedUrl = new URL(connectionString);
    hostInfo = parsedUrl.hostname || "unknown-host";
  } catch {
    /**
     * Never print DATABASE_URL because it may contain credentials.
     */
    throw new Error(
      "FATAL: DATABASE_URL is not a valid PostgreSQL connection URL."
    );
  }

  const normalizedHost = hostInfo.toLowerCase();

  /**
   * Prevent Vercel/production from accidentally connecting to
   * the developer machine's local PostgreSQL instance.
   */
  if (
    process.env.VERCEL &&
    process.env.NODE_ENV === "production" &&
    (
      normalizedHost === "localhost" ||
      normalizedHost === "127.0.0.1" ||
      normalizedHost === "::1"
    )
  ) {
    throw new Error(
      `FATAL: DATABASE_URL in production points to a local database host (${hostInfo}). ` +
        "Configure the production cloud PostgreSQL DATABASE_URL."
    );
  }

  const isLocalHost =
    normalizedHost === "localhost" ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "::1";

  /**
   * Cloud PostgreSQL providers generally require SSL.
   *
   * Local development/testing does not.
   */
  const useSsl =
    !isLocalHost &&
    (
      process.env.NODE_ENV === "production" ||
      normalizedHost.includes("render.com") ||
      normalizedHost.includes("neon.tech") ||
      normalizedHost.includes("supabase")
    );

  /**
   * IMPORTANT:
   *
   * Vercel is serverless. Multiple runtime instances may exist
   * simultaneously and every instance may create its own pool.
   *
   * Example:
   *
   * 10 Vercel instances × pool max 5 = up to 50 DB connections
   *
   * A long-running local/Node server uses one shared process,
   * so a moderately larger pool is acceptable.
   */
  const defaultPoolMax = process.env.VERCEL ? 5 : 20;

  const poolMax = readPositiveInt(
    process.env.DB_POOL_MAX,
    defaultPoolMax
  );

  const idleTimeoutMillis = readPositiveInt(
    process.env.DB_IDLE_TIMEOUT_MS,
    60_000
  );

  const connectionTimeoutMillis = readPositiveInt(
    process.env.DB_CONNECTION_TIMEOUT_MS,
    15_000
  );

  const statementTimeoutMillis = readPositiveInt(
    process.env.DB_STATEMENT_TIMEOUT_MS,
    10_000
  );

  const queryTimeoutMillis = readPositiveInt(
    process.env.DB_QUERY_TIMEOUT_MS,
    12_000
  );

  console.log(
    `[Database] Creating PostgreSQL pool host=${hostInfo} max=${poolMax}`
  );

  globalThis.postgresPool = new Pool({
    connectionString,

    ssl: useSsl
      ? {
          rejectUnauthorized: false,
        }
      : false,

    /**
     * Maximum connections owned by THIS Node process/runtime.
     *
     * Local / long-running server:
     * default = 20
     *
     * Vercel/serverless:
     * default = 5
     */
    max: poolMax,

    /**
     * Keep idle connections alive long enough to absorb traffic bursts
     * without constantly destroying and recreating PostgreSQL sessions.
     */
    idleTimeoutMillis,

    /**
     * Maximum time node-postgres may wait while establishing/acquiring
     * a PostgreSQL connection.
     */
    connectionTimeoutMillis,

    /**
     * PostgreSQL server-side statement timeout.
     *
     * Prevents individual SQL statements from occupying a connection
     * indefinitely.
     */
    statement_timeout: statementTimeoutMillis,

    /**
     * node-postgres application-side query timeout.
     *
     * This is intentionally slightly larger than statement_timeout.
     */
    query_timeout: queryTimeoutMillis,

    /**
     * TCP keepalive helps detect broken DB connections and reduces the
     * chance of stale sockets being reused after network interruptions.
     */
    keepAlive: true,

    keepAliveInitialDelayMillis: 10_000,

    /**
     * Keep the pool alive while the process itself is alive.
     */
    allowExitOnIdle: false,
  });

  /**
   * Handle errors emitted by idle clients.
   *
   * Without this listener, an unexpected idle-client error can become
   * an unhandled process-level error.
   */
  globalThis.postgresPool.on("error", (error) => {
    console.error(
      "[Database] Unexpected idle PostgreSQL client error:",
      error instanceof Error
        ? error.message
        : String(error)
    );
  });

  return globalThis.postgresPool;
}

/**
 * Return current pool statistics.
 *
 * Useful during load testing:
 *
 * console.log(getPoolStats());
 *
 * Do NOT log this on every production request.
 */
export function getPoolStats(): BelConnectPoolStats {
  const pool = getPool();

  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}

/**
 * Detect errors that indicate temporary PostgreSQL/database
 * unavailability.
 *
 * API routes can use this to return HTTP 503 instead of an
 * unexplained generic 500.
 */
export function isDatabaseUnavailableError(
  error: unknown
): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes("connection timeout") ||
    message.includes("connection terminated") ||
    message.includes("connection refused") ||
    message.includes("too many clients") ||
    message.includes("remaining connection slots") ||
    message.includes("database system is starting up") ||
    message.includes("database system is shutting down")
  );
}

/**
 * Hash new passwords using Argon2id.
 */
export async function hashPassword(
  password: string
): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
  });
}

/**
 * Verify an account password.
 *
 * New/current passwords use Argon2.
 *
 * SHA-256 support is retained only for compatibility with
 * old seeded/demo accounts.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  if (!hash) {
    return false;
  }

  if (
    hash.startsWith("$argon2id$") ||
    hash.startsWith("$argon2i$") ||
    hash.startsWith("$argon2d$")
  ) {
    try {
      return await argon2.verify(
        hash,
        password
      );
    } catch {
      return false;
    }
  }

  /**
   * Legacy SHA-256 compatibility.
   *
   * Do not use this method for new passwords.
   */
  const legacyHash = crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");

  return legacyHash === hash;
}

/**
 * Backwards-compatible initialization function.
 *
 * Some existing BelConnect files may still import initDB().
 *
 * This intentionally performs ONLY a lightweight connectivity test.
 *
 * DO NOT add:
 *
 * CREATE TABLE
 * ALTER TABLE
 * DROP TABLE
 * CREATE INDEX
 * DELETE
 * seed data
 * call cleanup
 * migrations
 *
 * here.
 */
export async function initDB(): Promise<void> {
  await getPool().query("SELECT 1");
}

/**
 * Execute a normal PostgreSQL query.
 *
 * IMPORTANT:
 *
 * - Does NOT run migrations.
 * - Does NOT call initDB().
 * - Does NOT blindly retry failed operations.
 *
 * Automatic retries are intentionally avoided here because this
 * function may execute INSERT / UPDATE / DELETE queries.
 *
 * Retrying a write automatically could duplicate an operation.
 */
export async function query(
  text: string,
  params?: any[]
): Promise<BelConnectQueryResult> {
  const result = await getPool().query(
    text,
    params
  );

  return {
    rows: result.rows as any[],
    rowCount: result.rowCount,
    command: result.command,
    fields: result.fields,
  };
}

/**
 * Obtain a dedicated PostgreSQL client.
 *
 * The caller MUST always release the client.
 *
 * Correct pattern:
 *
 * const client = await getClient();
 *
 * try {
 *   await client.query("BEGIN");
 *
 *   // database operations
 *
 *   await client.query("COMMIT");
 * } catch (error) {
 *   await client.query("ROLLBACK");
 *   throw error;
 * } finally {
 *   client.release();
 * }
 */
export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}