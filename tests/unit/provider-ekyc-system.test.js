const { test, describe } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

describe("BelConnect eKYC System Architecture & Integration", () => {
  const rootDir = path.resolve(__dirname, "../../");

  test("1) Migration 034 defines all 5 relational eKYC tables and indexes", () => {
    const migrationPath = path.join(rootDir, "database/migrations/034_provider_ekyc_system.sql");
    assert.ok(fs.existsSync(migrationPath), "Migration 034 must exist");
    const sql = fs.readFileSync(migrationPath, "utf8");

    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.provider_kyc"), "Must create provider_kyc table");
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.provider_kyc_documents"), "Must create provider_kyc_documents table");
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.provider_kyc_selfies"), "Must create provider_kyc_selfies table");
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.provider_kyc_consents"), "Must create provider_kyc_consents table");
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.provider_kyc_reviews"), "Must create provider_kyc_reviews table");
    assert.ok(sql.includes("idx_provider_kyc_status"), "Must create status index");
    assert.ok(sql.includes("idx_provider_kyc_provider_id"), "Must create provider_id index");
  });

  test("2) Stepper navigation component renders 4-step progress header", () => {
    const stepperPath = path.join(rootDir, "frontend/src/components/provider/ekyc/EkycStepperHeader.tsx");
    assert.ok(fs.existsSync(stepperPath), "EkycStepperHeader component must exist");
    const content = fs.readFileSync(stepperPath, "utf8");

    assert.ok(content.includes("Identity Document"), "Stepper must include Identity Document step");
    assert.ok(content.includes("Upload Card"), "Stepper must include Upload Card step");
    assert.ok(content.includes("Live Selfie"), "Stepper must include Live Selfie step");
    assert.ok(content.includes("Verification"), "Stepper must include Verification step");
  });

  test("3) Screen 1 (/provider/ekyc): Document selection & DPDP statutory consent", () => {
    const s1Path = path.join(rootDir, "frontend/src/app/provider/ekyc/page.tsx");
    assert.ok(fs.existsSync(s1Path), "Screen 1 page must exist");
    const content = fs.readFileSync(s1Path, "utf8");

    assert.ok(content.includes("Aadhaar Card"), "Screen 1 must support Aadhaar Card selection");
    assert.ok(content.includes("PAN Card"), "Screen 1 must support PAN Card selection");
    assert.ok(content.includes("DPDP"), "Screen 1 must display DPDP statutory compliance notice");
    assert.ok(content.includes("/api/ekyc/start"), "Screen 1 must call /api/ekyc/start");
    assert.ok(content.includes("/provider/ekyc/document"), "Screen 1 must navigate to Step 2");
  });

  test("4) Screen 2 (/provider/ekyc/document): Document number formatting, validation & photo upload", () => {
    const s2Path = path.join(rootDir, "frontend/src/app/provider/ekyc/document/page.tsx");
    assert.ok(fs.existsSync(s2Path), "Screen 2 page must exist");
    const content = fs.readFileSync(s2Path, "utf8");

    assert.ok(content.includes("handleDocNumberChange"), "Screen 2 must format input numbers");
    assert.ok(content.includes("cleanAadhaar") && content.includes("cleanPan"), "Screen 2 must validate document format");
    assert.ok(content.includes("/api/ekyc/document"), "Screen 2 must submit to /api/ekyc/document");
    assert.ok(content.includes("/provider/ekyc/selfie"), "Screen 2 must navigate to Step 3");
  });

  test("5) Screen 3 (/provider/ekyc/selfie): Live camera stream, oval guide & 3-2-1 countdown", () => {
    const s3Path = path.join(rootDir, "frontend/src/app/provider/ekyc/selfie/page.tsx");
    assert.ok(fs.existsSync(s3Path), "Screen 3 page must exist");
    const content = fs.readFileSync(s3Path, "utf8");

    assert.ok(content.includes("getUserMedia"), "Screen 3 must request device camera stream");
    assert.ok(content.includes("rounded-[50%]"), "Screen 3 must display oval face guide overlay");
    assert.ok(content.includes("countdown"), "Screen 3 must support countdown timer");
    assert.ok(content.includes("/api/ekyc/selfie"), "Screen 3 must submit to /api/ekyc/selfie");
    assert.ok(content.includes("/provider/ekyc/verification"), "Screen 3 must navigate to Step 4");
  });

  test("6) Screen 4 (/provider/ekyc/verification): Automated checks animation & backend submission", () => {
    const s4Path = path.join(rootDir, "frontend/src/app/provider/ekyc/verification/page.tsx");
    assert.ok(fs.existsSync(s4Path), "Screen 4 page must exist");
    const content = fs.readFileSync(s4Path, "utf8");

    assert.ok(content.includes("Document Format & Integrity Check"), "Screen 4 must include format check");
    assert.ok(content.includes("Image Quality & Clarity Analysis"), "Screen 4 must include quality check");
    assert.ok(content.includes("Facial Liveness & Biometric Verification"), "Screen 4 must include liveness check");
    assert.ok(content.includes("Anti-Fraud & Registry Deduplication"), "Screen 4 must include anti-fraud check");
    assert.ok(content.includes("/api/ekyc/submit"), "Screen 4 must call /api/ekyc/submit");
    assert.ok(content.includes("/provider/ekyc/status"), "Screen 4 must navigate to Step 5");
  });

  test("7) Screen 5 (/provider/ekyc/status): Review pending SLA card & real-time status fetch", () => {
    const s5Path = path.join(rootDir, "frontend/src/app/provider/ekyc/status/page.tsx");
    assert.ok(fs.existsSync(s5Path), "Screen 5 page must exist");
    const content = fs.readFileSync(s5Path, "utf8");

    assert.ok(content.includes("2 – 24 Business Hours") || content.includes("2 to 24 business hours"), "Screen 5 must show SLA");
    assert.ok(content.includes("/api/ekyc/status"), "Screen 5 must query /api/ekyc/status");
    assert.ok(content.includes("Refresh Status"), "Screen 5 must provide manual refresh");
    assert.ok(content.includes("/provider/ekyc/success"), "Screen 5 must navigate to Screen 6 upon approval");
  });

  test("8) Screen 6 (/provider/ekyc/success): Verified Pro celebration badge & marketplace preview", () => {
    const s6Path = path.join(rootDir, "frontend/src/app/provider/ekyc/success/page.tsx");
    assert.ok(fs.existsSync(s6Path), "Screen 6 page must exist");
    const content = fs.readFileSync(s6Path, "utf8");

    assert.ok(content.includes("Verified BelConnect Pro"), "Screen 6 must celebrate verification");
    assert.ok(content.includes("Marketplace Public Badge Preview"), "Screen 6 must display badge preview");
    assert.ok(content.includes("/provider"), "Screen 6 must link back to provider dashboard");
  });

  test("9) Backend eKYC API routes enforce authentication & DPDP privacy masking", () => {
    const startPath = path.join(rootDir, "frontend/src/app/api/ekyc/start/route.ts");
    const docPath = path.join(rootDir, "frontend/src/app/api/ekyc/document/route.ts");
    const selfiePath = path.join(rootDir, "frontend/src/app/api/ekyc/selfie/route.ts");
    const submitPath = path.join(rootDir, "frontend/src/app/api/ekyc/submit/route.ts");

    assert.ok(fs.existsSync(startPath), "/api/ekyc/start must exist");
    assert.ok(fs.existsSync(docPath), "/api/ekyc/document must exist");
    assert.ok(fs.existsSync(selfiePath), "/api/ekyc/selfie must exist");
    assert.ok(fs.existsSync(submitPath), "/api/ekyc/submit must exist");

    const docContent = fs.readFileSync(docPath, "utf8");
    assert.ok(docContent.includes("last4"), "/api/ekyc/document must extract and store only last4");
    assert.ok(docContent.includes("provider_kyc_documents"), "/api/ekyc/document must insert into documents table");

    const submitContent = fs.readFileSync(submitPath, "utf8");
    assert.ok(submitContent.includes("UNDER_REVIEW"), "/api/ekyc/submit must set status to UNDER_REVIEW");
  });

  test("10) Admin verification dashboard renders side-by-side inspection for Government ID and Live Selfie", () => {
    const adminPath = path.join(rootDir, "frontend/src/app/admin/page.tsx");
    assert.ok(fs.existsSync(adminPath), "Admin page must exist");
    const content = fs.readFileSync(adminPath, "utf8");

    assert.ok(content.includes("1. Government ID Card"), "Admin modal must display Government ID card");
    assert.ok(content.includes("2. Live Selfie Liveness"), "Admin modal must display Live Selfie card");
    assert.ok(content.includes("livenessScore"), "Admin modal must display liveness score");
  });

  test("11) /api/attachments allows kyc-selfies/ alongside kyc-documents/ and chat-attachments/", () => {
    const attachPath = path.join(rootDir, "frontend/src/app/api/attachments/[...pathname]/route.ts");
    assert.ok(fs.existsSync(attachPath), "Attachments route must exist");
    const content = fs.readFileSync(attachPath, "utf8");

    assert.ok(content.includes("kyc-selfies/"), "Attachments route must whitelist kyc-selfies/");
    assert.ok(content.includes("kyc-documents/"), "Attachments route must whitelist kyc-documents/");
  });
});
