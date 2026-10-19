const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

describe("Batch R3 Task 3: Provider Registration Redirection and Real Signup Pre-selection", () => {
  const rootDir = path.resolve(__dirname, "../../");

  test("1) /register/provider contains no fake OTP simulation and redirects to real signup", () => {
    const filePath = path.join(rootDir, "frontend/src/app/register/provider/page.tsx");
    assert.ok(fs.existsSync(filePath), "register/provider/page.tsx must exist as a redirector");
    const content = fs.readFileSync(filePath, "utf-8");

    // Fake OTP logic must be completely eliminated
    assert.strictEqual(content.includes("handleSendOTP"), false, "Must not contain fake OTP handleSendOTP");
    assert.strictEqual(content.includes("handleVerifyOTP"), false, "Must not contain fake OTP handleVerifyOTP");
    assert.strictEqual(content.includes("setTimeout"), false, "Must not contain fake timer simulation");

    // Redirects to real signup with provider role pre-selected
    assert.ok(
      content.includes('redirect("/auth?mode=signup&role=provider")') ||
      content.includes("redirect('/auth?mode=signup&role=provider')"),
      "Must redirect to /auth?mode=signup&role=provider"
    );
  });

  test("2) next.config.ts defines a permanent redirect for /register/provider", () => {
    const configPath = path.join(rootDir, "frontend/next.config.ts");
    assert.ok(fs.existsSync(configPath), "next.config.ts must exist");
    const configContent = fs.readFileSync(configPath, "utf-8");

    assert.ok(configContent.includes("redirects()"), "Must declare redirects in next.config.ts");
    assert.ok(configContent.includes('source: "/register/provider"'), "Must define /register/provider source redirect");
    assert.ok(configContent.includes('destination: "/auth?mode=signup&role=provider"'), "Must direct to /auth?mode=signup&role=provider");
  });

  test("3) Footer 'Register as a Pro' links directly to real signup with provider role selected", () => {
    const footerPath = path.join(rootDir, "frontend/src/components/sections/Footer.tsx");
    assert.ok(fs.existsSync(footerPath), "Footer.tsx must exist");
    const footerContent = fs.readFileSync(footerPath, "utf-8");

    assert.ok(
      footerContent.includes('href: "/auth?mode=signup&role=provider"'),
      "Footer 'Register as a Pro' must point to /auth?mode=signup&role=provider"
    );
    assert.strictEqual(
      footerContent.includes('href: "/register/provider"'),
      false,
      "Footer must no longer link to legacy /register/provider"
    );
  });

  test("4) site constants NAV_LINKS Join as Provider links to real signup", () => {
    const sitePath = path.join(rootDir, "frontend/src/constants/site.ts");
    assert.ok(fs.existsSync(sitePath), "site.ts must exist");
    const siteContent = fs.readFileSync(sitePath, "utf-8");

    assert.ok(
      siteContent.includes('href: "/auth?mode=signup&role=provider"'),
      "NAV_LINKS must point Join as Provider to /auth?mode=signup&role=provider"
    );
    assert.strictEqual(
      siteContent.includes('href: "/register/provider"'),
      false,
      "NAV_LINKS must no longer link to legacy /register/provider"
    );
  });

  test("5) SignupForm initializes and synchronizes role from searchParams (role or accountType)", () => {
    const signupPath = path.join(rootDir, "frontend/src/components/auth/SignupForm.tsx");
    assert.ok(fs.existsSync(signupPath), "SignupForm.tsx must exist");
    const signupContent = fs.readFileSync(signupPath, "utf-8");

    assert.ok(
      signupContent.includes("searchParams?.get(\"role\")") || signupContent.includes("searchParams.get(\"role\")"),
      "SignupForm must inspect role from URL search params"
    );
    assert.ok(
      signupContent.includes("provider") && signupContent.includes("setSignupRole"),
      "SignupForm must set signupRole based on query params"
    );
  });
});

