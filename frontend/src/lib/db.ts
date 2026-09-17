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
    // Never print DATABASE_URL because it may contain DB credentials.
    throw new Error(
      "FATAL: DATABASE_URL is not a valid PostgreSQL connection URL."
    );
  }

  const normalizedHost = hostInfo.toLowerCase();

  /**
   * Prevent Vercel/production from accidentally trying to use
   * the developer machine's PostgreSQL database.
   */
  if (
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

  /**
   * Render/Neon/Supabase and production PostgreSQL connections
   * normally require SSL.
   */
  const useSsl =
    process.env.NODE_ENV === "production" ||
    normalizedHost.includes("render.com") ||
    normalizedHost.includes("neon.tech") ||
    normalizedHost.includes("supabase");

  console.log(
    `[Database] Creating PostgreSQL pool for host: ${hostInfo}`
  );

  globalThis.postgresPool = new Pool({
    connectionString,

    ssl: useSsl
      ? {
          rejectUnauthorized: false,
        }
      : false,

    /**
     * Keep this small for Vercel/serverless.
     *
     * Multiple Vercel instances can exist simultaneously and each
     * instance can create its own PostgreSQL pool.
     */
    max: Number(process.env.DB_POOL_MAX || 5),

    idleTimeoutMillis: Number(
      process.env.DB_IDLE_TIMEOUT_MS || 10_000
    ),

    connectionTimeoutMillis: Number(
      process.env.DB_CONNECTION_TIMEOUT_MS || 10_000
    ),

    allowExitOnIdle: true,
  });

  /**
   * Prevent unexpected idle-client errors from becoming
   * unhandled process errors.
   */
  globalThis.postgresPool.on("error", (error) => {
    console.error(
      "[Database] Unexpected idle PostgreSQL client error:",
      error instanceof Error ? error.message : error
    );
  });

  return globalThis.postgresPool;
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
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /**
   * Legacy SHA-256 compatibility.
   *
   * Do not use this method when creating new passwords.
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
 * This function intentionally performs ONLY a lightweight
 * connectivity test.
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
 * to this function.
 */
export async function initDB(): Promise<void> {
  await getPool().query("SELECT 1");
}

/**
 * Execute a normal PostgreSQL query.
 *
 * CRITICAL:
 *
 * query() DOES NOT call initDB().
 *
 * Previously query() could trigger the full database initializer.
 * On Vercel, several serverless functions can start concurrently.
 * Running DDL/migrations from those functions can produce PostgreSQL
 * lock contention and deadlocks.
 *
 * rows is explicitly any[] for compatibility with the current
 * BelConnect API code.
 */
export async function query(
  text: string,
  params?: any[]
): Promise<BelConnectQueryResult> {
  const result = await getPool().query(text, params);

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
 * This also DOES NOT call initDB().
 *
 * The caller MUST release the client after use.
 *
 * Example:
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