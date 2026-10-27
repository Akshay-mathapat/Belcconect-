const { test, describe } = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const {
  validateInternalSecrets,
  validateAdminTotpKey,
  validateFrontendEnv,
  validateBackendEnv
} = require("../../scripts/env-validator");

describe("Environment & Secrets Validator Unit Tests", () => {
  const secret32A = "a_valid_random_secret_that_is_at_least_32_characters_long_A!";
  const secret32B = "a_valid_random_secret_that_is_at_least_32_characters_long_B!";

  test("1) Only alias set (SIGNALING_INTERNAL_SECRET): succeeds and canonicalizes", () => {
    const res = validateInternalSecrets({ SIGNALING_INTERNAL_SECRET: secret32A }, true);
    assert.strictEqual(res.errors.length, 0, "Must succeed when only alias is set");
    assert.strictEqual(res.canonicalSecret, secret32A);
  });

  test("2) Only canonical set (INTERNAL_API_SECRET): succeeds", () => {
    const res = validateInternalSecrets({ INTERNAL_API_SECRET: secret32A }, true);
    assert.strictEqual(res.errors.length, 0, "Must succeed when only canonical is set");
    assert.strictEqual(res.canonicalSecret, secret32A);
  });

  test("3) Neither set in production: emits required secret error", () => {
    const res = validateInternalSecrets({}, true);
    assert.ok(res.errors.length > 0, "Must fail in production when neither is set");
    assert.ok(res.errors.some(e => e.includes("Missing required secret")), "Must report missing required secret");
  });

  test("4) Both set and matching: succeeds cleanly", () => {
    const res = validateInternalSecrets({
      INTERNAL_API_SECRET: secret32A,
      SIGNALING_INTERNAL_SECRET: secret32A
    }, true);
    assert.strictEqual(res.errors.length, 0, "Must succeed when both are set and match");
    assert.strictEqual(res.canonicalSecret, secret32A);
  });

  test("5) Both set and different: fails with mismatch error", () => {
    const res = validateInternalSecrets({
      INTERNAL_API_SECRET: secret32A,
      SIGNALING_INTERNAL_SECRET: secret32B
    }, true);
    assert.ok(res.errors.length > 0, "Must fail when both are set and differ");
    assert.ok(res.errors.some(e => e.includes("values differ")), "Must detect secret mismatch");
  });

  test("6) AUTH_ENV_VALIDATION=warn: returns valid: true even with configuration errors", () => {
    const brokenEnv = {
      AUTH_ENV_VALIDATION: "warn",
      // missing DATABASE_URL, secrets, etc.
    };
    const res = validateFrontendEnv(brokenEnv, true);
    assert.strictEqual(res.valid, true, "warn-only mode must mark valid: true");
    assert.ok(res.warnings.length > 0, "warn-only mode must retain errors as warnings");
    assert.strictEqual(res.warnOnly, true);
  });

  test("7) ADMIN_TOTP_ENCRYPTION_KEY: validates base64 decoded 32-byte length", () => {
    // 16 bytes base64 (too short)
    const key16 = crypto.randomBytes(16).toString("base64");
    const errs16 = validateAdminTotpKey(key16);
    assert.ok(errs16.length > 0, "16 bytes must fail");
    assert.ok(errs16[0].includes("expected 32"));

    // 64 bytes base64 (too long)
    const key64 = crypto.randomBytes(64).toString("base64");
    const errs64 = validateAdminTotpKey(key64);
    assert.ok(errs64.length > 0, "64 bytes must fail");

    // Exactly 32 bytes base64 (256-bit AES key)
    const key32 = crypto.randomBytes(32).toString("base64");
    const errs32 = validateAdminTotpKey(key32);
    assert.strictEqual(errs32.length, 0, "32 bytes base64 must pass cleanly");
  });

  test("8) CRON_SECRET: enforces minimum 32 characters in validator", () => {
    const envShortCron = {
      DATABASE_URL: "postgres://localhost:5432/test",
      JWT_SECRET: secret32A,
      OAUTH_STATE_SECRET: secret32A,
      INTERNAL_API_SECRET: secret32A,
      CRON_SECRET: "short_cron_key_16_chars!"
    };
    const res = validateFrontendEnv(envShortCron, true);
    assert.ok(res.errors.some(e => e.includes("CRON_SECRET is too short")), "Short CRON_SECRET must be rejected");
  });
});

