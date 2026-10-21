const { test, describe } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

describe("Compulsory Provider KYC Verification System", () => {
  const rootDir = path.resolve(__dirname, "../../");

  test("1) /api/auth/login query and payload include provider KYC and verification fields", () => {
    const loginRoutePath = path.join(rootDir, "frontend/src/app/api/auth/login/route.ts");
    assert.ok(fs.existsSync(loginRoutePath), "login route must exist");
    const content = fs.readFileSync(loginRoutePath, "utf8");

    // Check UNION query includes verification and kyc columns
    assert.ok(content.includes("is_verified"), "query should select is_verified");
    assert.ok(content.includes("verification_status"), "query should select verification_status");
    assert.ok(content.includes("kyc_status"), "query should select kyc_status");

    // Check userObj payload includes isVerified, verificationStatus, kycStatus
    assert.ok(content.includes("isVerified: isVerifiedProvider"), "payload should populate isVerified");
    assert.ok(content.includes("verificationStatus: providerVerificationStatus"), "payload should populate verificationStatus");
    assert.ok(content.includes("kycStatus: candidate.kyc_status"), "payload should populate kycStatus");
  });

  test("2) /api/auth/register initializes new provider accounts as unverified", () => {
    const registerRoutePath = path.join(rootDir, "frontend/src/app/api/auth/register/route.ts");
    assert.ok(fs.existsSync(registerRoutePath), "register route must exist");
    const content = fs.readFileSync(registerRoutePath, "utf8");

    assert.ok(content.includes('role === "provider"'), "register route must handle provider role");
    assert.ok(content.includes("userObj.isVerified = false"), "new providers must start with isVerified = false");
    assert.ok(content.includes('userObj.verificationStatus = "unverified"'), "new providers must start with verificationStatus = 'unverified'");
    assert.ok(content.includes('userObj.kycStatus = "Unverified"'), "new providers must start with kycStatus = 'Unverified'");
  });

  test("3) Google Auth helper attaches verification and KYC status for provider accounts", () => {
    const googleHelperPath = path.join(rootDir, "frontend/src/lib/googleAuthHelper.ts");
    assert.ok(fs.existsSync(googleHelperPath), "googleAuthHelper must exist");
    const content = fs.readFileSync(googleHelperPath, "utf8");

    assert.ok(content.includes('role === "provider"'), "helper must check provider role");
    assert.ok(content.includes("isVerified: isVerifiedProv"), "helper must populate isVerified");
    assert.ok(content.includes("verificationStatus:"), "helper must populate verificationStatus");
    assert.ok(content.includes("kycStatus:"), "helper must populate kycStatus");
  });

  test("4) /api/provider/availability blocks unverified providers from setting is_available = true", () => {
    const availRoutePath = path.join(rootDir, "frontend/src/app/api/provider/availability/route.ts");
    assert.ok(fs.existsSync(availRoutePath), "availability route must exist");
    const content = fs.readFileSync(availRoutePath, "utf8");

    assert.ok(content.includes("isAvailable && !isVerifiedCurrent"), "route must block availability toggle if unverified");
    assert.ok(content.includes("requiresKyc: true"), "route must return requiresKyc flag");
    assert.ok(content.includes("403"), "route must return 403 Forbidden");
  });

  test("5) useProviderStore gates toggleOnlineStatus and exports fetchProviderKyc", () => {
    const storePath = path.join(rootDir, "frontend/src/store/useProviderStore.ts");
    assert.ok(fs.existsSync(storePath), "useProviderStore must exist");
    const content = fs.readFileSync(storePath, "utf8");

    assert.ok(content.includes("fetchProviderKyc:"), "store must export fetchProviderKyc");
    assert.ok(content.includes("toggleOnlineStatus:"), "store must implement toggleOnlineStatus");
    assert.ok(content.includes("profile.isVerified || profile.verificationStatus === \"verified\""), "store must verify KYC before allowing online toggle");
    assert.ok(content.includes("/provider/kyc"), "store must point unverified providers to /provider/kyc");
  });

  test("6) ProviderClientLayout enforces compulsory KYC route guard and displays warning banner", () => {
    const layoutPath = path.join(rootDir, "frontend/src/app/provider/ProviderClientLayout.tsx");
    assert.ok(fs.existsSync(layoutPath), "ProviderClientLayout must exist");
    const content = fs.readFileSync(layoutPath, "utf8");

    assert.ok(content.includes("fetchProviderKyc"), "layout must call fetchProviderKyc on mount");
    assert.ok(content.includes('router.replace("/provider/kyc")') || content.includes('router.replace("/provider/ekyc")'), "layout must redirect unverified providers to /provider/kyc or /provider/ekyc");
    assert.ok(content.includes("isAllowedRoute"), "layout must check against allowed routes (/provider/kyc, /provider/profile)");
    assert.ok(content.includes("Compulsory KYC") || content.includes("KYC Verification Under Review"), "layout must render KYC warning banner for unverified providers");
  });

  test("7) Auth forms (LoginForm, SignupForm, GoogleButton) redirect unverified providers to /provider/kyc", () => {
    const loginFormPath = path.join(rootDir, "frontend/src/components/auth/LoginForm.tsx");
    const signupFormPath = path.join(rootDir, "frontend/src/components/auth/SignupForm.tsx");
    const googleBtnPath = path.join(rootDir, "frontend/src/components/auth/GoogleButton.tsx");

    const loginContent = fs.readFileSync(loginFormPath, "utf8");
    const signupContent = fs.readFileSync(signupFormPath, "utf8");
    const googleContent = fs.readFileSync(googleBtnPath, "utf8");

    assert.ok(loginContent.includes('router.push("/provider/kyc")'), "LoginForm must redirect unverified providers to /provider/kyc");
    assert.ok(signupContent.includes('router.push("/provider/kyc")'), "SignupForm must redirect newly registered providers to /provider/kyc");
    assert.ok(googleContent.includes('router.push("/provider/kyc")'), "GoogleButton must redirect unverified providers to /provider/kyc");
  });

  test("8) Dedicated KYC page /provider/kyc exists and handles unverified, pending, and verified states", () => {
    const kycPagePath = path.join(rootDir, "frontend/src/app/provider/kyc/page.tsx");
    assert.ok(fs.existsSync(kycPagePath), "dedicated /provider/kyc page must exist");
    const content = fs.readFileSync(kycPagePath, "utf8");

    assert.ok(content.includes("Compulsory KYC Identity Verification"), "page must display compulsory KYC title");
    assert.ok(content.includes("Aadhaar Card"), "page must support Aadhaar Card");
    assert.ok(content.includes("PAN Card"), "page must support PAN Card");
    assert.ok(content.includes("KYC Documents Under Review"), "page must handle pending review state");
    assert.ok(content.includes("Identity Verified"), "page must handle verified state");
    assert.ok(content.includes("handleFileChange"), "page must handle document photo upload");
  });
});

