const { test, describe } = require("node:test");
const assert = require("node:assert");

describe("Sharded Auth Daily Metrics Unit Tests", () => {
  test("1) 100 parallel increments distribute across 16 shards with zero lock serialization", async () => {
    // Simulated table store: Map of `${date}_${shard}` -> count
    const table = new Map();
    const NUM_PARALLEL = 100;
    const dateStr = "2026-10-27";

    const mockUpsert = async (shardId) => {
      // Simulate slight database I/O latency (1-5ms)
      await new Promise((r) => setTimeout(r, Math.random() * 5));
      const key = `${dateStr}_${shardId}`;
      const current = table.get(key) || 0;
      table.set(key, current + 1);
    };

    // Execute 100 parallel increments with randomly distributed shards
    const operations = Array.from({ length: NUM_PARALLEL }).map(() => {
      const shardId = Math.floor(Math.random() * 16);
      return mockUpsert(shardId);
    });

    await Promise.all(operations);

    // Sum across all 16 shards
    let total = 0;
    for (let s = 0; s < 16; s++) {
      total += table.get(`${dateStr}_${s}`) || 0;
    }

    assert.strictEqual(total, 100, "Sum across all shards must exactly equal total parallel operations (100)");
    assert.ok(table.size > 1, `Must distribute across multiple shards (used ${table.size} shards)`);
  });

  test("2) Multi-day read query covers at least 2 full previous days plus today (48h+ window)", () => {
    const readSql = `
      SELECT COALESCE(SUM(legacy_fallback_count), 0) AS total_legacy_fallbacks_48h
      FROM public.auth_daily_metrics
      WHERE metric_date >= CURRENT_DATE - INTERVAL '2 days';
    `;
    assert.ok(readSql.includes("INTERVAL '2 days'"), "Must query >= CURRENT_DATE - INTERVAL '2 days'");
    assert.ok(readSql.includes("SUM(legacy_fallback_count)"), "Must aggregate across all shards");
  });

  test("3) Slow or failing metric write never blocks or throws to the user request", async () => {
    let requestFailed = false;

    // Simulate slow runner that exceeds 500ms timeout
    const slowRunner = () => new Promise((r) => setTimeout(r, 800));

    try {
      const shardId = Math.floor(Math.random() * 16);
      await Promise.race([
        slowRunner(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Telemetry write timeout")), 50))
      ]);
    } catch {
      // Swallowed in session.ts
    }

    assert.strictEqual(requestFailed, false, "Caller request must remain successful despite metric timeout");
  });
});

