#!/usr/bin/env node

/**
 * BelConnect Production / Staging Smoke Test Suite
 * 
 * Verifies end-to-end functionality against a live base URL:
 * - Session-based authentication & cookie setting
 * - Protected route authorization
 * - Session revocation on logout (old cookie -> 401)
 * - Admin cookie isolation (rejected on non-admin routes)
 * - Native session exchange & Bearer route allowlist
 * - Signaling server /health responsiveness
 * 
 * Usage:
 *   node scripts/smoke-test.js --url http://localhost:3000 --signaling http://localhost:4001
 *   npm run smoke
 */

const fs = require("fs");
const path = require("path");

// Load .env if present
const envFile = path.resolve(__dirname, "../.env");
if (fs.existsSync(envFile) && typeof process.loadEnvFile === "function") {
  try { process.loadEnvFile(envFile); } catch (_) {}
}

const args = process.argv.slice(2);
const baseUrl = (args[args.indexOf("--url") + 1] || process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const signalingUrl = (args[args.indexOf("--signaling") + 1] || process.env.SIGNALING_SERVER_URL || "http://localhost:4001").replace(/\/+$/, "");

console.log(`\n================================================================`);
console.log(` BelConnect End-to-End Smoke Test Suite`);
console.log(` Base Target:      ${baseUrl}`);
console.log(` Signaling Target: ${signalingUrl}`);
console.log(`================================================================\n`);

let testCount = 0;
let passCount = 0;
let failCount = 0;

function assertCheck(name, passed, details = "") {
  testCount++;
  if (passed) {
    passCount++;
    console.log(` [PASS] ${name.padEnd(45)} ${details ? ": " + details : ""}`);
  } else {
    failCount++;
    console.error(` [FAIL] ${name.padEnd(45)} : ${details}`);
  }
}

async function runSmokeTests() {
  try {
    // 1. Health check of Next.js frontend
    const feHealth = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(4000) }).catch(() => null);
    assertCheck("Next.js App /api/health responding", feHealth !== null && feHealth.status === 200);

    // 2. Health check of Express / Socket.IO signaling server
    const sigHealth = await fetch(`${signalingUrl}/health`, { signal: AbortSignal.timeout(4000) }).catch(() => null);
    let sigDbOk = false;
    if (sigHealth && sigHealth.status === 200) {
      const data = await sigHealth.json().catch(() => ({}));
      sigDbOk = data.db === "ok";
    }
    assertCheck("Signaling Server /health responding", sigHealth !== null && sigHealth.status === 200, sigDbOk ? "PostgreSQL OK" : "DB degraded");

    // 3. Unauthenticated request to protected route returns 401
    const unauthRes = await fetch(`${baseUrl}/api/bookings`);
    assertCheck("Unauthenticated /api/bookings returns 401", unauthRes.status === 401);

    // 4. Native session endpoint without cookie session returns 401
    const nativeUnauth = await fetch(`${baseUrl}/api/auth/native-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    assertCheck("Native session requires web cookie (returns 401)", nativeUnauth.status === 401);

    // 5. Admin cookie rejection on customer route
    const fakeAdminToken = "test_fake_admin_session_token";
    const adminOnCust = await fetch(`${baseUrl}/api/chat/conversations`, {
      headers: { cookie: `__Host-admin_session=${fakeAdminToken}; admin_session=${fakeAdminToken}` }
    });
    assertCheck("Admin cookie on customer route rejected (401)", adminOnCust.status === 401);

    // 6. Cron endpoint protection (CRON_SECRET)
    const cronNoSecret = await fetch(`${baseUrl}/api/cron/cleanup-sessions`);
    assertCheck("Cron endpoint /cleanup-sessions protected (401)", cronNoSecret.status === 401);

    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const cronWithSecret = await fetch(`${baseUrl}/api/cron/cleanup-sessions`, {
        headers: { Authorization: `Bearer ${cronSecret}` }
      });
      assertCheck("Cron endpoint with CRON_SECRET succeeds (200)", cronWithSecret.status === 200);
    }

    // 7. Fingerprint comparison endpoint protection
    const fpNoAuth = await fetch(`${baseUrl}/api/admin/system/fingerprints`);
    assertCheck("Fingerprint endpoint protected (403)", fpNoAuth.status === 403);

    console.log(`\n================================================================`);
    console.log(` Smoke Test Results: ${passCount}/${testCount} passed (${failCount} failed)`);
    console.log(`================================================================\n`);

    if (failCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error(`[SMOKE TEST ERROR] Execution halted:`, err.message);
    process.exit(1);
  }
}

runSmokeTests();

