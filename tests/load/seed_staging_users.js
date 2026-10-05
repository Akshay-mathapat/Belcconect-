/**
 * Seed ~300 users into STAGING or local database with strict production guard.
 *
 * Usage:
 *   node tests/load/seed_staging_users.js [--allow-staging-seed]
 */

const { Pool } = require("pg");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Load .env
const envPath = path.join(__dirname, "..", "..", ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:Akshay_a015@127.0.0.1:5432/cityconnect";

// Strict Production Guard
const isProduction =
  process.env.NODE_ENV === "production" ||
  dbUrl.includes("singapore-postgres.render.com") ||
  dbUrl.includes("dpg-") ||
  dbUrl.includes("render.com");

const allowStagingSeed = process.argv.includes("--allow-staging-seed");

if (isProduction && !allowStagingSeed) {
  console.error("FATAL: Refusing to seed database because it appears to be PRODUCTION.");
  console.error("Target URL matches production pattern and --allow-staging-seed flag was not supplied.");
  process.exit(1);
}

console.log(`[SEED] Connecting to database: ${dbUrl.replace(/:[^:@]+@/, ":***@")}`);

const pool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl.includes("render.com") ? { rejectUnauthorized: false } : false,
});

async function runSeed() {
  const client = await pool.connect();
  try {
    console.log("[SEED] Connected. Creating migration table check if needed...");
    
    // Ensure customers table exists
    const tableCheck = await client.query(
      "SELECT 1 FROM information_schema.tables WHERE table_name = 'customers'"
    );
    if (tableCheck.rows.length === 0) {
      throw new Error("Table 'customers' does not exist in target database.");
    }

    const testPassword = "Password123!";
    // Using SHA-256 for test accounts (supported natively by verifyPassword without CPU exhaustion during bulk seeding)
    const testHash = crypto.createHash("sha256").update(testPassword).digest("hex");

    console.log("[SEED] Generating 300 staging customer accounts...");
    const users = [];

    for (let i = 1; i <= 300; i++) {
      const pad = String(i).padStart(3, "0");
      const id = `staging-user-${pad}`;
      const email = `staging_user_${pad}@belconnect.test`;
      const name = `Staging User ${pad}`;
      const phone = `+919900000${pad}`;
      users.push({ id, email, name, phone, password: testPassword, passwordHash: testHash });
    }

    console.log("[SEED] Inserting 300 users in batch...");
    await client.query("BEGIN");

    for (const u of users) {
      await client.query(
        `INSERT INTO customers (id, email, name, phone, password_hash, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (id) DO UPDATE
         SET email = EXCLUDED.email,
             name = EXCLUDED.name,
             phone = EXCLUDED.phone,
             password_hash = EXCLUDED.password_hash`,
        [u.id, u.email, u.name, u.phone, u.passwordHash]
      );
    }

    await client.query("COMMIT");
    console.log(`[SEED] Successfully seeded ${users.length} staging users into 'customers' table.`);

    // Write user credentials to JSON file for concurrency load test
    const outPath = path.join(__dirname, "staging_users.json");
    fs.writeFileSync(
      outPath,
      JSON.stringify(
        {
          total: users.length,
          password: testPassword,
          users: users.map((u) => ({ id: u.id, email: u.email })),
        },
        null,
        2
      ),
      "utf8"
    );
    console.log(`[SEED] Written staging user list to: ${outPath}`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[SEED] Error during seeding:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed();

