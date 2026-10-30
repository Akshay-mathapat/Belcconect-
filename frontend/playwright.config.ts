import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60 * 1000,
  expect: {
    timeout: 15 * 1000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000",
    navigationTimeout: 60 * 1000,
    actionTimeout: 15 * 1000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      NODE_ENV: "test",
      BELCONNECT_TEST_MODE: "1",
      TEST_DATABASE_URL: "postgresql://postgres:testpass@localhost:5433/belconnect_test",
      AUTH_ISSUE_LEGACY_JWT: "false",
      AUTH_ACCEPT_LEGACY_JWT: "true",
      CSRF_ENFORCE: "1",
      CSRF_ALLOWED_ORIGINS: "http://localhost:3000",
      COOKIE_SECRET: "test-cookie-secret-32-chars-minimum-abcdef123456",
      JWT_SECRET: "test-jwt-secret-minimum-32-characters-long-12345",
      SITE_URL: "http://localhost:3000",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    },
  },
});
