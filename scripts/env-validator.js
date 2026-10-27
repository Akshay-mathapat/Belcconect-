/**
 * BelConnect Shared Environment & Secrets Validator
 * Single Source of Truth for Configuration Validation
 * 
 * Enforces OWASP / production guidelines:
 * - Secrets must be at least 32 characters long
 * - No trivial or default placeholder values
 * - Computes truncated 8-character SHA-256 fingerprints for safe cross-service comparison
 * - Supports AUTH_ENV_VALIDATION=warn mode for non-blocking pre-deployment diagnostics
 */

const crypto = require("crypto");

const PLACEHOLDER_PATTERNS = [
  "changeme",
  "secret",
  "password",
  "placeholder",
  "your_secret_here",
  "your-secret-here",
  "default_secret",
  "example",
  "123456"
];

/**
 * Computes safe truncated 8-character hex SHA-256 fingerprint.
 * Never leaks the actual secret value.
 */
function getSecretFingerprint(value, length = 8) {
  if (!value || typeof value !== "string" || !value.trim()) return "--------";
  return crypto.createHash("sha256").update(value.trim()).digest("hex").slice(0, length);
}

/**
 * Validates a single secret string.
 */
function validateSecret(name, value, isProduction = false, minLength = 32) {
  const errors = [];
  if (!value || typeof value !== "string" || !value.trim()) {
    errors.push(`Missing required secret: ${name}`);
    return errors;
  }

  const clean = value.trim();
  if (clean.length < minLength) {
    errors.push(`Secret ${name} is too short (${clean.length} chars). Minimum length is ${minLength} characters.`);
  }

  const lower = clean.toLowerCase();
  for (const placeholder of PLACEHOLDER_PATTERNS) {
    if (lower === placeholder || lower.includes(`your_${name.toLowerCase()}`)) {
      errors.push(`Secret ${name} contains an insecure default placeholder pattern.`);
      break;
    }
  }

  return errors;
}

/**
 * Validates canonical vs alias internal secrets.
 * Rule: Either INTERNAL_API_SECRET or SIGNALING_INTERNAL_SECRET must be set (>= 32 chars).
 * If both are set, their normalized values must match exactly.
 */
function validateInternalSecrets(env, isProduction = false) {
  const errors = [];
  const canonical = env.INTERNAL_API_SECRET ? env.INTERNAL_API_SECRET.trim() : "";
  const alias = env.SIGNALING_INTERNAL_SECRET ? env.SIGNALING_INTERNAL_SECRET.trim() : "";

  if (!canonical && !alias) {
    if (isProduction) {
      errors.push("Missing required secret: INTERNAL_API_SECRET (or alias SIGNALING_INTERNAL_SECRET) must be set.");
    }
    return { errors, canonicalSecret: null };
  }

  if (canonical && alias && canonical !== alias) {
    errors.push("Secret mismatch: Both INTERNAL_API_SECRET and SIGNALING_INTERNAL_SECRET are set, but their values differ.");
  }

  const active = canonical || alias;
  if (active) {
    const secretErrors = validateSecret(canonical ? "INTERNAL_API_SECRET" : "SIGNALING_INTERNAL_SECRET", active, isProduction, 32);
    errors.push(...secretErrors);
  }

  return { errors, canonicalSecret: active };
}

/**
 * Validates ADMIN_TOTP_ENCRYPTION_KEY if provided:
 * Must be valid base64 decoding to exactly 32 bytes (256-bit AES key).
 */
function validateAdminTotpKey(key) {
  const errors = [];
  if (!key || typeof key !== "string") return errors;

  const trimmed = key.trim();
  try {
    const buf = Buffer.from(trimmed, "base64");
    if (buf.length !== 32) {
      errors.push(`ADMIN_TOTP_ENCRYPTION_KEY must be a base64 string decoding to exactly 32 bytes (decoded ${buf.length} bytes, expected 32).`);
    }
  } catch (err) {
    errors.push("ADMIN_TOTP_ENCRYPTION_KEY is not a valid base64-encoded string.");
  }
  return errors;
}

/**
 * Validates environment variables for Frontend (Next.js serverless)
 */
function validateFrontendEnv(env = process.env, isProduction = false) {
  const rawErrors = [];
  const fingerprints = {};
  const isWarnOnly = env.AUTH_ENV_VALIDATION === "warn";

  // 1. DATABASE_URL
  if (!env.DATABASE_URL && !env.POSTGRES_URL) {
    rawErrors.push("Missing required environment variable: DATABASE_URL (or POSTGRES_URL).");
  }

  // 2. Cryptographic Secrets
  const standardSecrets = [
    { key: "JWT_SECRET", val: env.JWT_SECRET, req: true, min: 32 },
    { key: "OAUTH_STATE_SECRET", val: env.OAUTH_STATE_SECRET, req: true, min: 32 },
    { key: "CRON_SECRET", val: env.CRON_SECRET, req: true, min: 32 }
  ];

  if (env.DOWNLOAD_URL_SECRET) {
    standardSecrets.push({ key: "DOWNLOAD_URL_SECRET", val: env.DOWNLOAD_URL_SECRET, req: false, min: 32 });
  }

  for (const item of standardSecrets) {
    if (isProduction || item.val) {
      const errs = validateSecret(item.key, item.val, isProduction && item.req, item.min);
      rawErrors.push(...errs);
    }
    fingerprints[item.key] = getSecretFingerprint(item.val);
  }

  // 3. Internal Secrets (Canonical + Alias)
  const internalCheck = validateInternalSecrets(env, isProduction);
  rawErrors.push(...internalCheck.errors);
  fingerprints["INTERNAL_API_SECRET"] = getSecretFingerprint(internalCheck.canonicalSecret);

  // 4. Admin TOTP Encryption Key
  if (env.ADMIN_TOTP_ENCRYPTION_KEY) {
    const totpErrors = validateAdminTotpKey(env.ADMIN_TOTP_ENCRYPTION_KEY);
    rawErrors.push(...totpErrors);
    fingerprints["ADMIN_TOTP_ENCRYPTION_KEY"] = getSecretFingerprint(env.ADMIN_TOTP_ENCRYPTION_KEY);
  }

  // 5. Flags validation
  if (env.AUTH_ACCEPT_LEGACY_JWT && !["true", "false"].includes(env.AUTH_ACCEPT_LEGACY_JWT)) {
    rawErrors.push("AUTH_ACCEPT_LEGACY_JWT must be either 'true' or 'false'");
  }
  if (env.AUTH_ISSUE_LEGACY_JWT && !["true", "false"].includes(env.AUTH_ISSUE_LEGACY_JWT)) {
    rawErrors.push("AUTH_ISSUE_LEGACY_JWT must be either 'true' or 'false'");
  }

  return {
    valid: isWarnOnly ? true : rawErrors.length === 0,
    errors: rawErrors,
    warnings: isWarnOnly ? rawErrors : [],
    warnOnly: isWarnOnly,
    fingerprints
  };
}

/**
 * Validates environment variables for Backend (Signaling Server)
 */
function validateBackendEnv(env = process.env, isProduction = false) {
  const rawErrors = [];
  const fingerprints = {};
  const isWarnOnly = env.AUTH_ENV_VALIDATION === "warn";

  if (!env.DATABASE_URL) {
    rawErrors.push("Missing required environment variable: DATABASE_URL.");
  }

  if (isProduction && (!env.ALLOWED_ORIGIN || !env.ALLOWED_ORIGIN.trim())) {
    rawErrors.push("Missing required environment variable: ALLOWED_ORIGIN (must include production origins).");
  }

  // JWT_SECRET
  if (isProduction || env.JWT_SECRET) {
    const jwtErrs = validateSecret("JWT_SECRET", env.JWT_SECRET, isProduction, 32);
    rawErrors.push(...jwtErrs);
  }
  fingerprints["JWT_SECRET"] = getSecretFingerprint(env.JWT_SECRET);

  // Internal secrets
  const internalCheck = validateInternalSecrets(env, isProduction);
  rawErrors.push(...internalCheck.errors);
  fingerprints["INTERNAL_API_SECRET"] = getSecretFingerprint(internalCheck.canonicalSecret);

  return {
    valid: isWarnOnly ? true : rawErrors.length === 0,
    errors: rawErrors,
    warnings: isWarnOnly ? rawErrors : [],
    warnOnly: isWarnOnly,
    fingerprints
  };
}

module.exports = {
  getSecretFingerprint,
  validateSecret,
  validateInternalSecrets,
  validateAdminTotpKey,
  validateFrontendEnv,
  validateBackendEnv
};
