const { URL } = require("url");

const KNOWN_PRODUCTION_HOST_PATTERNS = [
  "render.com",
  "dpg-db3kesc9v7es73b9gheg-a.singapore-postgres.render.com",
  "singapore-postgres.render.com"
];

/**
 * Strict Safety Guard for Integration Tests
 * Ensures integration tests run ONLY against an isolated test/staging database
 * and NEVER against production.
 */
function validateTestDatabaseUrl() {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl || !testUrl.trim()) {
    return {
      shouldRun: false,
      reason: "TEST_DATABASE_URL is not configured. Real database tests require an isolated staging/test database."
    };
  }

  let parsedTest;
  try {
    parsedTest = new URL(testUrl);
  } catch (err) {
    throw new Error(`[FATAL SAFETY CHECK] TEST_DATABASE_URL is not a valid URL: ${err.message}`);
  }

  // Guard 1: Host matches known production host patterns
  const testHost = parsedTest.hostname.toLowerCase();
  for (const prodHost of KNOWN_PRODUCTION_HOST_PATTERNS) {
    if (testHost === prodHost || testHost.endsWith("." + prodHost) || testHost.includes("render.com")) {
      throw new Error(
        `[FATAL SAFETY CHECK] TEST_DATABASE_URL host "${testHost}" matches known production host pattern "${prodHost}"! Integration tests are strictly prohibited on production hosts.`
      );
    }
  }

  // Guard 2: Host AND database name match DATABASE_URL, or host matches DATABASE_URL host
  const primaryUrl = process.env.DATABASE_URL;
  if (primaryUrl) {
    try {
      const parsedPrimary = new URL(primaryUrl);
      const primaryHost = parsedPrimary.hostname.toLowerCase();
      const primaryDb = parsedPrimary.pathname.toLowerCase();

      if (testHost === primaryHost && parsedTest.pathname.toLowerCase() === primaryDb) {
        throw new Error(
          `[FATAL SAFETY CHECK] TEST_DATABASE_URL points to the exact same host and database as DATABASE_URL (${testHost}${parsedTest.pathname})!`
        );
      }

      if (testHost === primaryHost) {
        throw new Error(
          `[FATAL SAFETY CHECK] TEST_DATABASE_URL host "${testHost}" matches production DATABASE_URL host "${primaryHost}"!`
        );
      }
    } catch (err) {
      if (err.message.includes("[FATAL SAFETY CHECK]")) throw err;
    }
  }

  // Guard 3: Database name MUST explicitly contain 'test' or 'staging'
  const dbName = parsedTest.pathname.replace(/^\//, "").toLowerCase();
  if (!dbName.includes("test") && !dbName.includes("staging")) {
    throw new Error(
      `[FATAL SAFETY CHECK] TEST_DATABASE_URL database name "${dbName}" lacks "test" or "staging"! Test databases must explicitly indicate an isolated test/staging environment.`
    );
  }

  return { shouldRun: true, url: testUrl };
}

module.exports = { validateTestDatabaseUrl, KNOWN_PRODUCTION_HOST_PATTERNS };
