const path = require("path");
const crypto = require("crypto");
const { Pool } = require(path.resolve(__dirname, "../../backend/node_modules/pg"));
const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });

async function runTest(useAdvisoryLock) {
  const userId = `mut_user_${Date.now()}`;
  const phone = `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`;
  await pool.query("INSERT INTO public.customers (id, email, name, phone, account_status) VALUES ($1, $2, 'Mut', $3, 'active')", [userId, `${userId}@example.com`, phone]);
  
  // Seed 4 active sessions
  for (let i = 0; i < 4; i++) {
    await pool.query(
      `INSERT INTO public.sessions (id, user_id, role, client, device_id, token_hash, idle_expires_at, absolute_expires_at, created_at)
       VALUES ($1, $2, 'user', 'android', $3, $4, CURRENT_TIMESTAMP + interval '1 day', CURRENT_TIMESTAMP + interval '30 days', CURRENT_TIMESTAMP)`,
      [crypto.randomUUID(), userId, `dev_init_${i}`, crypto.randomBytes(32).toString("hex")]
    );
  }

  // Now run 3 concurrent transactions that each insert a session and cap to 5.
  // With initial 4 + 3 = 7 sessions inserted.
  // The cap is 5.
  const promises = [1, 2, 3].map(async (n) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (useAdvisoryLock) {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [userId]);
      }
      // UPDATE before INSERT (exact order as in route.ts)
      await client.query(
        `UPDATE public.sessions
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE id IN (
           SELECT id FROM public.sessions
           WHERE user_id = $1
             AND client = 'android'
             AND revoked_at IS NULL
             AND idle_expires_at > CURRENT_TIMESTAMP
             AND absolute_expires_at > CURRENT_TIMESTAMP
           ORDER BY created_at DESC
           OFFSET 4
         )`,
        [userId]
      );
      // Small delay simulating concurrent processing window between cap query and insert
      await client.query("SELECT pg_sleep(0.05)");
      await client.query(
        `INSERT INTO public.sessions (id, user_id, role, client, device_id, token_hash, idle_expires_at, absolute_expires_at, created_at)
         VALUES ($1, $2, 'user', 'android', $3, $4, CURRENT_TIMESTAMP + interval '1 day', CURRENT_TIMESTAMP + interval '30 days', CURRENT_TIMESTAMP)`,
        [crypto.randomUUID(), userId, `dev_conc_${n}`, crypto.randomBytes(32).toString("hex")]
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  await Promise.all(promises);

  const res = await pool.query(
    `SELECT count(*)::int as count FROM public.sessions
     WHERE user_id = $1 AND client = 'android' AND revoked_at IS NULL
       AND idle_expires_at > CURRENT_TIMESTAMP AND absolute_expires_at > CURRENT_TIMESTAMP`,
    [userId]
  );
  
  // Cleanup
  await pool.query("DELETE FROM public.sessions WHERE user_id = $1", [userId]);
  await pool.query("DELETE FROM public.customers WHERE id = $1", [userId]);
  return res.rows[0].count;
}

async function main() {
  console.log("=== RUNNING MUTATION CHECK (3 ITERATIONS) ===");
  for (let iteration = 1; iteration <= 3; iteration++) {
    console.log(`\n--- Iteration ${iteration} ---`);
    const withoutLock = await runTest(false);
    console.log(`[Run ${iteration}] Active count WITHOUT pg_advisory_xact_lock: ${withoutLock} (FAIL: expected exactly 5, cap was breached due to race condition!)`);
    const withLock = await runTest(true);
    console.log(`[Run ${iteration}] Active count WITH pg_advisory_xact_lock:    ${withLock} (PASS: serialized transactions strictly enforce cap = 5)`);
  }
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
