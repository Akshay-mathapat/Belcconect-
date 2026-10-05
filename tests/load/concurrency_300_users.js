/**
 * Concurrency Load Test: 300 Users Concurrent Login & Token Verification
 *
 * Measures:
 *   - Login p95 latency (< 2.0s pass criterion)
 *   - Error rate (< 1.0% pass criterion)
 *   - Invalid signature count (0 pass criterion)
 *   - "Too many clients" / DB exhaustion errors (0 pass criterion)
 *
 * Usage:
 *   node tests/load/concurrency_300_users.js [--base-url http://127.0.0.1:3000]
 */

const fs = require("fs");
const path = require("path");
const jwt = require("../../backend/node_modules/jsonwebtoken");
const { normalizeSecret } = require("../../backend/src/secretNormalizer");

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

const JWT_SECRET = normalizeSecret(process.env.JWT_SECRET || "cityconnect_jwt_secret_key_2026_belagavi_prod");

// Command-line args
const args = process.argv.slice(2);
let baseUrl = "http://127.0.0.1:3000";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--base-url" && args[i + 1]) {
    baseUrl = args[i + 1].replace(/\/+$/, "");
  }
}

const stagingUsersFile = path.join(__dirname, "staging_users.json");
if (!fs.existsSync(stagingUsersFile)) {
  console.error(`FATAL: Staging users file not found at ${stagingUsersFile}. Run seed_staging_users.js first.`);
  process.exit(1);
}

const stagingData = JSON.parse(fs.readFileSync(stagingUsersFile, "utf8"));
const users = stagingData.users || [];
const password = stagingData.password || "Password123!";

if (users.length === 0) {
  console.error("FATAL: No staging users found in staging_users.json.");
  process.exit(1);
}

console.log("================================================================================");
console.log(`[CONCURRENCY_TEST] BelConnect 300-User Concurrent Login Load Test`);
console.log(`Target Base URL:       ${baseUrl}`);
console.log(`Total Concurrent Users: ${users.length}`);
console.log(`Pass Criteria:         p95 < 2.0s | Error Rate < 1% | 0 Invalid Sig | 0 DB Exhaustion`);
console.log("================================================================================\n");

async function executeLogin(user, index) {
  const startTime = process.hrtime.bigint();
  const result = {
    index,
    email: user.email,
    statusCode: 0,
    durationMs: 0,
    success: false,
    tokenValid: false,
    invalidSignature: false,
    tooManyClients: false,
    errorMessage: null,
  };

  try {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Pass individual unique client IPs via x-forwarded-for so rate limiter tracks distinct clients
        "x-forwarded-for": `198.51.100.${(index % 250) + 1}`,
      },
      body: JSON.stringify({
        email: user.email,
        password: password,
      }),
    });

    const endTime = process.hrtime.bigint();
    result.durationMs = Number(endTime - startTime) / 1_000_000;
    result.statusCode = res.status;

    let body = {};
    try {
      body = await res.json();
    } catch {
      body = {};
    }

    if (res.ok && body.success && body.token) {
      result.success = true;
      // Cross-verify JWT with backend secret and jsonwebtoken
      try {
        const decoded = jwt.verify(body.token, JWT_SECRET, { algorithms: ["HS256"] });
        if (decoded && (decoded.userId || decoded.id)) {
          result.tokenValid = true;
        } else {
          result.invalidSignature = true;
          result.errorMessage = "Token missing userId";
        }
      } catch (jwtErr) {
        result.invalidSignature = true;
        result.errorMessage = `JWT verify failed: ${jwtErr.message}`;
      }
    } else {
      result.success = false;
      result.errorMessage = body.error || `HTTP ${res.status}`;
      if (
        res.status === 503 ||
        (body.error && (body.error.includes("too many clients") || body.error.includes("pool exhausted")))
      ) {
        result.tooManyClients = true;
      }
    }
  } catch (err) {
    const endTime = process.hrtime.bigint();
    result.durationMs = Number(endTime - startTime) / 1_000_000;
    result.statusCode = 0;
    result.errorMessage = err.message;
  }

  return result;
}

function calculatePercentile(sortedValues, percentile) {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
}

async function runTest() {
  console.log(`[CONCURRENCY_TEST] Launching ${users.length} concurrent login requests...`);
  const testStart = Date.now();

  // Launch all 300 requests concurrently
  const promises = users.map((user, idx) => executeLogin(user, idx + 1));
  const results = await Promise.all(promises);

  const totalTimeSeconds = (Date.now() - testStart) / 1000;

  // Aggregate Metrics
  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const totalRequests = results.length;
  const successfulLogins = results.filter((r) => r.success).length;
  const failedRequests = results.filter((r) => !r.success).length;
  const errorRatePercent = (failedRequests / totalRequests) * 100;

  const invalidSignatures = results.filter((r) => r.invalidSignature).length;
  const tooManyClientsErrors = results.filter((r) => r.tooManyClients).length;

  const minDuration = durations[0] || 0;
  const maxDuration = durations[durations.length - 1] || 0;
  const avgDuration = durations.reduce((acc, d) => acc + d, 0) / (durations.length || 1);
  const p50Duration = calculatePercentile(durations, 50);
  const p90Duration = calculatePercentile(durations, 90);
  const p95Duration = calculatePercentile(durations, 95);
  const p99Duration = calculatePercentile(durations, 99);

  console.log("\n================================================================================");
  console.log("                           LOAD TEST RESULTS MATRIX                              ");
  console.log("================================================================================");
  console.log(`Total Requests:                ${totalRequests}`);
  console.log(`Successful Logins (200):       ${successfulLogins} (${((successfulLogins / totalRequests) * 100).toFixed(2)}%)`);
  console.log(`Failed Requests:               ${failedRequests} (${errorRatePercent.toFixed(2)}%)`);
  console.log(`Test Duration:                 ${totalTimeSeconds.toFixed(2)}s`);
  console.log(`Throughput:                    ${(totalRequests / totalTimeSeconds).toFixed(2)} req/s`);
  console.log("--------------------------------------------------------------------------------");
  console.log("LATENCY PERCENTILES:");
  console.log(`  Min:                         ${minDuration.toFixed(2)}ms`);
  console.log(`  Average:                     ${avgDuration.toFixed(2)}ms`);
  console.log(`  p50 (Median):                ${p50Duration.toFixed(2)}ms`);
  console.log(`  p90:                         ${p90Duration.toFixed(2)}ms`);
  console.log(`  p95:                         ${p95Duration.toFixed(2)}ms (${(p95Duration / 1000).toFixed(3)}s)`);
  console.log(`  p99:                         ${p99Duration.toFixed(2)}ms`);
  console.log(`  Max:                         ${maxDuration.toFixed(2)}ms`);
  console.log("--------------------------------------------------------------------------------");
  console.log("HARDENING VERIFICATIONS:");
  console.log(`  Invalid Signature Rejections: ${invalidSignatures}`);
  console.log(`  'Too Many Clients' DB Errors: ${tooManyClientsErrors}`);
  console.log("================================================================================");

  // Evaluate Pass Criteria
  const p95Pass = p95Duration < 2000;
  const errorRatePass = errorRatePercent < 1.0;
  const invalidSigPass = invalidSignatures === 0;
  const tooManyClientsPass = tooManyClientsErrors === 0;

  console.log("\nCRITERIA EVALUATION:");
  console.log(`  [${p95Pass ? "PASS" : "FAIL"}] Login p95 < 2.0s:          Actual = ${(p95Duration / 1000).toFixed(3)}s`);
  console.log(`  [${errorRatePass ? "PASS" : "FAIL"}] Error Rate < 1%:           Actual = ${errorRatePercent.toFixed(2)}%`);
  console.log(`  [${invalidSigPass ? "PASS" : "FAIL"}] 0 Invalid Signatures:      Actual = ${invalidSignatures}`);
  console.log(`  [${tooManyClientsPass ? "PASS" : "FAIL"}] 0 'Too Many Clients':      Actual = ${tooManyClientsErrors}`);

  const allPassed = p95Pass && errorRatePass && invalidSigPass && tooManyClientsPass;

  if (allPassed) {
    console.log("\n>>> ALL 4 PRODUCTION HARDENING PASS CRITERIA MET SUCCESSFULLY! <<<\n");
    process.exit(0);
  } else {
    console.error("\n>>> ONE OR MORE HARDENING CRITERIA FAILED! <<<\n");
    process.exit(1);
  }
}

runTest();
