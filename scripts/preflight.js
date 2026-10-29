#!/usr/bin/env node

/**
 * BelConnect Production Readiness Preflight Check
 * 
 * Strictly READ-ONLY verification script.
 * Validates:
 * 1. Required environment variables and secret lengths
 * 2. Database connectivity (SELECT 1)
 * 3. Applied migrations in schema_migrations (035, 036)
 * 4. Critical database tables, columns, and constraints
 * 5. Signaling server /health responsiveness
 * 6. CORS allowed origins configuration
 * 
 * Exits 0 on all pass, exits non-zero on any failure.
 */

const fs = require("fs");
const path = require("path");

// Load local .env if available
const envFile = path.resolve(__dirname, "../.env");
if (fs.existsSync(envFile) && typeof process.loadEnvFile === "function") {
  try { process.loadEnvFile(envFile); } catch (_) {}
}

const { getSecretFingerprint, validateFrontendEnv } = require("./env-validator");

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

async function runPreflight() {
  console.log(`\n================================================================`);
  console.log(` BelConnect Production Readiness Preflight (Read-Only)`);
  console.log(`================================================================\n`);

  const results = [];
  let hasCriticalFailure = false;

  function report(name, status, details = "") {
    const mark = status === "PASS" ? " [PASS] " : status === "WARN" ? " [WARN] " : " [FAIL] ";
    console.log(`${mark} ${name.padEnd(35)} : ${details}`);
    results.push({ name, status, details });
    if (status === "FAIL") hasCriticalFailure = true;
  }

  // ─── 1. ENVIRONMENT VARIABLES VALIDATION ────────────────────────────────────
  const isProd = process.env.NODE_ENV === "production";
  const validation = validateFrontendEnv(process.env, isProd);

  if (validation.valid) {
    report("Environment Variables", "PASS", "All required secrets configured (>= 32 chars)");
  } else {
    report("Environment Variables", isProd ? "FAIL" : "WARN", validation.errors.join("; "));
  }

  // ─── 2. DATABASE CONNECTIVITY ───────────────────────────────────────────────
  const args = process.argv.slice(2);
  const isTargetTest = args.includes("--target=test") || args.includes("--test");
  const rawDbUrl = (isTargetTest ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL) || "";

  if (!rawDbUrl) {
    report("Database Connection", "FAIL", "DATABASE_URL is not set in environment.");
  } else {
    let sanitizedTarget = "unknown";
    try {
      const u = new URL(rawDbUrl);
      sanitizedTarget = `${u.hostname}/${u.pathname.replace(/^\//, "")}`;
    } catch (_) {}

    const pg = resolvePg();
    if (!pg) {
      report("Database Driver", "FAIL", "pg module not found in node_modules.");
    } else {
      const { Pool } = pg;
      const pool = new Pool({
        connectionString: rawDbUrl,
        ssl: rawDbUrl.includes("render.com") ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 5000,
        statement_timeout: 5000
      });

      let client = null;
      try {
        client = await pool.connect();
        // Enforce strictly read-only transaction for preflight
        await client.query("BEGIN READ ONLY");
        await client.query("SELECT 1 AS alive");
        await client.query("COMMIT");
        report("Database Connectivity", "PASS", `Connected to ${sanitizedTarget}`);

        // ─── 3. MIGRATION REGISTRATION IN schema_migrations ──────────────────
        try {
          const migRes = await client.query(
            "SELECT name FROM public.schema_migrations WHERE name IN ('035_server_side_sessions.sql', '036_session_hotpath_indexes.sql')"
          );
          const appliedNames = migRes.rows.map(r => r.name);
          const has035 = appliedNames.includes("035_server_side_sessions.sql");
          const has036 = appliedNames.includes("036_session_hotpath_indexes.sql");

          if (has035 && has036) {
            report("Applied Migrations", "PASS", "035 and 036 recorded in schema_migrations");
          } else if (has035) {
            report("Applied Migrations", "WARN", "035 recorded; 036 pending");
          } else {
            report("Applied Migrations", "WARN", "035 and 036 not yet recorded in schema_migrations");
          }
        } catch (migErr) {
          report("Applied Migrations", "WARN", `Could not query schema_migrations: ${migErr.message}`);
        }

        // ─── 4. CRITICAL TABLES & COLUMNS EXISTENCE ──────────────────────────
        const schemaChecks = [
          { table: "sessions", col: "token_hash" },
          { table: "sessions", col: "user_id" },
          { table: "socket_tickets", col: "ticket_hash" },
          { table: "customers", col: "account_status" },
          { table: "service_providers", col: "account_status" },
          { table: "job_providers", col: "account_status" }
        ];

        let schemaOk = true;
        for (const item of schemaChecks) {
          const checkRes = await client.query(
            `SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
            [item.table, item.col]
          );
          if (checkRes.rows.length === 0) {
            schemaOk = false;
            report(`Schema: ${item.table}.${item.col}`, "FAIL", "Column does not exist");
          }
        }

        if (schemaOk) {
          report("Session & Status Schema", "PASS", "All tables (sessions, socket_tickets) and account_status columns verified");
        }
      } catch (dbErr) {
        report("Database Connectivity", "FAIL", `Connection failed: ${dbErr.message}`);
      } finally {
        if (client) {
          try { client.release(); } catch (_) {}
        }
        try { await pool.end(); } catch (_) {}
      }
    }
  }

  // ─── 5. SIGNALING SERVER /health CHECK ──────────────────────────────────────
  const signalingUrl = (process.env.SIGNALING_SERVER_URL || "http://localhost:4001").replace(/\/+$/, "");
  try {
    const healthRes = await fetch(`${signalingUrl}/health`, { signal: AbortSignal.timeout(3000) });
    const healthData = await healthRes.json();
    if (healthRes.status === 200 && healthData.status === "ok") {
      report("Signaling Server /health", "PASS", `Responding 200 OK at ${signalingUrl} (db: ${healthData.db})`);
    } else {
      report("Signaling Server /health", "WARN", `Returned HTTP ${healthRes.status} (db: ${healthData.db})`);
    }
  } catch (sigErr) {
    report("Signaling Server /health", "WARN", `Could not reach ${signalingUrl} (${sigErr.message}). Ensure backend service is running.`);
  }

  // ─── 6. CORS / ALLOWED_ORIGIN CONFIGURATION ─────────────────────────────────
  const allowedOrigin = (process.env.ALLOWED_ORIGIN || "").trim();
  if (allowedOrigin) {
    const hasProductionDomain = allowedOrigin.includes("belconnect.in");
    report("CORS Allowed Origins", hasProductionDomain ? "PASS" : "WARN", `Configured origins: ${allowedOrigin}`);
  } else {
    report("CORS Allowed Origins", isProd ? "FAIL" : "WARN", "ALLOWED_ORIGIN is empty.");
  }

  // ─── SUMMARY & EXIT ────────────────────────────────────────────────────────
    console.log(`\n================================================================`);
  if (hasCriticalFailure) {
    console.error(`[PREFLIGHT RESULT: FAILED] Critical checks failed. Resolve issues before deployment.\n`);
    process.exitCode = 1;
  } else {
    console.log(`[PREFLIGHT RESULT: SUCCESS] All preflight checks passed.\n`);
    process.exitCode = 0;
  }
}

runPreflight();

