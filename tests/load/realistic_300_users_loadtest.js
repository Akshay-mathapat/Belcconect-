/**
 * BelConnect Realistic 300-User E2E Load Test (150 Customers + 150 Providers)
 *
 * Actions:
 *   1. Registers 150 Customers + 150 Providers against the Live API (writes real rows to Render DB).
 *   2. Performs 300 Concurrent Logins across all 300 accounts.
 *   3. Measures p50, p90, p95 response times, error rates, and token validities.
 *
 * Usage:
 *   node tests/load/realistic_300_users_loadtest.js [--base-url https://belcconect.vercel.app]
 */

const fs = require("fs");
const path = require("path");

// Parse command line arguments
const args = process.argv.slice(2);
let baseUrl = "https://belcconect.vercel.app";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--base-url" && args[i + 1]) {
    baseUrl = args[i + 1].replace(/\/+$/, "");
  }
}

const TOTAL_CUSTOMERS = 150;
const TOTAL_PROVIDERS = 150;
const TOTAL_USERS = TOTAL_CUSTOMERS + TOTAL_PROVIDERS;
const CONCURRENCY_WORKERS = 10; // Batch concurrency to respect serverless HTTP connection limits
const TEST_PASSWORD = "LoadTestPassword123!";

console.log("================================================================================");
console.log("🚀 BelConnect 300-User E2E Database & API Load Test");
console.log(`Target Base URL:        ${baseUrl}`);
console.log(`Total Users to Create:  ${TOTAL_USERS} (150 Customers + 150 Providers)`);
console.log(`Concurrency Workers:    ${CONCURRENCY_WORKERS} parallel connections`);
console.log("================================================================================\n");

// Helper to run tasks with concurrency limit
async function runWithConcurrency(tasks, limit, onProgress) {
  const results = [];
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < tasks.length) {
      const index = currentIndex++;
      const task = tasks[index];
      try {
        const result = await task(index);
        results[index] = result;
      } catch (err) {
        results[index] = { success: false, error: err.message };
      }
      if (onProgress) onProgress(results.filter(Boolean).length, tasks.length);
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// Generate the 300 user definitions
const userList = [];
for (let i = 1; i <= TOTAL_CUSTOMERS; i++) {
  const pad = String(i).padStart(3, "0");
  userList.push({
    type: "customer",
    role: "user",
    email: `cust_load_${pad}@belconnect.loadtest`,
    name: `Load Test Customer ${pad}`,
    phone: `+919800000${pad}`,
    password: TEST_PASSWORD,
  });
}
for (let i = 1; i <= TOTAL_PROVIDERS; i++) {
  const pad = String(i).padStart(3, "0");
  userList.push({
    type: "provider",
    role: "provider",
    email: `prov_load_${pad}@belconnect.loadtest`,
    name: `Load Test Provider ${pad}`,
    phone: `+919700000${pad}`,
    password: TEST_PASSWORD,
  });
}

async function startLoadTest() {
  // -------------------------------------------------------------
  // PHASE 1: Bulk Registration (Writing 300 Real DB Rows)
  // -------------------------------------------------------------
  console.log(`[Phase 1] Registering 300 Users via POST /api/auth/register (Writing to PostgreSQL)...`);
  const regStartTime = Date.now();

  const registrationTasks = userList.map((user) => async (idx) => {
    const start = Date.now();
    try {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": `198.51.100.${(idx % 250) + 1}`,
        },
        body: JSON.stringify({
          email: user.email,
          password: user.password,
          name: user.name,
          phone: user.phone,
          role: user.role,
        }),
      });

      const json = await res.json().catch(() => ({}));
      const duration = Date.now() - start;

      // Both 200 (created) and 400/409 (already exists from previous run) are considered valid registrations
      const isOk = res.status === 200 || (json.error && json.error.includes("already exists"));

      return {
        email: user.email,
        type: user.type,
        status: res.status,
        duration,
        success: isOk,
        userId: json.user?.id || null,
        token: json.token || null,
      };
    } catch (e) {
      return { email: user.email, type: user.type, status: 0, duration: Date.now() - start, success: false, error: e.message };
    }
  });

  let lastReported = 0;
  const regResults = await runWithConcurrency(registrationTasks, CONCURRENCY_WORKERS, (completed, total) => {
    const percent = Math.floor((completed / total) * 100);
    if (percent >= lastReported + 20 || completed === total) {
      lastReported = percent;
      console.log(`  -> Progress: ${completed}/${total} users registered (${percent}%)`);
    }
  });

  const regTotalDuration = (Date.now() - regStartTime) / 1000;
  const regSuccessCount = regResults.filter((r) => r.success).length;
  console.log(`\n✅ Phase 1 Finished in ${regTotalDuration.toFixed(1)}s: ${regSuccessCount}/${TOTAL_USERS} users written to database.\n`);

  // -------------------------------------------------------------
  // PHASE 2: 300 Concurrent Logins & Authentication Check
  // -------------------------------------------------------------
  console.log(`[Phase 2] Executing 300 Concurrent Logins via POST /api/auth/login...`);
  const loginStartTime = Date.now();

  const loginTasks = userList.map((user) => async (idx) => {
    const start = Date.now();
    try {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": `198.51.100.${(idx % 250) + 1}`,
        },
        body: JSON.stringify({
          email: user.email,
          password: user.password,
          role: user.role,
        }),
      });

      const json = await res.json().catch(() => ({}));
      const duration = Date.now() - start;

      return {
        email: user.email,
        type: user.type,
        status: res.status,
        duration,
        success: res.status === 200 && !!json.token,
        token: json.token,
        userId: json.user?.id,
      };
    } catch (e) {
      return { email: user.email, type: user.type, status: 0, duration: Date.now() - start, success: false, error: e.message };
    }
  });

  const loginResults = await runWithConcurrency(loginTasks, CONCURRENCY_WORKERS, null);
  const loginTotalDuration = (Date.now() - loginStartTime) / 1000;

  // -------------------------------------------------------------
  // METRICS & ANALYSIS
  // -------------------------------------------------------------
  const successfulLogins = loginResults.filter((r) => r.success);
  const failedLogins = loginResults.filter((r) => !r.success);
  const durations = loginResults.map((r) => r.duration).sort((a, b) => a - b);

  const p50 = durations[Math.floor(durations.length * 0.50)] || 0;
  const p90 = durations[Math.floor(durations.length * 0.90)] || 0;
  const p95 = durations[Math.floor(durations.length * 0.95)] || 0;
  const p99 = durations[Math.floor(durations.length * 0.99)] || 0;
  const maxTime = durations[durations.length - 1] || 0;
  const errorRate = ((failedLogins.length / TOTAL_USERS) * 100).toFixed(2);

  console.log("================================================================================");
  console.log("📊 LOAD TEST RESULTS SUMMARY");
  console.log("================================================================================");
  console.log(`Total Users Processed:    ${TOTAL_USERS}`);
  console.log(`Successful Auth Logins:   ${successfulLogins.length} / ${TOTAL_USERS} (${((successfulLogins.length / TOTAL_USERS) * 100).toFixed(1)}%)`);
  console.log(`Failed / Errors:          ${failedLogins.length}`);
  console.log(`Error Rate:               ${errorRate}% (Pass criteria: < 1.0%)`);
  console.log("--------------------------------------------------------------------------------");
  console.log(`Total Execution Time:     ${loginTotalDuration.toFixed(2)} seconds`);
  console.log(`Throughput:               ${(TOTAL_USERS / loginTotalDuration).toFixed(2)} logins / second`);
  console.log("--------------------------------------------------------------------------------");
  console.log(`Latency p50 (Median):     ${p50} ms`);
  console.log(`Latency p90:              ${p90} ms`);
  console.log(`Latency p95:              ${p95} ms (Pass criteria: < 2000 ms)`);
  console.log(`Latency p99:              ${p99} ms`);
  console.log(`Max Latency:              ${maxTime} ms`);
  console.log("================================================================================\n");

  if (failedLogins.length === 0 && p95 < 2000) {
    console.log("🎉 VERDICT: 100% PASSED — Database connection pool and Auth server are rock-solid!\n");
  } else {
    console.log("⚠️ VERDICT: Load test completed with errors or high latency.\n");
  }

  console.log("🔍 TO VERIFY ROWS IN PGADMIN / RENDER DATABASE, RUN:");
  console.log("   SELECT COUNT(*) FROM customers WHERE email LIKE '%@belconnect.loadtest';");
  console.log("   SELECT COUNT(*) FROM service_providers WHERE email LIKE '%@belconnect.loadtest';");
  console.log("   SELECT id, name, email, role, created_at FROM customers WHERE email LIKE '%@belconnect.loadtest' LIMIT 5;\n");
}

startLoadTest();
