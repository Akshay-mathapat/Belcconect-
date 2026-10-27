const { Pool } = require("../frontend/node_modules/pg");
const crypto = require("crypto");

const testUrl = process.env.TEST_DATABASE_URL || "postgresql://postgres:testpass@localhost:5433/belconnect_test";

const pool = new Pool({
  connectionString: testUrl,
  ssl: false
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("================================================================================");
    console.log(" SEEDING TEST DATABASE FOR EXPLAIN (ANALYZE, BUFFERS)");
    console.log(" Target: 10,000 Customers & 50,000 Sessions");
    console.log("================================================================================");

    // 1. Seed 10,000 Customers in batches of 1,000
    console.log("[1/3] Seeding 10,000 customers...");
    const customerIds = [];
    const BATCH_SIZE = 1000;
    const TOTAL_CUSTOMERS = 10000;

    for (let b = 0; b < TOTAL_CUSTOMERS / BATCH_SIZE; b++) {
      const values = [];
      const params = [];
      let paramIdx = 1;

      for (let i = 0; i < BATCH_SIZE; i++) {
        const id = `cust_bench_${b * BATCH_SIZE + i}`;
        customerIds.push(id);
        const email = `bench_user_${b * BATCH_SIZE + i}@example.com`;
        const name = `Benchmark User ${b * BATCH_SIZE + i}`;
        values.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, 'active', NOW())`);
        params.push(id, email, name);
        paramIdx += 3;
      }

      await client.query(
        `INSERT INTO public.customers (id, email, name, account_status, created_at)
         VALUES ${values.join(", ")}
         ON CONFLICT (id) DO NOTHING`,
        params
      );
    }
    console.log("  -> 10,000 customers seeded successfully.");

    // 2. Seed 50,000 Sessions in batches of 1,000
    console.log("[2/3] Seeding 50,000 sessions...");
    const sampleTokenHashes = [];
    const TOTAL_SESSIONS = 50000;

    for (let b = 0; b < TOTAL_SESSIONS / BATCH_SIZE; b++) {
      const values = [];
      const params = [];
      let paramIdx = 1;

      for (let i = 0; i < BATCH_SIZE; i++) {
        const rawToken = crypto.randomBytes(32).toString("base64url");
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        if (sampleTokenHashes.length < 5) sampleTokenHashes.push(tokenHash);

        const userId = customerIds[Math.floor(Math.random() * customerIds.length)];
        const isRevoked = Math.random() < 0.15; // 15% revoked
        const isExpired = Math.random() < 0.20; // 20% expired

        const idleInterval = isExpired ? "INTERVAL '-1 day'" : "INTERVAL '30 days'";
        const absInterval = isExpired ? "INTERVAL '-1 day'" : "INTERVAL '90 days'";
        const revokedVal = isRevoked ? "NOW() - INTERVAL '10 days'" : "NULL";

        values.push(
          `($${paramIdx}, $${paramIdx + 1}, 'user', NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days', 
            NOW() + ${idleInterval}, NOW() + ${absInterval}, ${revokedVal}, 'web', $${paramIdx + 2})`
        );
        params.push(tokenHash, userId, `device_${i % 10}`);
        paramIdx += 3;
      }

      await client.query(
        `INSERT INTO public.sessions (
           token_hash, user_id, role, created_at, last_seen_at, 
           idle_expires_at, absolute_expires_at, revoked_at, client, device_id
         ) VALUES ${values.join(", ")}
         ON CONFLICT (token_hash) DO NOTHING`,
        params
      );
    }
    console.log("  -> 50,000 sessions seeded successfully.");

    // 3. Analyze tables for fresh optimizer statistics
    console.log("[3/3] Running ANALYZE on public.customers and public.sessions...");
    await client.query("ANALYZE public.customers;");
    await client.query("ANALYZE public.sessions;");
    await client.query("ANALYZE public.auth_daily_metrics;");
    console.log("  -> Statistics updated.\n");

    const sampleHash = sampleTokenHashes[0];
    const sampleUserId = customerIds[42];

    console.log("================================================================================");
    console.log(" 1. EXPLAIN (ANALYZE, BUFFERS): validateSession by token_hash");
    console.log("================================================================================");
    const plan1 = await client.query(
      `EXPLAIN (ANALYZE, BUFFERS)
       SELECT 
         s.id,
         s.token_hash,
         s.user_id,
         s.role,
         s.created_at,
         s.last_seen_at,
         s.idle_expires_at,
         s.absolute_expires_at,
         s.revoked_at,
         s.client,
         s.device_id,
         (CURRENT_TIMESTAMP >= s.idle_expires_at OR CURRENT_TIMESTAMP >= s.absolute_expires_at) AS is_expired,
         (s.revoked_at IS NOT NULL) AS is_revoked,
         (CURRENT_TIMESTAMP - s.last_seen_at >= INTERVAL '60 seconds') AS needs_touch,
         COALESCE(c.email, sp.email, jp.email, a.email) AS email,
         COALESCE(c.name, sp.name, jp.name, a.email, 'Admin') AS name,
         CASE 
           WHEN s.role = 'user' THEN c.account_status
           WHEN s.role = 'provider' THEN sp.account_status
           WHEN s.role = 'job_provider' THEN jp.account_status
           WHEN s.role = 'admin' THEN 'active'
           ELSE NULL
         END AS account_status,
         CASE
           WHEN s.role = 'user' AND c.id IS NOT NULL THEN TRUE
           WHEN s.role = 'provider' AND sp.id IS NOT NULL THEN TRUE
           WHEN s.role = 'job_provider' AND jp.id IS NOT NULL THEN TRUE
           WHEN s.role = 'admin' AND a.id IS NOT NULL THEN TRUE
           ELSE FALSE
         END AS user_exists
       FROM public.sessions s
       LEFT JOIN public.customers c ON s.role = 'user' AND c.id = s.user_id
       LEFT JOIN public.service_providers sp ON s.role = 'provider' AND sp.id = s.user_id
       LEFT JOIN public.job_providers jp ON s.role = 'job_provider' AND jp.id = s.user_id
       LEFT JOIN public.admins a ON s.role = 'admin' AND a.id = s.user_id
       WHERE s.token_hash = $1`,
      [sampleHash]
    );
    console.log(plan1.rows.map(r => r["QUERY PLAN"]).join("\n"));

    console.log("\n================================================================================");
    console.log(" 2. EXPLAIN (ANALYZE, BUFFERS): revoke-all by user_id");
    console.log("================================================================================");
    const plan2 = await client.query(
      `EXPLAIN (ANALYZE, BUFFERS)
       UPDATE public.sessions 
       SET revoked_at = CURRENT_TIMESTAMP 
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [sampleUserId]
    );
    console.log(plan2.rows.map(r => r["QUERY PLAN"]).join("\n"));

    console.log("\n================================================================================");
    console.log(" 3. EXPLAIN (ANALYZE, BUFFERS): legacy account check");
    console.log("================================================================================");
    const plan3 = await client.query(
      `EXPLAIN (ANALYZE, BUFFERS)
       SELECT account_status FROM public.customers WHERE id = $1`,
      [sampleUserId]
    );
    console.log(plan3.rows.map(r => r["QUERY PLAN"]).join("\n"));

    console.log("\n================================================================================");
    console.log(" 4. EXPLAIN (ANALYZE, BUFFERS): cleanup DELETE");
    console.log("================================================================================");
    const plan4 = await client.query(
      `EXPLAIN (ANALYZE, BUFFERS)
       DELETE FROM public.sessions 
       WHERE id IN (
         SELECT id FROM public.sessions
         WHERE (revoked_at IS NOT NULL AND revoked_at < CURRENT_TIMESTAMP - INTERVAL '7 days')
            OR (idle_expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days')
            OR (absolute_expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days')
         LIMIT 1000
       )`
    );
    console.log(plan4.rows.map(r => r["QUERY PLAN"]).join("\n"));

    console.log("\n================================================================================");
    console.log(" 5. EXPLAIN (ANALYZE, BUFFERS): auth_daily_metrics sharded UPSERT");
    console.log("================================================================================");
    const plan5 = await client.query(
      `EXPLAIN (ANALYZE, BUFFERS)
       INSERT INTO public.auth_daily_metrics (metric_date, shard_id, legacy_fallback_count, updated_at)
       VALUES (CURRENT_DATE, 7, 1, CURRENT_TIMESTAMP)
       ON CONFLICT (metric_date, shard_id)
       DO UPDATE SET 
         legacy_fallback_count = public.auth_daily_metrics.legacy_fallback_count + 1,
         updated_at = CURRENT_TIMESTAMP`
    );
    console.log(plan5.rows.map(r => r["QUERY PLAN"]).join("\n"));

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

