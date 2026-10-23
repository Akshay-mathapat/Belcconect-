const { test, describe } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

describe("Provider Login and Availability (eKYC Decoupled / Not Compulsory)", () => {
  const rootDir = path.resolve(__dirname, "../../");

  test("1) /api/auth/login query and payload include provider fields safely", () => {
    const loginRoutePath = path.join(rootDir, "frontend/src/app/api/auth/login/route.ts");
    assert.ok(fs.existsSync(loginRoutePath), "login route must exist");
    const content = fs.readFileSync(loginRoutePath, "utf8");

    // Check query works with service_providers
    assert.ok(content.includes("service_providers"), "query should select from service_providers");
    assert.ok(content.includes("isVerified:"), "payload should populate isVerified");
  });

  test("2) /api/auth/register handles provider registration", () => {
    const registerRoutePath = path.join(rootDir, "frontend/src/app/api/auth/register/route.ts");
    assert.ok(fs.existsSync(registerRoutePath), "register route must exist");
    const content = fs.readFileSync(registerRoutePath, "utf8");

    assert.ok(content.includes('role === "provider"'), "register route must handle provider role");
  });

  test("3) Google Auth helper handles provider accounts", () => {
    const googleHelperPath = path.join(rootDir, "frontend/src/lib/googleAuthHelper.ts");
    assert.ok(fs.existsSync(googleHelperPath), "googleAuthHelper must exist");
    const content = fs.readFileSync(googleHelperPath, "utf8");

    assert.ok(content.includes('role === "provider"'), "helper must check provider role");
  });

  test("4) /api/provider/availability allows providers to toggle is_available freely without KYC block", () => {
    const availRoutePath = path.join(rootDir, "frontend/src/app/api/provider/availability/route.ts");
    assert.ok(fs.existsSync(availRoutePath), "availability route must exist");
    const content = fs.readFileSync(availRoutePath, "utf8");

    // Confirm compulsory KYC block is removed
    assert.ok(!content.includes("isAvailable && !isVerifiedCurrent"), "route must NOT block availability toggle for unverified providers");
  });

  test("5) useProviderStore exports setAvailability and toggleOnlineStatus without KYC blockage", () => {
    const storePath = path.join(rootDir, "frontend/src/store/useProviderStore.ts");
    assert.ok(fs.existsSync(storePath), "useProviderStore must exist");
    const content = fs.readFileSync(storePath, "utf8");

    assert.ok(content.includes("toggleOnlineStatus:"), "store must implement toggleOnlineStatus");
    assert.ok(!content.includes("available && !isVerified"), "store must not block availability when not verified");
  });

  test("6) ProviderClientLayout allows unrestricted access to provider dashboard", () => {
    const layoutPath = path.join(rootDir, "frontend/src/app/provider/ProviderClientLayout.tsx");
    assert.ok(fs.existsSync(layoutPath), "ProviderClientLayout must exist");
    const content = fs.readFileSync(layoutPath, "utf8");

    // Compulsory redirect to ekyc must be removed
    assert.ok(!content.includes('router.replace("/provider/ekyc")'), "layout must NOT forcefully redirect to /provider/ekyc");
    assert.ok(!content.includes("Compulsory KYC Identity Verification Required"), "layout must NOT show compulsory KYC warning banner");
  });

  test("7) Auth forms (LoginForm, SignupForm, GoogleButton) redirect providers directly to /provider", () => {
    const loginFormPath = path.join(rootDir, "frontend/src/components/auth/LoginForm.tsx");
    const signupFormPath = path.join(rootDir, "frontend/src/components/auth/SignupForm.tsx");
    const googleBtnPath = path.join(rootDir, "frontend/src/components/auth/GoogleButton.tsx");

    const loginContent = fs.readFileSync(loginFormPath, "utf8");
    const signupContent = fs.readFileSync(signupFormPath, "utf8");
    const googleContent = fs.readFileSync(googleBtnPath, "utf8");

    assert.ok(loginContent.includes('router.push(safeReturnTo !== "/" ? safeReturnTo : "/provider")'), "LoginForm must redirect directly to /provider");
    assert.ok(signupContent.includes('router.push(safeReturnTo !== "/" ? safeReturnTo : "/provider")'), "SignupForm must redirect directly to /provider");
    assert.ok(googleContent.includes('router.push(user.isFirstLogin ? "/provider/profile" : "/provider")'), "GoogleButton must redirect directly to /provider");
  });
});
