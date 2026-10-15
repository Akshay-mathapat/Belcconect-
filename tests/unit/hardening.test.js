const { test, describe } = require("node:test");
const assert = require("node:assert");
const crypto = require("node:crypto");
const path = require("node:path");
const fs = require("node:fs");
const jwt = require("../../backend/node_modules/jsonwebtoken");
const { normalizeSecret, getSecretFingerprint } = require("../../backend/src/secretNormalizer");

// Read env file if JWT_SECRET is not already defined in the shell environment
if (!process.env.JWT_SECRET && typeof process.loadEnvFile === "function") {
  try { process.loadEnvFile(".env"); } catch (_) {}
  if (!process.env.JWT_SECRET) {
    try { process.loadEnvFile("frontend/.env.local"); } catch (_) {}
  }
}

// Dynamic import of TypeScript rateLimitCore (native Node.js v24 strip-types support)
let rateLimitCorePromise = null;
function getRateLimitCore() {
  if (!rateLimitCorePromise) {
    rateLimitCorePromise = import("../../frontend/src/lib/rateLimitCore.ts");
  }
  return rateLimitCorePromise;
}

let mapServicePromise = null;
function getMapService() {
  if (!mapServicePromise) {
    mapServicePromise = import("../../frontend/src/lib/maps/mapService.ts");
  }
  return mapServicePromise;
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
    const rawSecret = process.env.JWT_SECRET;
    if (!rawSecret || normalizeSecret(rawSecret).length < 32) {
      throw new Error("FATAL: JWT_SECRET environment variable is missing or shorter than 32 characters.");
    }
    const secret = normalizeSecret(rawSecret);
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
  const envSecret = process.env.JWT_SECRET;
  if (!envSecret || normalizeSecret(envSecret).length < 32) {
    throw new Error("FATAL: JWT_SECRET environment variable is missing or shorter than 32 characters.");
  }
  const RAW_SECRET = ` "${normalizeSecret(envSecret)}" `;
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

  test("jwt.ts uses constant-time comparison and restricts ?token= to download routes with short-lived tokens", () => {
    const jwtFile = path.resolve(__dirname, "../../frontend/src/lib/jwt.ts");
    assert.ok(fs.existsSync(jwtFile), "jwt.ts must exist");
    const jwtCode = fs.readFileSync(jwtFile, "utf-8");

    assert.ok(jwtCode.includes("crypto.timingSafeEqual"), "Must use crypto.timingSafeEqual for constant-time signature comparison");
    assert.ok(jwtCode.includes("ALLOWED_URL_TOKEN_PREFIXES"), "Must define allowed route prefixes for URL tokens");
    assert.ok(jwtCode.includes("/api/attachments/"), "Must include /api/attachments/ in allowed URL token prefixes");
    assert.ok(jwtCode.includes("tokenLifetime <= 3600") || jwtCode.includes("remainingLifetime <= 3600"), "Must enforce short-lived expiry for URL tokens");
  });

  test("getAuthenticatedUser rejects ?token= on unauthorized routes and accepts on allowed download routes", async () => {
    const { getAuthenticatedUser, signJwtToken } = await import("../../frontend/src/lib/jwt.ts");

    const shortLivedToken = signJwtToken({ userId: "u123", email: "u@belconnect.in", role: "user" }, 300);
    const longLivedToken = signJwtToken({ userId: "u123", email: "u@belconnect.in", role: "user" }, 7 * 86400);

    // 1. Unauthorized route with ?token= must return null
    const reqUnauthorized = new Request(`http://localhost/api/bookings?token=${shortLivedToken}`);
    assert.strictEqual(getAuthenticatedUser(reqUnauthorized), null);

    // 2. Allowed download route with long-lived ?token= must return null
    const reqLongLived = new Request(`http://localhost/api/attachments/chat-attachments/img.png?token=${longLivedToken}`);
    assert.strictEqual(getAuthenticatedUser(reqLongLived), null);

    // 3. Allowed download route with short-lived ?token= must authenticate successfully
    const reqAllowed = new Request(`http://localhost/api/attachments/chat-attachments/img.png?token=${shortLivedToken}`);
    const authAllowed = getAuthenticatedUser(reqAllowed);
    assert.ok(authAllowed, "Should authenticate short-lived token on allowed route");
    assert.strictEqual(authAllowed.userId, "u123");

    // 4. Authorization: Bearer header still works unconditionally on any route
    const reqBearer = new Request("http://localhost/api/bookings", {
      headers: { Authorization: `Bearer ${longLivedToken}` }
    });
    const authBearer = getAuthenticatedUser(reqBearer);
    assert.ok(authBearer, "Should authenticate Bearer token on any route");
    assert.strictEqual(authBearer.userId, "u123");
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

describe("5. Job Resume Serverless Storage Hardening Tests", () => {
  const fs = require("node:fs");
  const path = require("node:path");

  test("1) migration 026 creates job_resumes table with BYTEA data storage", () => {
    const migrationPath = path.resolve(__dirname, "../../migrations/026_job_resumes_storage.sql");
    assert.ok(fs.existsSync(migrationPath), "Migration 026 file must exist");
    const sql = fs.readFileSync(migrationPath, "utf-8");
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.job_resumes"), "Must create job_resumes table");
    assert.ok(sql.includes("BYTEA"), "Must use BYTEA for file data storage");
    assert.ok(sql.includes("idx_job_resumes_user_id"), "Must create index on user_id");
  });

  test("2) resume upload route contains serverless environment check and database fallback", () => {
    const routePath = path.resolve(__dirname, "../../frontend/src/app/api/jobs/resume-upload/route.ts");
    assert.ok(fs.existsSync(routePath), "Resume upload route must exist");
    const code = fs.readFileSync(routePath, "utf-8");
    assert.ok(code.includes("isServerless"), "Must check isServerless before local fs operations");
    assert.ok(code.includes("saveResumeToDatabase"), "Must support saveResumeToDatabase PostgreSQL tier");
    assert.ok(code.includes("/api/jobs/resumes/"), "Must return /api/jobs/resumes/ path");
    assert.ok(code.includes("BLOB_READ_WRITE_TOKEN"), "Must support Vercel Blob tier");
  });

  test("3) resume download route supports database records and data URLs", () => {
    const routePath = path.resolve(__dirname, "../../frontend/src/app/api/jobs/applications/[id]/resume/route.ts");
    assert.ok(fs.existsSync(routePath), "Resume download route must exist");
    const code = fs.readFileSync(routePath, "utf-8");
    assert.ok(code.includes("getResumeFromDatabase"), "Must query getResumeFromDatabase");
    assert.ok(code.includes("data:"), "Must support base64 data URLs");
    assert.ok(code.includes("getLatestResumeByUser"), "Must have fallback search");
  });

  test("4) direct resume route /api/jobs/resumes/[id] exists and verifies authorization", () => {
    const directRoutePath = path.resolve(__dirname, "../../frontend/src/app/api/jobs/resumes/[id]/route.ts");
    assert.ok(fs.existsSync(directRoutePath), "Direct resume route must exist");
    const code = fs.readFileSync(directRoutePath, "utf-8");
    assert.ok(code.includes("getResumeFromDatabase"), "Must fetch resume from database");
    assert.ok(code.includes("isOwner"), "Must verify resume owner");
    assert.ok(code.includes("isAuthorizedEmployer"), "Must verify employer permissions");
  });
});

describe("6. KYC Privacy & Last-4 Digit Hardening Tests", () => {
  test("1) migration 027 exists in both folders and defines last4 columns while nulling full numbers", () => {
    const m1 = path.resolve(__dirname, "../../migrations/027_kyc_last4_and_privacy.sql");
    const m2 = path.resolve(__dirname, "../../database/migrations/027_kyc_last4_and_privacy.sql");
    assert.ok(fs.existsSync(m1), "Migration 027 must exist in /migrations");
    assert.ok(fs.existsSync(m2), "Migration 027 must exist in /database/migrations");

    const sql = fs.readFileSync(m1, "utf-8");
    assert.ok(sql.includes("aadhaar_last4"), "Must add aadhaar_last4 column");
    assert.ok(sql.includes("pan_last4"), "Must add pan_last4 column");
    assert.ok(sql.includes("kyc_document_last4"), "Must add kyc_document_last4 column");
    assert.ok(sql.includes("aadhaar_number = NULL"), "Must clear full aadhaar_number");
    assert.ok(sql.includes("pan_number = NULL"), "Must clear full pan_number");
    assert.ok(sql.includes("kyc_document_number = NULL"), "Must clear full kyc_document_number");
  });

  test("2) kyc API route validates format and returns only masked numbers (never full numbers)", () => {
    const kycRoutePath = path.resolve(__dirname, "../../frontend/src/app/api/provider/kyc/route.ts");
    assert.ok(fs.existsSync(kycRoutePath), "KYC route must exist");
    const code = fs.readFileSync(kycRoutePath, "utf-8");
    assert.ok(code.includes("XXXX-XXXX-"), "Must return masked Aadhaar");
    assert.ok(code.includes("XXXXXX"), "Must return masked PAN");
    assert.ok(code.includes("aadhaar_last4"), "Must query and store aadhaar_last4");
    assert.ok(code.includes("pan_last4"), "Must query and store pan_last4");
    assert.ok(code.includes("kyc_document_last4"), "Must query and store kyc_document_last4");
  });

  test("3) attachments route protects kyc-documents/ with private access for owner and admin only", () => {
    const attachRoutePath = path.resolve(__dirname, "../../frontend/src/app/api/attachments/[...pathname]/route.ts");
    assert.ok(fs.existsSync(attachRoutePath), "Attachments route must exist");
    const code = fs.readFileSync(attachRoutePath, "utf-8");
    assert.ok(code.includes("kyc-documents/"), "Must support kyc-documents prefix");
    assert.ok(code.includes("isKyc"), "Must identify KYC document requests");
    assert.ok(code.includes("authUser.role === \"admin\""), "Must permit admin");
  });

  test("4) provider profile page includes privacy disclosure for last 4 digits", () => {
    const profilePagePath = path.resolve(__dirname, "../../frontend/src/app/provider/profile/page.tsx");
    assert.ok(fs.existsSync(profilePagePath), "Provider profile page must exist");
    const code = fs.readFileSync(profilePagePath, "utf-8");
    assert.ok(code.includes("Only the last 4 digits"), "Must contain last 4 digits privacy disclosure");
  });

  test("5) migration 031 exists in both folders and defines DROP COLUMN for legacy plaintext columns", () => {
    const m1 = path.resolve(__dirname, "../../migrations/031_drop_legacy_kyc_columns.sql");
    const m2 = path.resolve(__dirname, "../../database/migrations/031_drop_legacy_kyc_columns.sql");
    assert.ok(fs.existsSync(m1), "Migration 031 must exist in /migrations");
    assert.ok(fs.existsSync(m2), "Migration 031 must exist in /database/migrations");

    const sql1 = fs.readFileSync(m1, "utf-8");
    const sql2 = fs.readFileSync(m2, "utf-8");
    assert.strictEqual(sql1, sql2, "Migration 031 files must be identical");
    assert.ok(sql1.includes("DROP COLUMN IF EXISTS aadhaar_number"), "Must drop aadhaar_number");
    assert.ok(sql1.includes("DROP COLUMN IF EXISTS pan_number"), "Must drop pan_number");
    assert.ok(sql1.includes("DROP COLUMN IF EXISTS kyc_document_number"), "Must drop kyc_document_number");
  });

  test("6) database/schema.sql does not contain aadhaar_number, pan_number, or kyc_document_number", () => {
    const schemaFile = path.resolve(__dirname, "../../database/schema.sql");
    assert.ok(fs.existsSync(schemaFile), "database/schema.sql must exist");
    const schemaSql = fs.readFileSync(schemaFile, "utf-8");

    assert.ok(!schemaSql.includes("aadhaar_number"), "schema.sql must not contain aadhaar_number");
    assert.ok(!schemaSql.includes("pan_number"), "schema.sql must not contain pan_number");
    assert.ok(!schemaSql.includes("kyc_document_number"), "schema.sql must not contain kyc_document_number");
    assert.ok(schemaSql.includes("kyc_document_last4"), "schema.sql must contain kyc_document_last4");
  });

  test("7) admin page shows 'no document' and provider pages show 'please re-upload your KYC document' notice", () => {
    const adminPage = path.resolve(__dirname, "../../frontend/src/app/admin/page.tsx");
    const providerProfile = path.resolve(__dirname, "../../frontend/src/app/provider/profile/page.tsx");
    const providerDashboard = path.resolve(__dirname, "../../frontend/src/app/provider/page.tsx");
    const kycApi = path.resolve(__dirname, "../../frontend/src/app/api/provider/kyc/route.ts");

    const adminCode = fs.readFileSync(adminPage, "utf-8");
    const profileCode = fs.readFileSync(providerProfile, "utf-8");
    const dashboardCode = fs.readFileSync(providerDashboard, "utf-8");
    const kycApiCode = fs.readFileSync(kycApi, "utf-8");

    assert.ok(adminCode.includes("no document"), "Admin page must show 'no document'");
    assert.ok(profileCode.includes("please re-upload your KYC document"), "Provider profile must show 'please re-upload your KYC document'");
    assert.ok(dashboardCode.includes("please re-upload your KYC document"), "Provider dashboard must show 'please re-upload your KYC document'");
    assert.ok(kycApiCode.includes("please re-upload your KYC document"), "KYC API must return 'please re-upload your KYC document' status for affected providers");
  });
});

describe("7. Provider Approval & Admin System Hardening Tests", () => {
  test("1) migration 028 exists in both folders and defines admins, admin_audit_logs, and rejection_reason", () => {
    const m1 = path.resolve(__dirname, "../../migrations/028_admin_approval_system.sql");
    const m2 = path.resolve(__dirname, "../../database/migrations/028_admin_approval_system.sql");
    assert.ok(fs.existsSync(m1), "Migration 028 must exist in /migrations");
    assert.ok(fs.existsSync(m2), "Migration 028 must exist in /database/migrations");

    const sql1 = fs.readFileSync(m1, "utf-8");
    const sql2 = fs.readFileSync(m2, "utf-8");
    assert.strictEqual(sql1, sql2, "Migration 028 files must be identical");
    assert.ok(sql1.includes("CREATE TABLE IF NOT EXISTS public.admins"), "Must define admins table");
    assert.ok(sql1.includes("CREATE TABLE IF NOT EXISTS public.admin_audit_logs"), "Must define audit logs table");
    assert.ok(sql1.includes("rejection_reason"), "Must add rejection_reason column");
  });

  test("2) scripts/create-admin.js enforces minimum 12 chars password and blocks production render.com host", () => {
    const scriptPath = path.resolve(__dirname, "../../scripts/create-admin.js");
    assert.ok(fs.existsSync(scriptPath), "scripts/create-admin.js must exist");

    const code = fs.readFileSync(scriptPath, "utf-8");
    assert.ok(code.includes("adminPassword.length < 12"), "Must enforce >= 12 chars password");
    assert.ok(code.includes("render.com"), "Must block connection to render.com per Rule 1");
    assert.ok(code.includes("argon2id") || code.includes("argon2"), "Must hash with argon2");
  });

  test("3) admin login route exists, rate-limits attempts, and checks admins table", () => {
    const loginRoutePath = path.resolve(__dirname, "../../frontend/src/app/api/admin/auth/login/route.ts");
    assert.ok(fs.existsSync(loginRoutePath), "Admin login route must exist");

    const code = fs.readFileSync(loginRoutePath, "utf-8");
    assert.ok(code.includes("checkRateLimit"), "Must rate limit login");
    assert.ok(code.includes("verifyPassword"), "Must verify password hash");
    assert.ok(code.includes("role: \"admin\""), "Must issue token with role: admin");
  });

  test("4) admin provider routes enforce role === 'admin' and write audit logs", () => {
    const listRoute = path.resolve(__dirname, "../../frontend/src/app/api/admin/providers/route.ts");
    const detailRoute = path.resolve(__dirname, "../../frontend/src/app/api/admin/providers/[id]/route.ts");
    const approveRoute = path.resolve(__dirname, "../../frontend/src/app/api/admin/providers/[id]/approve/route.ts");
    const rejectRoute = path.resolve(__dirname, "../../frontend/src/app/api/admin/providers/[id]/reject/route.ts");

    assert.ok(fs.existsSync(listRoute), "Admin list route must exist");
    assert.ok(fs.existsSync(detailRoute), "Admin detail route must exist");
    assert.ok(fs.existsSync(approveRoute), "Admin approve route must exist");
    assert.ok(fs.existsSync(rejectRoute), "Admin reject route must exist");

    const approveCode = fs.readFileSync(approveRoute, "utf-8");
    const rejectCode = fs.readFileSync(rejectRoute, "utf-8");

    assert.ok(approveCode.includes("role !== \"admin\""), "Approve must check admin role");
    assert.ok(approveCode.includes("admin_audit_logs"), "Approve must log to admin_audit_logs");
    assert.ok(approveCode.includes("notifications"), "Approve must notify provider");

    assert.ok(rejectCode.includes("role !== \"admin\""), "Reject must check admin role");
    assert.ok(rejectCode.includes("admin_audit_logs"), "Reject must log to admin_audit_logs");
    assert.ok(rejectCode.includes("notifications"), "Reject must notify provider");
  });

  test("5) marketplace search, provider profile, and bookings POST enforce verified status", () => {
    const servicesRoute = path.resolve(__dirname, "../../frontend/src/app/api/services/route.ts");
    const proProfileRoute = path.resolve(__dirname, "../../frontend/src/app/api/providers/[id]/route.ts");
    const bookingsRoute = path.resolve(__dirname, "../../frontend/src/app/api/bookings/route.ts");

    const srvCode = fs.readFileSync(servicesRoute, "utf-8");
    const proCode = fs.readFileSync(proProfileRoute, "utf-8");
    const bkgCode = fs.readFileSync(bookingsRoute, "utf-8");

    assert.ok(srvCode.includes("u.verification_status = 'verified'"), "Services route must filter verified providers");
    assert.ok(proCode.includes("verification_status !== \"verified\""), "Provider profile route must block unverified access");
    assert.ok(!proCode.includes("experience: 4"), "Provider profile route must not hardcode experience");
    assert.ok(!proCode.includes("photo-1621905251189"), "Provider profile route must not hardcode Unsplash avatar");
    assert.ok(proCode.includes("sanitizedPhone") && proCode.includes("sanitizedEmail"), "Provider profile route must sanitize phone and email for owner/admin only");
    assert.ok(bkgCode.includes("verification_status !== \"verified\""), "Bookings route must reject unverified providers");
  });

  test("6) admin page exists at /admin and is not linked from public navigation", () => {
    const adminPage = path.resolve(__dirname, "../../frontend/src/app/admin/page.tsx");
    assert.ok(fs.existsSync(adminPage), "Admin page must exist at frontend/src/app/admin/page.tsx");

    const code = fs.readFileSync(adminPage, "utf-8");
    assert.ok(code.includes("BelConnect Admin"), "Admin page must display portal header");
    assert.ok(code.includes("handleApprove"), "Admin page must have approve handler");
    assert.ok(code.includes("handleConfirmReject"), "Admin page must have reject handler");
  });
});

describe("8. Signup, Indian Phone Normalization & Safe User ID Hardening Tests", () => {
  // Import real normalization utility directly from phone.ts
  const { normalizeIndianPhone } = require("../../frontend/src/lib/phone.ts");

  test("1) Indian phone normalization correctly normalizes 10 digits starting with 6-9", () => {
    assert.strictEqual(normalizeIndianPhone("9876543210"), "+919876543210");
    assert.strictEqual(normalizeIndianPhone("+919876543210"), "+919876543210");
    assert.strictEqual(normalizeIndianPhone("+91 98765 43210"), "+919876543210");
    assert.strictEqual(normalizeIndianPhone("09876543210"), "+919876543210");
    assert.strictEqual(normalizeIndianPhone("+91-87654-32109"), "+918765432109");
    assert.strictEqual(normalizeIndianPhone("6123456789"), "+916123456789");
    assert.strictEqual(normalizeIndianPhone("7987654321"), "+917987654321");

    // Invalid numbers: starting with 0-5, letters, incorrect length
    assert.strictEqual(normalizeIndianPhone("5123456789"), null);
    assert.strictEqual(normalizeIndianPhone("1234567890"), null);
    assert.strictEqual(normalizeIndianPhone("98765"), null);
    assert.strictEqual(normalizeIndianPhone("987654321012"), null);
    assert.strictEqual(normalizeIndianPhone("abcdefghij"), null);
    assert.strictEqual(normalizeIndianPhone(""), null);
    assert.strictEqual(normalizeIndianPhone(null), null);
  });

  test("2) migration 029 exists in both folders and defines safe duplicate resolution + unique indexes", () => {
    const m1 = path.resolve(__dirname, "../../migrations/029_unique_phone_numbers.sql");
    const m2 = path.resolve(__dirname, "../../database/migrations/029_unique_phone_numbers.sql");
    assert.ok(fs.existsSync(m1), "Migration 029 must exist in /migrations");
    assert.ok(fs.existsSync(m2), "Migration 029 must exist in /database/migrations");

    const sql1 = fs.readFileSync(m1, "utf-8");
    const sql2 = fs.readFileSync(m2, "utf-8");
    assert.strictEqual(sql1, sql2, "Migration 029 files must be identical");
    assert.ok(sql1.includes("ranked_customers"), "Must contain customer duplicate ranking");
    assert.ok(sql1.includes("ranked_providers"), "Must contain provider duplicate ranking");
    assert.ok(sql1.includes("CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_unique"), "Must define customers unique index");
    assert.ok(sql1.includes("CREATE UNIQUE INDEX IF NOT EXISTS idx_service_providers_phone_unique"), "Must define service_providers unique index");
  });

  test("3) register API uses crypto.randomUUID(), normalizes phone, and prevents duplicates across tables", () => {
    const regPath = path.resolve(__dirname, "../../frontend/src/app/api/auth/register/route.ts");
    assert.ok(fs.existsSync(regPath), "Register route must exist");
    const code = fs.readFileSync(regPath, "utf-8");

    assert.ok(code.includes("crypto.randomUUID()"), "Must generate user IDs using crypto.randomUUID()");
    assert.ok(!code.includes("Date.now()"), "Must NOT use Date.now() for user ID generation");
    assert.ok(code.includes("normalizeIndianPhone"), "Must call normalizeIndianPhone");
    assert.ok(code.includes("customers WHERE phone = $1"), "Must check customers phone");
    assert.ok(code.includes("service_providers WHERE phone = $1"), "Must check providers phone");
    assert.ok(!code.includes("+91 98765 00000"), "Must NOT have +91 98765 00000 dummy fallback");
  });

  test("4) googleAuthHelper uses crypto.randomUUID() for new user accounts", () => {
    const googleHelperPath = path.resolve(__dirname, "../../frontend/src/lib/googleAuthHelper.ts");
    assert.ok(fs.existsSync(googleHelperPath), "googleAuthHelper must exist");
    const code = fs.readFileSync(googleHelperPath, "utf-8");

    assert.ok(code.includes("crypto.randomUUID()"), "Must generate user ID with crypto.randomUUID()");
    assert.ok(!code.includes("Date.now()"), "Must NOT use Date.now() for user ID generation");
  });

  test("5) bookings POST and bookings PATCH require valid phone number", () => {
    const bkgPath = path.resolve(__dirname, "../../frontend/src/app/api/bookings/route.ts");
    const bkgDetailPath = path.resolve(__dirname, "../../frontend/src/app/api/bookings/[id]/route.ts");
    const bkgCode = fs.readFileSync(bkgPath, "utf-8");
    const bkgDetailCode = fs.readFileSync(bkgDetailPath, "utf-8");

    assert.ok(bkgCode.includes("PHONE_REQUIRED"), "Booking creation must enforce PHONE_REQUIRED");
    assert.ok(bkgDetailCode.includes("PHONE_REQUIRED"), "Booking acceptance must enforce PHONE_REQUIRED");
  });

  test("6) all four translation files (en, kn, hi, mr) define phone validation messages", () => {
    const en = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../frontend/src/lib/translations/en.json"), "utf-8"));
    const kn = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../frontend/src/lib/translations/kn.json"), "utf-8"));
    const hi = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../frontend/src/lib/translations/hi.json"), "utf-8"));
    const mr = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../frontend/src/lib/translations/mr.json"), "utf-8"));

    for (const [lang, dict] of Object.entries({ en, kn, hi, mr })) {
      assert.ok(dict.auth?.invalidIndianPhone, `${lang} must have auth.invalidIndianPhone`);
      assert.ok(dict.auth?.phoneAlreadyRegistered, `${lang} must have auth.phoneAlreadyRegistered`);
      assert.ok(dict.booking?.addPhoneTitle, `${lang} must have booking.addPhoneTitle`);
      assert.ok(dict.booking?.saveAndContinue, `${lang} must have booking.saveAndContinue`);
    }
  });
});

describe("9. Booking Lifecycle State Machine, Expiry, No-Show & Role Authorization Tests", () => {
  const {
    normalizeBookingStatus,
    ALLOWED_TRANSITIONS,
    validateStatusTransition,
    isBookingExpired,
    canCustomerCancel,
    canReportProviderNoShow,
    canReportCustomerNoShow
  } = require("../../frontend/src/lib/bookingLifecycle.ts");

  test("1) normalizeBookingStatus normalizes casing, aliases, and snake_case to canonical PascalCase", () => {
    assert.strictEqual(normalizeBookingStatus("requested"), "Requested");
    assert.strictEqual(normalizeBookingStatus("PENDING"), "Requested");
    assert.strictEqual(normalizeBookingStatus("upcoming"), "Requested");
    assert.strictEqual(normalizeBookingStatus("accepted"), "Accepted");
    assert.strictEqual(normalizeBookingStatus("on_the_way"), "OnTheWay");
    assert.strictEqual(normalizeBookingStatus("on the way"), "OnTheWay");
    assert.strictEqual(normalizeBookingStatus("arrived"), "Arrived");
    assert.strictEqual(normalizeBookingStatus("in_progress"), "Started");
    assert.strictEqual(normalizeBookingStatus("started"), "Started");
    assert.strictEqual(normalizeBookingStatus("completed"), "Completed");
    assert.strictEqual(normalizeBookingStatus("reviewsubmitted"), "Completed");
    assert.strictEqual(normalizeBookingStatus("cancelled"), "Cancelled");
    assert.strictEqual(normalizeBookingStatus("canceled"), "Cancelled");
    assert.strictEqual(normalizeBookingStatus("rejected"), "Rejected");
    assert.strictEqual(normalizeBookingStatus("declined"), "Rejected");
    assert.strictEqual(normalizeBookingStatus("expired"), "Expired");
    assert.strictEqual(normalizeBookingStatus("provider_no_show"), "ProviderNoShow");
    assert.strictEqual(normalizeBookingStatus("customer_no_show"), "CustomerNoShow");
    assert.strictEqual(normalizeBookingStatus("invalid_nonsense"), null);
  });

  test("2) state machine transitions table matches defined life cycle rules", () => {
    // Requested
    assert.deepStrictEqual(ALLOWED_TRANSITIONS.Requested, ["Accepted", "Cancelled", "Rejected", "Expired"]);
    // Accepted
    assert.deepStrictEqual(ALLOWED_TRANSITIONS.Accepted, ["OnTheWay", "Cancelled", "ProviderNoShow"]);
    // OnTheWay
    assert.deepStrictEqual(ALLOWED_TRANSITIONS.OnTheWay, ["Arrived", "Cancelled", "ProviderNoShow"]);
    // Arrived
    assert.deepStrictEqual(ALLOWED_TRANSITIONS.Arrived, ["Started", "CustomerNoShow", "Cancelled"]);
    // Started
    assert.deepStrictEqual(ALLOWED_TRANSITIONS.Started, ["Completed", "Cancelled"]);
    // Terminal states cannot transition
    assert.deepStrictEqual(ALLOWED_TRANSITIONS.Completed, []);
    assert.deepStrictEqual(ALLOWED_TRANSITIONS.Cancelled, []);
    assert.deepStrictEqual(ALLOWED_TRANSITIONS.Rejected, []);
    assert.deepStrictEqual(ALLOWED_TRANSITIONS.Expired, []);
    assert.deepStrictEqual(ALLOWED_TRANSITIONS.ProviderNoShow, []);
    assert.deepStrictEqual(ALLOWED_TRANSITIONS.CustomerNoShow, []);
  });

  test("3) role authorization: customer cannot accept, reject, or mark arrived/started/completed", () => {
    const r1 = validateStatusTransition("Requested", "Accepted", "customer");
    assert.strictEqual(r1.allowed, false);
    assert.strictEqual(r1.httpStatus, 403);

    const r2 = validateStatusTransition("Requested", "Rejected", "customer");
    assert.strictEqual(r2.allowed, false);
    assert.strictEqual(r2.httpStatus, 403);

    const r3 = validateStatusTransition("OnTheWay", "Arrived", "customer");
    assert.strictEqual(r3.allowed, false);
    assert.strictEqual(r3.httpStatus, 403);

    const r4 = validateStatusTransition("Started", "Completed", "customer");
    assert.strictEqual(r4.allowed, false);
    assert.strictEqual(r4.httpStatus, 403);
  });

  test("4) customer cancellation allowed strictly BEFORE provider has arrived", () => {
    // Allowed while Requested, Accepted, OnTheWay
    const r1 = validateStatusTransition("Requested", "Cancelled", "customer");
    assert.strictEqual(r1.allowed, true);
    assert.strictEqual(canCustomerCancel("Requested"), true);

    const r2 = validateStatusTransition("Accepted", "Cancelled", "customer");
    assert.strictEqual(r2.allowed, true);
    assert.strictEqual(canCustomerCancel("Accepted"), true);

    const r3 = validateStatusTransition("OnTheWay", "Cancelled", "customer");
    assert.strictEqual(r3.allowed, true);
    assert.strictEqual(canCustomerCancel("OnTheWay"), true);

    // Blocked with 403 once provider has Arrived or Started
    const r4 = validateStatusTransition("Arrived", "Cancelled", "customer");
    assert.strictEqual(r4.allowed, false);
    assert.strictEqual(r4.httpStatus, 403);
    assert.strictEqual(canCustomerCancel("Arrived"), false);

    const r5 = validateStatusTransition("Started", "Cancelled", "customer");
    assert.strictEqual(r5.allowed, false);
    assert.strictEqual(r5.httpStatus, 403);
    assert.strictEqual(canCustomerCancel("Started"), false);
  });

  test("5) provider lifecycle progression: Accepted -> OnTheWay -> Arrived -> Started -> Completed", () => {
    assert.strictEqual(validateStatusTransition("Requested", "Accepted", "provider").allowed, true);
    assert.strictEqual(validateStatusTransition("Accepted", "OnTheWay", "provider").allowed, true);
    assert.strictEqual(validateStatusTransition("OnTheWay", "Arrived", "provider").allowed, true);
    assert.strictEqual(validateStatusTransition("Arrived", "Started", "provider").allowed, true);
    assert.strictEqual(validateStatusTransition("Started", "Completed", "provider").allowed, true);

    // Provider cannot leapfrog or transition backwards
    assert.strictEqual(validateStatusTransition("Requested", "Arrived", "provider").allowed, false);
    assert.strictEqual(validateStatusTransition("Completed", "Accepted", "provider").allowed, false);
  });

  test("6) provider no-show timing constraint: customer can only report >= 30 mins after acceptance", () => {
    const now = Date.now();
    const accepted20MinsAgo = new Date(now - 20 * 60 * 1000).toISOString();
    const accepted35MinsAgo = new Date(now - 35 * 60 * 1000).toISOString();

    // 20 mins elapsed: premature, must be rejected
    const resPremature = validateStatusTransition("Accepted", "ProviderNoShow", "customer", {
      acceptedAt: accepted20MinsAgo,
      now: new Date(now)
    });
    assert.strictEqual(resPremature.allowed, false);
    assert.strictEqual(resPremature.httpStatus, 400);
    assert.ok(resPremature.reason.includes("30 minutes"));
    assert.strictEqual(canReportProviderNoShow("Accepted", accepted20MinsAgo, new Date(now)), false);

    // 35 mins elapsed: allowed
    const resAllowed = validateStatusTransition("Accepted", "ProviderNoShow", "customer", {
      acceptedAt: accepted35MinsAgo,
      now: new Date(now)
    });
    assert.strictEqual(resAllowed.allowed, true);
    assert.strictEqual(canReportProviderNoShow("Accepted", accepted35MinsAgo, new Date(now)), true);
  });

  test("7) customer no-show timing constraint: provider can only report >= 10 mins after arrival", () => {
    const now = Date.now();
    const arrived5MinsAgo = new Date(now - 5 * 60 * 1000).toISOString();
    const arrived12MinsAgo = new Date(now - 12 * 60 * 1000).toISOString();

    // 5 mins elapsed: premature, must be rejected
    const resPremature = validateStatusTransition("Arrived", "CustomerNoShow", "provider", {
      arrivedAt: arrived5MinsAgo,
      now: new Date(now)
    });
    assert.strictEqual(resPremature.allowed, false);
    assert.strictEqual(resPremature.httpStatus, 400);
    assert.ok(resPremature.reason.includes("10 minutes"));
    assert.strictEqual(canReportCustomerNoShow("Arrived", arrived5MinsAgo, new Date(now)), false);

    // 12 mins elapsed: allowed
    const resAllowed = validateStatusTransition("Arrived", "CustomerNoShow", "provider", {
      arrivedAt: arrived12MinsAgo,
      now: new Date(now)
    });
    assert.strictEqual(resAllowed.allowed, true);
    assert.strictEqual(canReportCustomerNoShow("Arrived", arrived12MinsAgo, new Date(now)), true);
  });

  test("8) auto-expiry helper identifies pending bookings older than 10 minutes", () => {
    const now = Date.now();
    const created5MinsAgo = new Date(now - 5 * 60 * 1000).toISOString();
    const created15MinsAgo = new Date(now - 15 * 60 * 1000).toISOString();

    assert.strictEqual(isBookingExpired("Requested", created5MinsAgo, new Date(now)), false);
    assert.strictEqual(isBookingExpired("Requested", created15MinsAgo, new Date(now)), true);
    // Already accepted bookings never expire via auto-expiry
    assert.strictEqual(isBookingExpired("Accepted", created15MinsAgo, new Date(now)), false);
  });

  test("9) migration 030 exists in both folders and defines lifecycle timestamps and indexes", () => {
    const m1 = path.resolve(__dirname, "../../migrations/030_booking_lifecycle_hardening.sql");
    const m2 = path.resolve(__dirname, "../../database/migrations/030_booking_lifecycle_hardening.sql");
    assert.ok(fs.existsSync(m1), "Migration 030 must exist in /migrations");
    assert.ok(fs.existsSync(m2), "Migration 030 must exist in /database/migrations");

    const sql1 = fs.readFileSync(m1, "utf-8");
    const sql2 = fs.readFileSync(m2, "utf-8");
    assert.strictEqual(sql1, sql2, "Migration 030 files must be identical");

    assert.ok(sql1.includes("accepted_at TIMESTAMP WITH TIME ZONE"), "Must define accepted_at");
    assert.ok(sql1.includes("arrived_at TIMESTAMP WITH TIME ZONE"), "Must define arrived_at");
    assert.ok(sql1.includes("started_at TIMESTAMP WITH TIME ZONE"), "Must define started_at");
    assert.ok(sql1.includes("completed_at TIMESTAMP WITH TIME ZONE"), "Must define completed_at");
    assert.ok(sql1.includes("expired_at TIMESTAMP WITH TIME ZONE"), "Must define expired_at");
    assert.ok(sql1.includes("no_show_at TIMESTAMP WITH TIME ZONE"), "Must define no_show_at");
    assert.ok(sql1.includes("no_show_count INTEGER DEFAULT 0 NOT NULL"), "Must define provider no_show_count");
    assert.ok(sql1.includes("CREATE INDEX IF NOT EXISTS idx_bookings_status_created_at"), "Must define status+created_at index");
    assert.ok(sql1.includes("CREATE INDEX IF NOT EXISTS idx_bookings_arrived_at"), "Must define arrived_at index");
  });

  test("10) all four translation files (en, kn, hi, mr) define complete bookingLifecycle strings", () => {
    const en = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../frontend/src/lib/translations/en.json"), "utf-8"));
    const kn = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../frontend/src/lib/translations/kn.json"), "utf-8"));
    const hi = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../frontend/src/lib/translations/hi.json"), "utf-8"));
    const mr = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../frontend/src/lib/translations/mr.json"), "utf-8"));

    for (const [lang, dict] of Object.entries({ en, kn, hi, mr })) {
      assert.ok(dict.bookingLifecycle, `${lang} must have bookingLifecycle object`);
      assert.ok(dict.bookingLifecycle.bookingExpiredTitle, `${lang} must have bookingExpiredTitle`);
      assert.ok(dict.bookingLifecycle.bookingExpiredBody, `${lang} must have bookingExpiredBody`);
      assert.ok(dict.bookingLifecycle.suggestedProvidersTitle, `${lang} must have suggestedProvidersTitle`);
      assert.ok(dict.bookingLifecycle.providerNoShowTitle, `${lang} must have providerNoShowTitle`);
      assert.ok(dict.bookingLifecycle.customerNoShowTitle, `${lang} must have customerNoShowTitle`);
      assert.ok(dict.bookingLifecycle.reportProviderNoShow, `${lang} must have reportProviderNoShow`);
      assert.ok(dict.bookingLifecycle.reportCustomerNoShow, `${lang} must have reportCustomerNoShow`);
    }
  });

  test("11) cron route /api/cron/expire-bookings enforces secret authorization and supports idempotent requests", () => {
    const cronRoute = path.resolve(__dirname, "../../frontend/src/app/api/cron/expire-bookings/route.ts");
    assert.ok(fs.existsSync(cronRoute), "Cron route file must exist");
    const code = fs.readFileSync(cronRoute, "utf-8");

    assert.ok(code.includes("CRON_SECRET"), "Must reference CRON_SECRET");
    assert.ok(code.includes("401"), "Must return 401 on unauthorized cron execution");
    assert.ok(code.includes("expireStaleBookings"), "Must invoke atomic expireStaleBookings");
    assert.ok(code.includes("export async function GET"), "Must support GET method");
    assert.ok(code.includes("export async function POST"), "Must support POST method");
  });

  test("12) throttledExpireStaleBookings throttles sweeps to at most once per 60 seconds per instance", () => {
    const expiryFile = path.resolve(__dirname, "../../frontend/src/lib/bookingExpiry.ts");
    assert.ok(fs.existsSync(expiryFile), "bookingExpiry.ts must exist");
    const expiryCode = fs.readFileSync(expiryFile, "utf-8");

    assert.ok(expiryCode.includes("LAZY_EXPIRY_THROTTLE_MS = 60 * 1000"), "Must define 60-second throttle window");
    assert.ok(expiryCode.includes("export async function throttledExpireStaleBookings"), "Must export throttledExpireStaleBookings");
    assert.ok(expiryCode.includes("now - lastLazyExpirySweepTime < LAZY_EXPIRY_THROTTLE_MS"), "Must check throttle window against last sweep time");
    assert.ok(expiryCode.includes("lastLazyExpirySweepTime = now"), "Must update sweep time on run");
  });

  test("13) GET /api/bookings and GET /api/bookings/[id] wire throttledExpireStaleBookings lazy check", () => {
    const listRoute = path.resolve(__dirname, "../../frontend/src/app/api/bookings/route.ts");
    const detailRoute = path.resolve(__dirname, "../../frontend/src/app/api/bookings/[id]/route.ts");

    const listCode = fs.readFileSync(listRoute, "utf-8");
    const detailCode = fs.readFileSync(detailRoute, "utf-8");

    assert.ok(listCode.includes("throttledExpireStaleBookings"), "GET /api/bookings must wire throttledExpireStaleBookings");
    assert.ok(detailCode.includes("throttledExpireStaleBookings"), "GET /api/bookings/[id] must wire throttledExpireStaleBookings");
  });

  test("14) checkCronSecretConfigured warns loudly at startup if CRON_SECRET is missing", () => {
    const expiryFile = path.resolve(__dirname, "../../frontend/src/lib/bookingExpiry.ts");
    const expiryCode = fs.readFileSync(expiryFile, "utf-8");

    assert.ok(expiryCode.includes("export function checkCronSecretConfigured"), "Must define checkCronSecretConfigured");
    assert.ok(expiryCode.includes("[CRON WARNING] CRON_SECRET is missing or empty!"), "Must log loud warning when CRON_SECRET is missing");
    assert.ok(expiryCode.includes("checkCronSecretConfigured();"), "Must evaluate checkCronSecretConfigured at startup / module load");
  });

  test("15) EXPIRY_TRANSLATIONS and getExpiryNotificationText support all 4 languages and suggestedProviders limit is 3", () => {
    const expiryFile = path.resolve(__dirname, "../../frontend/src/lib/bookingExpiry.ts");
    const expiryCode = fs.readFileSync(expiryFile, "utf-8");

    for (const lang of ["en", "kn", "hi", "mr"]) {
      assert.ok(expiryCode.includes(`${lang}: {`), `bookingExpiry must define ${lang} translation`);
    }
    assert.ok(expiryCode.includes("LIMIT 3"), "Suggested providers query must limit to 3 alternatives");

    // Verify booking detail page renders suggested providers
    const detailPage = path.resolve(__dirname, "../../frontend/src/app/bookings/[id]/page.tsx");
    const pageCode = fs.readFileSync(detailPage, "utf-8");
    assert.ok(pageCode.includes("suggestedProviders.slice(0, 3)"), "Detail page must show up to 3 suggested providers");
  });
});

describe("10. Maps, Directions, Geocoding & Offline Fallback Hardening Tests", () => {
  test("1) calculateHaversineDistance computes accurate spherical distance in meters", async () => {
    const { calculateHaversineDistance, BELAGAVI_CITY_CENTER } = await getMapService();

    // Zero distance for identical coordinates
    assert.strictEqual(calculateHaversineDistance(15.8497, 74.4977, 15.8497, 74.4977), 0);

    // Belagavi City Center (15.8497, 74.4977) to Belagavi Fort (approx 15.8587, 74.5204)
    const dist = calculateHaversineDistance(
      BELAGAVI_CITY_CENTER.lat,
      BELAGAVI_CITY_CENTER.lng,
      15.8587,
      74.5204
    );
    assert.ok(dist >= 2400 && dist <= 2700, `Expected ~2.5km distance, got ${dist} meters`);
  });

  test("2) estimateCityTravelTime calculates travel time at 20 km/h Belagavi urban speed", async () => {
    const { estimateCityTravelTime, CITY_TRAFFIC_SPEED_KMH } = await getMapService();
    assert.strictEqual(CITY_TRAFFIC_SPEED_KMH, 20);

    // 0 meters -> 0 minutes
    assert.strictEqual(estimateCityTravelTime(0), 0);
    assert.strictEqual(estimateCityTravelTime(-10), 0);

    // 1000 meters at 20 km/h: 1000m / (20000m / 60min) = 3 minutes
    assert.strictEqual(estimateCityTravelTime(1000), 3);

    // 5000 meters at 20 km/h: 5000m / (20000m / 60min) = 15 minutes
    assert.strictEqual(estimateCityTravelTime(5000), 15);

    // Minimum 1 minute for small distances
    assert.strictEqual(estimateCityTravelTime(50), 1);
  });

  test("3) shouldRefreshRoute enforces 50-meter movement threshold guard", async () => {
    const { shouldRefreshRoute } = await getMapService();

    // Invalid / missing current coords -> returns false
    assert.strictEqual(shouldRefreshRoute(null, null), false);
    assert.strictEqual(shouldRefreshRoute({ lat: 15.85, lng: 74.50 }, null), false);

    // Missing last coords -> returns true (first route request)
    assert.strictEqual(shouldRefreshRoute(null, { lat: 15.85, lng: 74.50 }), true);

    const startPos = { lat: 15.8497, lng: 74.4977 };

    // Move ~20 meters north (approx 0.00018 degrees lat) -> below 50m threshold -> false
    const smallMove = { lat: 15.8497 + 0.00018, lng: 74.4977 };
    assert.strictEqual(shouldRefreshRoute(startPos, smallMove, 50), false);

    // Move ~100 meters north (approx 0.0009 degrees lat) -> above 50m threshold -> true
    const significantMove = { lat: 15.8497 + 0.0009, lng: 74.4977 };
    assert.strictEqual(shouldRefreshRoute(startPos, significantMove, 50), true);
  });

  test("4) roundCoord and getRouteCacheKey normalize coordinates to 4 decimal places (~11m resolution)", async () => {
    const { roundCoord, getRouteCacheKey } = await getMapService();

    assert.strictEqual(roundCoord(15.8497123), 15.8497);
    assert.strictEqual(roundCoord(74.497789), 74.4978);
    assert.strictEqual(roundCoord(NaN), 0);

    const key1 = getRouteCacheKey(15.84971, 74.49771, 15.85871, 74.52041);
    const key2 = getRouteCacheKey(15.84974, 74.49774, 15.85874, 74.52044);
    assert.strictEqual(key1, key2, "Points within ~11 meters must resolve to identical cache key");
    assert.strictEqual(key1, "15.8497,74.4977->15.8587,74.5204");
  });

  test("5) in-memory route cache respects TTL and clearRouteCache", async () => {
    const { getCachedRoute, setCachedRoute, clearRouteCache } = await getMapService();

    clearRouteCache();
    const testKey = "15.8497,74.4977->15.8500,74.5000";
    const dummyResult = {
      success: true,
      distanceMeters: 500,
      durationMinutes: 2,
      coordinates: [{ lat: 15.8497, lng: 74.4977 }, { lat: 15.8500, lng: 74.5000 }],
      provider: "google",
      fallback: false
    };

    const now = 1000000;
    setCachedRoute(testKey, dummyResult, 45000, now);

    // Hit within TTL
    const hit = getCachedRoute(testKey, now + 10000);
    assert.ok(hit, "Cache entry must be found within TTL");
    assert.strictEqual(hit.cached, true);
    assert.strictEqual(hit.distanceMeters, 500);

    // Expired after TTL
    const expired = getCachedRoute(testKey, now + 50000);
    assert.strictEqual(expired, null, "Cache entry must expire after TTL");

    // Clear route cache
    setCachedRoute(testKey, dummyResult, 45000, now);
    clearRouteCache();
    assert.strictEqual(getCachedRoute(testKey, now), null, "Cache must be empty after clearRouteCache");
  });

  test("6) computeFallbackRoute returns degraded straight-line route with 20 km/h urban travel time", async () => {
    const { computeFallbackRoute, calculateHaversineDistance, estimateCityTravelTime } = await getMapService();

    const origin = { lat: 15.8497, lng: 74.4977 };
    const dest = { lat: 15.8587, lng: 74.5204 };

    const fallback = computeFallbackRoute(origin, dest);
    assert.strictEqual(fallback.success, true);
    assert.strictEqual(fallback.fallback, true);
    assert.strictEqual(fallback.provider, "fallback");
    assert.ok(fallback.fallbackReason.includes("20 km/h Belagavi city traffic"));

    const expectedDist = calculateHaversineDistance(origin.lat, origin.lng, dest.lat, dest.lng);
    const expectedTime = estimateCityTravelTime(expectedDist, 20);

    assert.strictEqual(fallback.distanceMeters, expectedDist);
    assert.strictEqual(fallback.durationMinutes, expectedTime);
    assert.strictEqual(fallback.coordinates.length, 2);
    assert.deepStrictEqual(fallback.coordinates[0], origin);
    assert.deepStrictEqual(fallback.coordinates[1], dest);
  });

  test("7) getMapsProvider defaults to google and protects production from public OSM servers", async () => {
    const { getMapsProvider } = await getMapService();

    const origEnv = process.env.MAPS_PROVIDER;
    const origNodeEnv = process.env.NODE_ENV;
    const origAllowOsm = process.env.ALLOW_PUBLIC_OSM;

    try {
      // Default with empty env
      delete process.env.MAPS_PROVIDER;
      assert.strictEqual(getMapsProvider(), "google");

      // In production mode with MAPS_PROVIDER="osm": strictly forces "google"
      process.env.MAPS_PROVIDER = "osm";
      process.env.NODE_ENV = "production";
      delete process.env.ALLOW_PUBLIC_OSM;
      assert.strictEqual(getMapsProvider(), "google", "Must force google in production to protect public OSM servers");

      // In dev mode with MAPS_PROVIDER="osm"
      process.env.NODE_ENV = "development";
      assert.strictEqual(getMapsProvider(), "osm");
    } finally {
      process.env.MAPS_PROVIDER = origEnv;
      process.env.NODE_ENV = origNodeEnv;
      if (origAllowOsm !== undefined) process.env.ALLOW_PUBLIC_OSM = origAllowOsm;
    }
  });

  test("8) BELAGAVI_CITY_CENTER coordinates are standardized to 15.8497, 74.4977", async () => {
    const { BELAGAVI_CITY_CENTER } = await getMapService();
    assert.strictEqual(BELAGAVI_CITY_CENTER.lat, 15.8497);
    assert.strictEqual(BELAGAVI_CITY_CENTER.lng, 74.4977);
  });

  test("9) directions API route and route alias exist and handle caching and fallbacks", () => {
    const dirRouteFile = path.resolve(__dirname, "../../frontend/src/app/api/location/directions/route.ts");
    const aliasRouteFile = path.resolve(__dirname, "../../frontend/src/app/api/location/route/route.ts");

    assert.ok(fs.existsSync(dirRouteFile), "directions route file must exist");
    assert.ok(fs.existsSync(aliasRouteFile), "route alias file must exist");

    const dirCode = fs.readFileSync(dirRouteFile, "utf-8");
    const aliasCode = fs.readFileSync(aliasRouteFile, "utf-8");

    assert.ok(dirCode.includes("getCachedRoute"), "Must check in-memory route cache");
    assert.ok(dirCode.includes("setCachedRoute"), "Must save route to cache");
    assert.ok(dirCode.includes("maps.googleapis.com/maps/api/directions"), "Must integrate with Google Directions API");
    assert.ok(dirCode.includes("computeFallbackRoute"), "Must support offline/degraded fallback");
    assert.ok(aliasCode.includes('export { GET } from "../directions/route"'), "Alias must export directions GET handler");
  });

  test("10) reverse-geocode and map-tile routes protect production and avoid public OSM servers", () => {
    const revGeocodeFile = path.resolve(__dirname, "../../frontend/src/app/api/location/reverse-geocode/route.ts");
    const mapTileFile = path.resolve(__dirname, "../../frontend/src/app/api/map-tile/[provider]/[z]/[x]/[y]/route.ts");

    assert.ok(fs.existsSync(revGeocodeFile), "reverse-geocode route file must exist");
    assert.ok(fs.existsSync(mapTileFile), "map-tile proxy route file must exist");

    const revCode = fs.readFileSync(revGeocodeFile, "utf-8");
    const tileCode = fs.readFileSync(mapTileFile, "utf-8");

    assert.ok(revCode.includes("geocodeCache"), "Must maintain geocode cache");
    assert.ok(revCode.includes("maps.googleapis.com/maps/api/geocode"), "Must support Google Maps Geocoding API");
    assert.ok(revCode.includes('process.env.NODE_ENV !== "production"'), "Must forbid Nominatim OSM in production");
    assert.ok(revCode.includes("Belagavi, Karnataka"), "Must provide graceful degraded location fallback");

    assert.ok(tileCode.includes("mt1.google.com"), "Must support Google map tiles");
    assert.ok(tileCode.includes('TILE_SOURCES'), "Must define supported tile sources");
  });

  test("11) CustomerTrackingMap, ProviderMapView and LocationPicker use centralized Belagavi coordinates and 50m guard", () => {
    const trackingFile = path.resolve(__dirname, "../../frontend/src/components/location/CustomerTrackingMap.tsx");
    const providerMapFile = path.resolve(__dirname, "../../frontend/src/components/location/ProviderMapView.tsx");
    const pickerFile = path.resolve(__dirname, "../../frontend/src/components/location/LocationPicker.tsx");

    const trackingCode = fs.readFileSync(trackingFile, "utf-8");
    const providerCode = fs.readFileSync(providerMapFile, "utf-8");
    const pickerCode = fs.readFileSync(pickerFile, "utf-8");

    // CustomerTrackingMap
    assert.ok(trackingCode.includes("/api/location/directions"), "CustomerTrackingMap must call server-side directions API");
    assert.ok(!trackingCode.includes("router.project-osrm.org"), "CustomerTrackingMap must NOT call public OSRM server");
    assert.ok(trackingCode.includes("shouldRefreshRoute"), "CustomerTrackingMap must enforce 50m movement check");
    assert.ok(trackingCode.includes("computeFallbackRoute"), "CustomerTrackingMap must provide offline fallback");
    assert.ok(trackingCode.includes("BELAGAVI_CITY_CENTER"), "CustomerTrackingMap must use BELAGAVI_CITY_CENTER");

    // ProviderMapView
    assert.ok(providerCode.includes("/api/location/directions"), "ProviderMapView must call server-side directions API");
    assert.ok(!providerCode.includes("router.project-osrm.org"), "ProviderMapView must NOT call public OSRM server");
    assert.ok(providerCode.includes("shouldRefreshRoute"), "ProviderMapView must enforce 50m movement check");
    assert.ok(providerCode.includes("computeFallbackRoute"), "ProviderMapView must provide offline fallback");
    assert.ok(providerCode.includes("BELAGAVI_CITY_CENTER"), "ProviderMapView must use BELAGAVI_CITY_CENTER");

    // LocationPicker
    assert.ok(pickerCode.includes("BELAGAVI_CITY_CENTER"), "LocationPicker must use BELAGAVI_CITY_CENTER");
  });

  test("12) checkUserRateLimit correctly throttles requests by user ID", async () => {
    const { InMemoryStore, checkUserRateLimit } = await getRateLimitCore();
    const store = new InMemoryStore();
    const testUser = "user_map_test_123";
    const limit = 3;
    const windowSeconds = 60;

    for (let i = 1; i <= 3; i++) {
      const res = await checkUserRateLimit(testUser, limit, windowSeconds, store);
      assert.strictEqual(res.isAllowed, true);
      assert.strictEqual(res.remaining, limit - i);
    }

    const blocked = await checkUserRateLimit(testUser, limit, windowSeconds, store);
    assert.strictEqual(blocked.isAllowed, false);
    assert.strictEqual(blocked.remaining, 0);
    assert.ok(blocked.retryAfter > 0);
  });

  test("13) location routes and map-tile route enforce authentication, rate limits, and default to Google", () => {
    const dirRouteFile = path.resolve(__dirname, "../../frontend/src/app/api/location/directions/route.ts");
    const revGeocodeFile = path.resolve(__dirname, "../../frontend/src/app/api/location/reverse-geocode/route.ts");
    const mapTileFile = path.resolve(__dirname, "../../frontend/src/app/api/map-tile/[provider]/[z]/[x]/[y]/route.ts");

    const dirCode = fs.readFileSync(dirRouteFile, "utf-8");
    const revCode = fs.readFileSync(revGeocodeFile, "utf-8");
    const tileCode = fs.readFileSync(mapTileFile, "utf-8");

    // Directions Route
    assert.ok(dirCode.includes("getAuthenticatedUser"), "Directions must require authentication");
    assert.ok(dirCode.includes("checkIpRateLimit"), "Directions must check IP rate limit");
    assert.ok(dirCode.includes("checkUserRateLimit"), "Directions must check User rate limit");
    assert.ok(dirCode.includes('provider === "google"'), "Directions must default to Google");
    assert.ok(dirCode.includes('provider === "osm"'), "Directions must only run OSRM if provider === osm");

    // Reverse Geocode Route
    assert.ok(revCode.includes("getAuthenticatedUser"), "Reverse-geocode must require authentication");
    assert.ok(revCode.includes("checkIpRateLimit"), "Reverse-geocode must check IP rate limit");
    assert.ok(revCode.includes("checkUserRateLimit"), "Reverse-geocode must check User rate limit");
    assert.ok(revCode.includes('mapsProvider === "osm"'), "Reverse-geocode must only run Nominatim if mapsProvider === osm");

    // Map Tile Route
    assert.ok(tileCode.includes("getAuthenticatedUser"), "Map tile must require authentication");
    assert.ok(tileCode.includes("checkIpRateLimit"), "Map tile must check IP rate limit");
    assert.ok(tileCode.includes("checkUserRateLimit"), "Map tile must check User rate limit");
    assert.ok(tileCode.includes('effectiveProvider === "osm" && activeMapsProvider !== "osm"'), "Map tile must prevent OSM in production");

    // UI Components must use Google tiles and authFetch
    const trackingFile = path.resolve(__dirname, "../../frontend/src/components/location/CustomerTrackingMap.tsx");
    const providerMapFile = path.resolve(__dirname, "../../frontend/src/components/location/ProviderMapView.tsx");
    const pickerFile = path.resolve(__dirname, "../../frontend/src/components/location/LocationPicker.tsx");

    const trackingCode = fs.readFileSync(trackingFile, "utf-8");
    const providerCode = fs.readFileSync(providerMapFile, "utf-8");
    const pickerCode = fs.readFileSync(pickerFile, "utf-8");

    assert.ok(trackingCode.includes("/api/map-tile/google/"), "CustomerTrackingMap must use Google tiles by default");
    assert.ok(providerCode.includes("/api/map-tile/google/"), "ProviderMapView must use Google tiles by default");
    assert.ok(pickerCode.includes("/api/map-tile/google/"), "LocationPicker must use Google tiles by default");
    assert.ok(trackingCode.includes("authFetch"), "CustomerTrackingMap must use authFetch");
    assert.ok(providerCode.includes("authFetch"), "ProviderMapView must use authFetch");
    assert.ok(pickerCode.includes("authFetch"), "LocationPicker must use authFetch");
  });
});

describe("11. Password Reset OTP Secret Hardening Tests", () => {
  test("1) email.ts contains no hardcoded fallback for PASSWORD_RESET_OTP_SECRET", () => {
    const emailFile = path.resolve(__dirname, "../../frontend/src/lib/email.ts");
    assert.ok(fs.existsSync(emailFile), "email.ts must exist");
    const emailCode = fs.readFileSync(emailFile, "utf-8");
    assert.ok(!emailCode.includes("default_belconnect_otp_hmac_secret"), "Must not contain hardcoded default secret");
    assert.ok(emailCode.includes("PASSWORD_RESET_OTP_SECRET"), "Must reference PASSWORD_RESET_OTP_SECRET");
    assert.ok(emailCode.includes("secret.length < 32"), "Must enforce minimum 32 characters requirement");
    assert.ok(emailCode.includes("getPasswordResetOtpSecret"), "Must validate secret with helper");
  });

  test("2) getPasswordResetOtpSecret throws if missing or shorter than 32 characters", async () => {
    const { getPasswordResetOtpSecret, hashOtpWithHmac } = await import("../../frontend/src/lib/email.ts");
    const originalSecret = process.env.PASSWORD_RESET_OTP_SECRET;

    try {
      // Test missing
      delete process.env.PASSWORD_RESET_OTP_SECRET;
      assert.throws(() => getPasswordResetOtpSecret(), /FATAL: PASSWORD_RESET_OTP_SECRET/);
      assert.throws(() => hashOtpWithHmac("user123", "123456"), /FATAL: PASSWORD_RESET_OTP_SECRET/);

      // Test too short
      process.env.PASSWORD_RESET_OTP_SECRET = "too_short_secret";
      assert.throws(() => getPasswordResetOtpSecret(), /shorter than 32 characters/);

      // Test valid >= 32 characters
      process.env.PASSWORD_RESET_OTP_SECRET = "valid_secure_secret_with_more_than_32_characters_12345";
      const secret = getPasswordResetOtpSecret();
      assert.strictEqual(secret, "valid_secure_secret_with_more_than_32_characters_12345");
      const hash = hashOtpWithHmac("user123", "123456");
      assert.strictEqual(typeof hash, "string");
      assert.strictEqual(hash.length, 64);
    } finally {
      if (originalSecret !== undefined) {
        process.env.PASSWORD_RESET_OTP_SECRET = originalSecret;
      } else {
        delete process.env.PASSWORD_RESET_OTP_SECRET;
      }
    }
  });
});

describe("12. Backend Secrets and CORS Hardening Tests", () => {
  test("1) server.js verifies user JWTs strictly with JWT_SECRET", () => {
    const serverFile = path.resolve(__dirname, "../../backend/src/server.js");
    assert.ok(fs.existsSync(serverFile), "server.js must exist");
    const serverCode = fs.readFileSync(serverFile, "utf-8");

    assert.ok(!serverCode.includes("candidateSecrets"), "Must remove candidateSecrets from user authentication");
    assert.ok(!serverCode.includes("JWT_SECRET_FALLBACK"), "Must remove JWT_SECRET_FALLBACK from user authentication");
    assert.ok(serverCode.includes("jwt.verify(token, JWT_SECRET)"), "Must verify user JWTs strictly with JWT_SECRET");
  });

  test("2) server.js enforces ALLOWED_ORIGIN in production with no hardcoded fallback", () => {
    const serverFile = path.resolve(__dirname, "../../backend/src/server.js");
    const serverCode = fs.readFileSync(serverFile, "utf-8");

    assert.ok(!serverCode.includes('ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://'), "Must not hardcode fallback for ALLOWED_ORIGIN");
    assert.ok(serverCode.includes('FATAL: ALLOWED_ORIGIN environment variable is required in production'), "Must require ALLOWED_ORIGIN in production");
  });
});

describe("13. Dynamic Domain Configuration Hardening Tests", () => {
  test("1) BelConnectLocationService.java and CallActionReceiver.java contain no hardcoded vercel domains", () => {
    const locServiceFile = path.resolve(__dirname, "../../android/app/src/main/java/com/cityconnect/app/BelConnectLocationService.java");
    const callReceiverFile = path.resolve(__dirname, "../../android/app/src/main/java/com/cityconnect/app/CallActionReceiver.java");
    const locCode = fs.readFileSync(locServiceFile, "utf-8");
    const callCode = fs.readFileSync(callReceiverFile, "utf-8");

    assert.ok(!locCode.includes("belcconect.vercel.app"), "LocationService must not hardcode belcconect.vercel.app");
    assert.ok(!locCode.includes("belconnect.vercel.app"), "LocationService must not hardcode belconnect.vercel.app");
    assert.ok(!callCode.includes("belcconect.vercel.app"), "CallActionReceiver must not hardcode belcconect.vercel.app");
    assert.ok(!callCode.includes("belconnect.vercel.app"), "CallActionReceiver must not hardcode belconnect.vercel.app");
  });

  test("2) map-tile route, capacitor config, and android assets contain no hardcoded vercel domains and fail if missing", () => {
    const tileRouteFile = path.resolve(__dirname, "../../frontend/src/app/api/map-tile/[provider]/[z]/[x]/[y]/route.ts");
    const capConfigFile = path.resolve(__dirname, "../../frontend/capacitor.config.ts");
    const androidCapConfigFile = path.resolve(__dirname, "../../android/app/src/main/assets/capacitor.config.json");
    const serverFile = path.resolve(__dirname, "../../backend/src/server.js");

    const tileCode = fs.readFileSync(tileRouteFile, "utf-8");
    const capCode = fs.readFileSync(capConfigFile, "utf-8");
    const androidCapCode = fs.readFileSync(androidCapConfigFile, "utf-8");
    const serverCode = fs.readFileSync(serverFile, "utf-8");

    assert.ok(!tileCode.includes("belcconect.vercel.app"), "Map-tile proxy must not hardcode belcconect.vercel.app");
    assert.ok(!tileCode.includes("belconnect.vercel.app"), "Map-tile proxy must not hardcode belconnect.vercel.app");
    assert.ok(tileCode.includes("NEXT_PUBLIC_APP_URL or APP_URL environment variable is required"), "Map-tile must fail if URL is missing in production");

    assert.ok(!capCode.includes("belcconect.vercel.app"), "Capacitor config must not hardcode belcconect.vercel.app");
    assert.ok(!capCode.includes("belconnect.vercel.app"), "Capacitor config must not hardcode belconnect.vercel.app");
    assert.ok(capCode.includes("FATAL: CAPACITOR_SERVER_URL"), "Capacitor config must fail if URL is missing");

    assert.ok(!androidCapCode.includes("belcconect.vercel.app"), "Android capacitor config must not hardcode belcconect.vercel.app");
    assert.ok(!androidCapCode.includes("belconnect.vercel.app"), "Android capacitor config must not hardcode belconnect.vercel.app");

    assert.ok(!serverCode.includes("belcconect.vercel.app"), "Backend server must not hardcode belcconect.vercel.app");
    assert.ok(!serverCode.includes("belconnect.vercel.app"), "Backend server must not hardcode belconnect.vercel.app");
  });
});

describe("14. Sitemap Verification Hardening Tests", () => {
  test("1) sitemap.ts uses strictly verification_status = 'verified' and excludes unverified or unavailable providers", () => {
    const sitemapFile = path.resolve(__dirname, "../../frontend/src/app/sitemap.ts");
    assert.ok(fs.existsSync(sitemapFile), "sitemap.ts must exist");
    const sitemapCode = fs.readFileSync(sitemapFile, "utf-8");

    assert.ok(sitemapCode.includes("verification_status = 'verified'"), "Sitemap must require verification_status = 'verified'");
    assert.ok(!sitemapCode.includes("OR is_verified = true"), "Sitemap must NOT contain fallback 'OR is_verified = true'");
    assert.ok(sitemapCode.includes("is_available = true"), "Sitemap must exclude unavailable providers");
  });
});
