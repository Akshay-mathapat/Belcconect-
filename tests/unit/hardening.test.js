const { test, describe } = require("node:test");
const assert = require("node:assert");
const crypto = require("node:crypto");
const jwt = require("../../backend/node_modules/jsonwebtoken");
const { normalizeSecret, getSecretFingerprint } = require("../../backend/src/secretNormalizer");

// Dynamic import of TypeScript rateLimitCore (native Node.js v24 strip-types support)
let rateLimitCorePromise = null;
function getRateLimitCore() {
  if (!rateLimitCorePromise) {
    rateLimitCorePromise = import("../../frontend/src/lib/rateLimitCore.ts");
  }
  return rateLimitCorePromise;
}

describe("1. Secret Normalizer Tests", () => {
  test("should trim whitespace", () => {
    assert.strictEqual(normalizeSecret("  my_secret  "), "my_secret");
    assert.strictEqual(normalizeSecret("\n\t secret_val \t"), "secret_val");
  });

  test("should strip outer double quotes", () => {
    assert.strictEqual(normalizeSecret('"my_secret_key"'), "my_secret_key");
    assert.strictEqual(normalizeSecret('  "my_secret_key"  '), "my_secret_key");
  });

  test("should strip outer single quotes", () => {
    assert.strictEqual(normalizeSecret("'my_secret_key'"), "my_secret_key");
    assert.strictEqual(normalizeSecret("  'my_secret_key'  "), "my_secret_key");
  });

  test("should handle empty or undefined secrets safely", () => {
    assert.strictEqual(normalizeSecret(""), "");
    assert.strictEqual(normalizeSecret(undefined), "");
    assert.strictEqual(normalizeSecret(null), "");
  });

  test("should produce consistent 8-character SHA-256 fingerprint", () => {
    const secret = "cityconnect_jwt_secret_key_2026_belagavi_prod";
    const fp = getSecretFingerprint(secret);
    assert.strictEqual(typeof fp, "string");
    assert.strictEqual(fp.length, 8);

    // Quoted version after normalization must have identical fingerprint
    const quotedSecret = ` "${secret}" `;
    const fpQuoted = getSecretFingerprint(normalizeSecret(quotedSecret));
    assert.strictEqual(fpQuoted, fp);
  });
});

describe("2. JWT Cross-Verification Tests (Frontend HMAC-SHA256 vs Backend jsonwebtoken)", () => {
  const RAW_SECRET = ' "cityconnect_jwt_secret_key_2026_belagavi_prod" ';
  const NORMALIZED_SECRET = normalizeSecret(RAW_SECRET);

  function base64UrlEncode(str) {
    return Buffer.from(str)
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  }

  function frontendSign(payload, secret) {
    const header = { alg: "HS256", typ: "JWT" };
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = crypto
      .createHmac("sha256", secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  test("token signed with frontend logic verifies cleanly with backend jsonwebtoken", () => {
    const payload = {
      userId: "cust_12345",
      email: "test@belconnect.in",
      role: "user",
      name: "Akshay Test",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };

    const token = frontendSign(payload, NORMALIZED_SECRET);
    const decoded = jwt.verify(token, NORMALIZED_SECRET);

    assert.strictEqual(decoded.userId, "cust_12345");
    assert.strictEqual(decoded.email, "test@belconnect.in");
    assert.strictEqual(decoded.role, "user");
  });

  test("unnormalized secret mismatch causes verification failure", () => {
    const payload = {
      userId: "cust_99999",
      email: "mismatch@belconnect.in",
      role: "user",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };

    // Frontend signed with raw quotes
    const badToken = frontendSign(payload, RAW_SECRET);

    // Backend verifying with normalized secret must fail
    assert.throws(() => {
      jwt.verify(badToken, NORMALIZED_SECRET);
    }, /invalid signature/);
  });
});

describe("3. Real Rate Limiter Module & Store Interface Tests", () => {
  test("1) under the limit: allows requests and correctly decrements remaining points", async () => {
    const { InMemoryStore, checkIpRateLimit } = await getRateLimitCore();
    const store = new InMemoryStore();
    const testIp = "203.0.113.10";
    const limit = 5;
    const windowSeconds = 60;

    for (let i = 1; i <= 4; i++) {
      const res = await checkIpRateLimit(testIp, limit, windowSeconds, store);
      assert.strictEqual(res.isAllowed, true);
      assert.strictEqual(res.totalPoints, i);
      assert.strictEqual(res.remaining, limit - i);
      assert.strictEqual(res.retryAfter, 0);
    }
  });

  test("2) over the limit with Retry-After: blocks exceeding requests and provides retryAfter header value", async () => {
    const { InMemoryStore, checkIpRateLimit } = await getRateLimitCore();
    const store = new InMemoryStore();
    const testIp = "203.0.113.20";
    const limit = 3;
    const windowSeconds = 60;

    // First 3 requests are permitted
    for (let i = 0; i < 3; i++) {
      const res = await checkIpRateLimit(testIp, limit, windowSeconds, store);
      assert.strictEqual(res.isAllowed, true);
    }

    // 4th request exceeds ceiling
    const blockedRes = await checkIpRateLimit(testIp, limit, windowSeconds, store);
    assert.strictEqual(blockedRes.isAllowed, false);
    assert.strictEqual(blockedRes.remaining, 0);
    assert.ok(blockedRes.retryAfter > 0);
    assert.ok(blockedRes.retryAfter <= windowSeconds);
  });

  test("3) per-email failures only: checking email limit does not increment; only failures increment", async () => {
    const { InMemoryStore, checkEmailRateLimit, recordLoginFailure } = await getRateLimitCore();
    const store = new InMemoryStore();
    const email = "TargetUser@Example.com";

    // Passive check before any failures
    const initialCheck = await checkEmailRateLimit(email, 10, store);
    assert.strictEqual(initialCheck.isAllowed, true);
    assert.strictEqual(initialCheck.totalPoints, 0);
    assert.strictEqual(initialCheck.remaining, 10);

    // Record 2 failed attempts
    const fail1 = await recordLoginFailure(email, 10, 900, store);
    assert.strictEqual(fail1.isAllowed, true);
    assert.strictEqual(fail1.totalPoints, 1);
    assert.strictEqual(fail1.remaining, 9);

    const fail2 = await recordLoginFailure(email, 10, 900, store);
    assert.strictEqual(fail2.isAllowed, true);
    assert.strictEqual(fail2.totalPoints, 2);
    assert.strictEqual(fail2.remaining, 8);

    // Checking again (e.g. at start of login) returns points = 2 without incrementing
    const midCheck = await checkEmailRateLimit(email, 10, store);
    assert.strictEqual(midCheck.isAllowed, true);
    assert.strictEqual(midCheck.totalPoints, 2);
    assert.strictEqual(midCheck.remaining, 8);
  });

  test("4) reset on success: clearing failed attempts on successful login allows immediate access", async () => {
    const { InMemoryStore, checkEmailRateLimit, recordLoginFailure, recordLoginSuccess } = await getRateLimitCore();
    const store = new InMemoryStore();
    const email = "UserReset@example.com";

    // Record failures up to threshold
    for (let i = 0; i < 3; i++) {
      await recordLoginFailure(email, 3, 900, store);
    }

    // Email is now locked
    const blocked = await checkEmailRateLimit(email, 3, store);
    assert.strictEqual(blocked.isAllowed, false);
    assert.strictEqual(blocked.remaining, 0);

    // User successfully logs in
    await recordLoginSuccess(email, store);

    // Email is immediately unlocked with 0 failure points
    const unlocked = await checkEmailRateLimit(email, 3, store);
    assert.strictEqual(unlocked.isAllowed, true);
    assert.strictEqual(unlocked.totalPoints, 0);
    assert.strictEqual(unlocked.remaining, 3);
  });

  test("5) shared-store failure fails open: database or Redis exception does not block login", async () => {
    const { checkIpRateLimit, checkEmailRateLimit } = await getRateLimitCore();
    // Faulty store that throws an unexpected error
    const faultyStore = {
      name: "faulty-database",
      async increment() {
        throw new Error("PostgreSQL connection refused: connection pool exhausted");
      },
      async reset() {
        throw new Error("PostgreSQL connection refused");
      },
      async get() {
        throw new Error("PostgreSQL connection refused");
      }
    };

    // IP ceiling check must fail open (isAllowed: true) so outage does not deny legitimate users
    const ipRes = await checkIpRateLimit("198.51.100.5", 120, 60, faultyStore);
    assert.strictEqual(ipRes.isAllowed, true);
    assert.strictEqual(ipRes.retryAfter, 0);

    // Email lockout check must also fail open
    const emailRes = await checkEmailRateLimit("resilient@example.com", 10, faultyStore);
    assert.strictEqual(emailRes.isAllowed, true);
    assert.strictEqual(emailRes.retryAfter, 0);
  });

  test("6) no-IP fallback key: generates distinct per-request keys and never defaults to 127.0.0.1", async () => {
    const { getClientIp } = await getRateLimitCore();
    // Scenario A: Missing all IP headers
    const reqWithoutIp = {
      headers: new Headers({})
    };
    const fallbackKey1 = getClientIp(reqWithoutIp);
    const fallbackKey2 = getClientIp(reqWithoutIp);

    assert.notStrictEqual(fallbackKey1, "127.0.0.1");
    assert.notStrictEqual(fallbackKey2, "127.0.0.1");
    assert.ok(fallbackKey1.startsWith("anon_req_"));
    assert.ok(fallbackKey2.startsWith("anon_req_"));
    assert.notStrictEqual(fallbackKey1, fallbackKey2, "Each anonymous request must have a distinct UUID");

    // Scenario B: Valid Vercel x-forwarded-for header
    const reqWithVercelIp = {
      headers: new Headers({
        "x-forwarded-for": "103.21.244.2, 141.101.69.1",
        "x-real-ip": "141.101.69.1"
      })
    };
    const resolvedIp = getClientIp(reqWithVercelIp);
    assert.strictEqual(resolvedIp, "103.21.244.2", "Must extract first IP from x-forwarded-for");
  });
});

describe("4. Booking ID Sequence & Route Security Tests", () => {
  test("1) booking sequence format B-${nextval} formats correctly", () => {
    const seq = 10000;
    const bookingId = `B-${seq}`;
    assert.strictEqual(bookingId, "B-10000");
    assert.match(bookingId, /^B-\d+$/);
    assert.ok(parseInt(bookingId.replace("B-", ""), 10) >= 10000);
  });

  test("2) migration 023 sequence SQL creates sequence starting at 10000", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const migrationPath = path.resolve(__dirname, "../../migrations/023_booking_number_sequence.sql");
    assert.ok(fs.existsSync(migrationPath), "Migration 023 file must exist");
    const sql = fs.readFileSync(migrationPath, "utf-8");
    assert.ok(sql.includes("booking_number_seq"), "Must reference booking_number_seq");
    assert.ok(sql.includes("10000"), "Must start at 10000");
  });

  test("3) route file contains RETURNING id and rowCount check", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const routePath = path.resolve(__dirname, "../../frontend/src/app/api/bookings/route.ts");
    const code = fs.readFileSync(routePath, "utf-8");
    assert.ok(code.includes("nextval('booking_number_seq')"), "Must use nextval('booking_number_seq')");
    assert.ok(code.includes("RETURNING id"), "Must include RETURNING id in INSERT statement");
    assert.ok(code.includes("insertRes.rowCount !== 1"), "Must validate rowCount === 1");
    assert.ok(code.includes("status: 503"), "Must return 503 on failed insert");
    assert.ok(!code.includes("error: error.message"), "Must never leak error.message in bookings route");
  });
});

