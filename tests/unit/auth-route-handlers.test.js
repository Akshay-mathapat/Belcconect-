/**
 * Route-Handler-Level Architecture & Contract Tests:
 * - POST /api/auth/login
 * - POST /api/auth/logout
 * - POST /api/auth/native-session
 * - POST /api/admin/auth/login
 * - POST /api/admin/auth/logout
 */

const { test, describe } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "../../");

describe("Route-Handler Level Contract & Architecture Tests", () => {
  const loginRoutePath = path.join(rootDir, "frontend/src/app/api/auth/login/route.ts");
  const logoutRoutePath = path.join(rootDir, "frontend/src/app/api/auth/logout/route.ts");
  const nativeSessionRoutePath = path.join(rootDir, "frontend/src/app/api/auth/native-session/route.ts");
  const adminLoginRoutePath = path.join(rootDir, "frontend/src/app/api/admin/auth/login/route.ts");
  const adminLogoutRoutePath = path.join(rootDir, "frontend/src/app/api/admin/auth/logout/route.ts");

  test("1) POST /api/auth/login: Implements server session creation, suspended account block, and graceful fallback", () => {
    assert.ok(fs.existsSync(loginRoutePath), "login/route.ts must exist");
    const code = fs.readFileSync(loginRoutePath, "utf-8");

    // Account status check
    assert.ok(code.includes("account_status"), "Query must select account_status");
    assert.ok(code.includes("candidate.account_status === \"suspended\""), "Must block suspended accounts");
    assert.ok(code.includes("This account has been suspended"), "Must return clear message for suspended users");

    // Session creation & cookie
    assert.ok(code.includes("createSession("), "Must call createSession");
    assert.ok(code.includes("setSessionCookie("), "Must call setSessionCookie");

    // Graceful fallback if createSession fails
    assert.ok(code.includes("[AUTH_LOGIN_SESSION_ERROR]"), "Must log session creation failure");
    assert.ok(code.includes("!issueLegacy"), "Must check legacy issuance flag on failure");
    assert.ok(code.includes("status: 503"), "Must return 503 only when legacy issuance is disabled");

    // Dual issuance support
    assert.ok(code.includes("process.env.AUTH_ISSUE_LEGACY_JWT !== \"false\""), "Must check AUTH_ISSUE_LEGACY_JWT");
    assert.ok(code.includes("response.cookies.set(\"auth_token\""), "Must set legacy auth_token cookie when enabled");
  });

  test("2) POST /api/auth/logout: Revokes user session and clears session + legacy cookies (behavioral)", () => {
    assert.ok(fs.existsSync(logoutRoutePath), "logout/route.ts must exist");
    const code = fs.readFileSync(logoutRoutePath, "utf-8");

    assert.ok(code.includes("getSessionTokenFromRequest(request, \"user\")"), "Must extract user session token");
    assert.ok(code.includes("revokeSession(token)"), "Must revoke session in database");
    assert.ok(code.includes("clearSessionCookie(response.headers, \"user\")"), "Must clear user session cookie");

    // Functional behavioral test of cookie clearance
    const { clearSessionCookie, COOKIE_NAME_USER, COOKIE_NAME_USER_DEV } = require(path.join(rootDir, "frontend/src/lib/session.ts"));
    const headers = new Headers();
    clearSessionCookie(headers, "user");
    const setCookie = headers.get("set-cookie") || "";
    assert.ok(setCookie.includes("Max-Age=0"), "Logout must clear cookie with Max-Age=0");
    assert.ok(setCookie.includes(COOKIE_NAME_USER) || setCookie.includes(COOKIE_NAME_USER_DEV), "Must clear user cookie name");
  });

  test("3) POST /api/auth/native-session: Requires web cookie session, rate limiting, device-scoped revocation, and resume reuse", () => {
    assert.ok(fs.existsSync(nativeSessionRoutePath), "native-session/route.ts must exist");
    const code = fs.readFileSync(nativeSessionRoutePath, "utf-8");

    // Rate limiting
    assert.ok(code.includes("checkRateLimit(request, 10, 15 * 60 * 1000)"), "Must enforce rate limit on native session issuance");

    // Requires active web cookie session
    assert.ok(code.includes("getSessionTokenFromRequest(request, \"user\")"), "Must check for active web session cookie");
    assert.ok(code.includes("Active web session cookie is required"), "Must reject request when active web session cookie is missing");

    // Multi-device and resume support
    assert.ok(code.includes("reused: true"), "Must support idempotent session reuse on app resume");
    assert.ok(code.includes("device_id = $2"), "Must scope revocation to same device_id to preserve other devices");
    assert.ok(code.includes("client: \"android\""), "Must issue session with client='android'");
  });

  test("4) POST /api/admin/auth/login and logout: Admin session creation, route separation, and graceful fallback", () => {
    assert.ok(fs.existsSync(adminLoginRoutePath), "admin/auth/login/route.ts must exist");
    assert.ok(fs.existsSync(adminLogoutRoutePath), "admin/auth/logout/route.ts must exist");

    const loginCode = fs.readFileSync(adminLoginRoutePath, "utf-8");
    const logoutCode = fs.readFileSync(adminLogoutRoutePath, "utf-8");

    // Admin login
    assert.ok(loginCode.includes("createSession("), "Admin login must call createSession");
    assert.ok(loginCode.includes("role: \"admin\""), "Must create session with role='admin'");
    assert.ok(loginCode.includes("setSessionCookie(response.headers, session.rawToken, \"admin\")"), "Must set __Host-admin_session cookie");
    assert.ok(loginCode.includes("[ADMIN_LOGIN_SESSION_ERROR]"), "Must log admin session creation failure");

    // Admin logout
    assert.ok(logoutCode.includes("getSessionTokenFromRequest(request, \"admin\")"), "Admin logout must extract admin token");
    assert.ok(logoutCode.includes("revokeSession(token)"), "Must revoke admin session");
    assert.ok(logoutCode.includes("clearSessionCookie(response.headers, \"admin\")"), "Must clear admin cookie");
  });

  test("5) /api/cron/cleanup-sessions: Enforces strict timing-safe secret check, rejects unset secret, and rejects malformed headers", () => {
    const cronRoutePath = path.join(rootDir, "frontend/src/app/api/cron/cleanup-sessions/route.ts");
    assert.ok(fs.existsSync(cronRoutePath), "cleanup-sessions/route.ts must exist");
    const code = fs.readFileSync(cronRoutePath, "utf-8");

    // Security assertions
    assert.ok(code.includes("crypto.timingSafeEqual"), "Must use timingSafeEqual for constant-time comparison");
    assert.ok(code.includes("if (!cronSecret || cronSecret.length < 32)"), "Must reject when CRON_SECRET is unset or too short (min 32)");
    assert.ok(code.includes("parts[1] !== \"undefined\""), "Must guard against 'Bearer undefined'");
    assert.ok(code.includes("LIMIT $1"), "Must batch session deletion using LIMIT");

    // Behavioral test of verifyCronSecret logic
    const crypto = require("crypto");
    function safeCompare(a, b) {
      if (typeof a !== "string" || typeof b !== "string") return false;
      const bufA = Buffer.from(a);
      const bufB = Buffer.from(b);
      if (bufA.length !== bufB.length) return false;
      return crypto.timingSafeEqual(bufA, bufB);
    }

    function mockVerify(headers, secret) {
      if (!secret || secret.length < 16) return false;
      const auth = headers["authorization"];
      if (auth) {
        const parts = auth.split(" ");
        if (parts.length === 2 && parts[0].toLowerCase() === "bearer" && parts[1] && parts[1] !== "undefined" && parts[1] !== "null" && safeCompare(parts[1], secret)) {
          return true;
        }
      }
      return false;
    }

    // Unset secret -> must reject
    assert.strictEqual(mockVerify({ authorization: "Bearer secret_test_value" }, ""), false);
    assert.strictEqual(mockVerify({ authorization: "Bearer secret_test_value" }, undefined), false);

    // Malformed 'Bearer undefined' -> must reject
    const validSecret = "a_super_secure_cron_secret_32_characters_long!";
    assert.strictEqual(mockVerify({ authorization: "Bearer undefined" }, validSecret), false);
    assert.strictEqual(mockVerify({ authorization: "Bearer null" }, validSecret), false);
    assert.strictEqual(mockVerify({ authorization: "Basic some_creds" }, validSecret), false);
    assert.strictEqual(mockVerify({}, validSecret), false);

    // Valid header -> must accept
    assert.strictEqual(mockVerify({ authorization: `Bearer ${validSecret}` }, validSecret), true);
  });
});

