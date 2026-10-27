/**
 * BelConnect - Database Migration Runner
 * Single source of truth: database/migrations/
 *
 * Capabilities:
 * - Sorts and executes migrations sequentially (001 -> 035)
 * - Tracks applied migrations in the `schema_migrations` table
 * - Guards against running migration 031 (Task 8 compliance: draft only)
 * - Automatically keeps /migrations synchronized with database/migrations
 * - Supports CLI flags: --status, --dry-run, --sync, --target test
 * - Strict production guard: Refuses execution on production render.com host
 */

const fs = require("fs");
const path = require("path");

// Load .env if present (supports TEST_DATABASE_URL, DATABASE_URL)
const rootEnvPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(rootEnvPath) && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(rootEnvPath);
  } catch (_) {}
}

const PRIMARY_MIGRATIONS_DIR = path.resolve(__dirname, "../database/migrations");
const SECONDARY_MIGRATIONS_DIR = path.resolve(__dirname, "../migrations");

// Migrations explicitly excluded from automatic execution
const EXCLUDED_FROM_AUTO_RUN = new Set(["031_drop_legacy_kyc_columns.sql"]);

function resolvePg() {
  try {
    return require("pg");
  } catch (_) {
    try {
      return require(path.resolve(__dirname, "../frontend/node_modules/pg"));
    } catch (_) {
      try {
        return require(path.resolve(__dirname, "../backend/node_modules/pg"));
      } catch (err) {
        return null;
      }
    }
  }
}

/**
 * Returns all migration filenames sorted in ascending numerical order.
 */
function getMigrationFiles(migrationsDir = PRIMARY_MIGRATIONS_DIR) {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((f) => /^\d{3}_.*\.sql$/.test(f))
    .sort((a, b) => {
      const numA = parseInt(a.slice(0, 3), 10);
      const numB = parseInt(b.slice(0, 3), 10);
      return numA - numB;
    });
}

/**
 * Synchronizes secondary /migrations directory with canonical database/migrations.
 */
function syncMigrationsDirectories() {
  if (!fs.existsSync(PRIMARY_MIGRATIONS_DIR)) return { synced: 0, total: 0 };
  if (!fs.existsSync(SECONDARY_MIGRATIONS_DIR)) {
    fs.mkdirSync(SECONDARY_MIGRATIONS_DIR, { recursive: true });
  }

  const primaryFiles = fs.readdirSync(PRIMARY_MIGRATIONS_DIR);
  let synced = 0;

  for (const file of primaryFiles) {
    const src = path.join(PRIMARY_MIGRATIONS_DIR, file);
    const dest = path.join(SECONDARY_MIGRATIONS_DIR, file);
    const srcContent = fs.readFileSync(src, "utf-8");

    if (!fs.existsSync(dest) || fs.readFileSync(dest, "utf-8") !== srcContent) {
      fs.writeFileSync(dest, srcContent, "utf-8");
      synced++;
    }
  }

  return { synced, total: primaryFiles.length };
}

/**
 * Main migration execution logic
 */
async function run() {
  const args = process.argv.slice(2);
  const isStatus = args.includes("--status");
  const isDryRun = args.includes("--dry-run");
  const isSyncOnly = args.includes("--sync");
  const isTargetTest =
    (args.includes("--target") && args[args.indexOf("--target") + 1] === "test") ||
    args.includes("--target=test") ||
    args.includes("--test");

  // Step 1: Ensure directory synchronization
  const syncResult = syncMigrationsDirectories();
  if (isSyncOnly) {
    console.log(`[MIGRATIONS] Synced ${syncResult.synced} files. Total active migrations: ${syncResult.total}`);
    return;
  }

  const migrationFiles = getMigrationFiles();
  console.log(`[MIGRATIONS] Canonical directory: ${PRIMARY_MIGRATIONS_DIR}`);
  console.log(`[MIGRATIONS] Secondary directory synced: ${SECONDARY_MIGRATIONS_DIR}`);
  console.log(`[MIGRATIONS] Discovered ${migrationFiles.length} migration files in numerical order:\n`);

  let dbUrl = "";

  if (isTargetTest) {
    const testUrl = process.env.TEST_DATABASE_URL;
    if (!testUrl || !testUrl.trim()) {
      console.error("[FATAL SAFETY CHECK] --target test requires TEST_DATABASE_URL environment variable.");
      process.exit(1);
    }

    try {
      const { validateTestDatabaseUrl } = require(path.resolve(__dirname, "../tests/integration/db-guard.js"));
      const guardResult = validateTestDatabaseUrl();
      if (!guardResult.shouldRun) {
        console.error(`[FATAL SAFETY CHECK] ${guardResult.reason}`);
        process.exit(1);
      }
    } catch (guardErr) {
      console.error(guardErr.message);
      process.exit(1);
    }

    dbUrl = testUrl.trim();
    console.log(`[MIGRATIONS] Target mode: TEST_DATABASE_URL (${new URL(dbUrl).hostname}/${new URL(dbUrl).pathname})`);
  } else {
    // Migration runner prefers DATABASE_DIRECT_URL (direct port 5432) over DATABASE_URL (which may point to PgBouncer port 6432)
    dbUrl = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!dbUrl) {
      console.log("[MIGRATIONS] No DATABASE_DIRECT_URL or DATABASE_URL provided. Migration order inspection:\n");
      migrationFiles.forEach((file, idx) => {
        const isExcluded = EXCLUDED_FROM_AUTO_RUN.has(file);
        console.log(`  ${String(idx + 1).padStart(2, " ")}. ${file} ${isExcluded ? "(HOLD - Task 8 compliance)" : ""}`);
      });
      return;
    }

    // Safety check: PgBouncer transaction mode port (6432) breaks DDL and advisory locks
    try {
      const parsedUrl = new URL(dbUrl);
      if (parsedUrl.port === "6432") {
        console.error("\n[FATAL ERROR] Migrations cannot be executed through PgBouncer port 6432 (transaction pooling mode).");
        console.error("DDL statements and table locks require a direct connection.");
        console.error("Please configure DATABASE_DIRECT_URL pointing to PostgreSQL port 5432.\n");
        process.exit(1);
      }
    } catch (_) {}

    // Strict production guard: Refuses execution on production render.com host
    if (dbUrl.includes("render.com") && !args.includes("--allow-production")) {
      console.error("FATAL SAFETY CHECK: DATABASE_URL points to a production host (render.com).");
      console.error("Running migration scripts against production database is strictly prohibited.");
      process.exit(1);
    }
  }

  const pg = resolvePg();
  if (!pg) {
    console.error("ERROR: Could not resolve 'pg' package from frontend or backend node_modules.");
    process.exit(1);
  }

  const { Pool } = pg;
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes("render.com") ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();
  try {
    // Ensure tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const { rows: appliedRows } = await client.query("SELECT name FROM public.schema_migrations");
    const appliedSet = new Set(appliedRows.map((r) => r.name));

    console.log("================================================================================");
    console.log(" MIGRATION STATUS & EXECUTION PLAN");
    console.log("================================================================================");

    for (const file of migrationFiles) {
      const isApplied = appliedSet.has(file);
      const isExcluded = EXCLUDED_FROM_AUTO_RUN.has(file);

      let statusLabel = "[APPLIED] ";
      if (!isApplied) {
        statusLabel = isExcluded ? "[HOLD]    " : "[PENDING] ";
      }

      console.log(`${statusLabel} ${file}`);

      if (!isApplied && !isStatus && !isExcluded) {
        const filePath = path.join(PRIMARY_MIGRATIONS_DIR, file);
        const sql = fs.readFileSync(filePath, "utf-8");

        if (isDryRun) {
          console.log(`   --> [DRY RUN] Would execute ${sql.length} bytes of SQL`);
        } else {
          console.log(`   --> Executing ${file}...`);
          await client.query("BEGIN");
          try {
            await client.query(sql);
            await client.query("INSERT INTO public.schema_migrations (name) VALUES ($1)", [file]);
            await client.query("COMMIT");
            console.log(`   --> [DONE] ${file}`);
          } catch (err) {
            await client.query("ROLLBACK");
            console.error(`   --> [FAILED] ${file}:`, err.message);
            throw err;
          }
        }
      }
    }
    console.log("================================================================================");
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  run().catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
  });
}

module.exports = {
  PRIMARY_MIGRATIONS_DIR,
  SECONDARY_MIGRATIONS_DIR,
  EXCLUDED_FROM_AUTO_RUN,
  getMigrationFiles,
  syncMigrationsDirectories
};
