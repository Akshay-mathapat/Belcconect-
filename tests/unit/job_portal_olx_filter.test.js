const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

describe("Job Portal OLX-Style Filter & Category Taxonomy Synchronization", () => {
  const rootDir = path.resolve(__dirname, "../../");

  test("1) Marathi locale uses authentic Devanagari script 'मराठी' instead of Kannada script", () => {
    const i18nPath = path.join(rootDir, "frontend/src/lib/i18n.tsx");
    assert.ok(fs.existsSync(i18nPath), "i18n.tsx must exist");
    const content = fs.readFileSync(i18nPath, "utf-8");

    // Must have Devanagari script "मराठी"
    assert.ok(
      content.includes('nativeLabel: "मराठी"') || content.includes("nativeLabel: 'मराठी'"),
      "Must have nativeLabel: 'मराठी'"
    );

    // Must NOT have Kannada script "ಮರಾಠಿ" in LOCALES
    assert.strictEqual(
      content.includes('nativeLabel: "ಮರಾಠಿ"'),
      false,
      "Must not have nativeLabel in Kannada script"
    );
  });

  test("2) /jobs hero section no longer has the horizontal quick categories pills row", () => {
    const jobsPath = path.join(rootDir, "frontend/src/app/jobs/page.tsx");
    assert.ok(fs.existsSync(jobsPath), "jobs/page.tsx must exist");
    const content = fs.readFileSync(jobsPath, "utf-8");

    assert.strictEqual(
      content.includes("Quick Categories Bar"),
      false,
      "Hero section must not contain the Quick Categories Bar"
    );
  });

  test("3) /jobs contains unified OLX-style sidebar filter with categories, locations, types, and modes", () => {
    const jobsPath = path.join(rootDir, "frontend/src/app/jobs/page.tsx");
    const content = fs.readFileSync(jobsPath, "utf-8");

    // Unified renderFilterContent
    assert.ok(content.includes("renderFilterContent"), "Must define renderFilterContent");

    // Categories in sidebar
    assert.ok(content.includes("Categories"), "Sidebar must have Categories filter");
    assert.ok(content.includes("displayedCategories"), "Must support category toggle list");
    assert.ok(content.includes("selectedCategory"), "Must filter by selectedCategory");

    // Locations in sidebar
    assert.ok(content.includes("displayedLocations"), "Sidebar must support location toggle list");
    assert.ok(content.includes("selectedLocation"), "Must filter by selectedLocation");

    // Active filters chips
    assert.ok(content.includes("activeFilterCount"), "Must track active filter count");
    assert.ok(content.includes("Active:"), "Must display active filter pills");

    // Mobile slide-over drawer
    assert.ok(content.includes("isMobileFilterOpen"), "Must support mobile drawer state");
    assert.ok(content.includes("Mobile Filters Slide-Over Drawer"), "Must have mobile filter drawer");
  });

  test("4) Centralized JOB_CATEGORIES constants defines single source of truth for job categories", () => {
    const constantsPath = path.join(rootDir, "frontend/src/constants/jobs.ts");
    assert.ok(fs.existsSync(constantsPath), "jobs.ts constants must exist");
    const content = fs.readFileSync(constantsPath, "utf-8");

    assert.ok(content.includes("JOB_CATEGORIES"), "Must export JOB_CATEGORIES");
    // Verify core categories are present
    assert.ok(content.includes('"Electrical"'), "Must include Electrical");
    assert.ok(content.includes('"Plumbing"'), "Must include Plumbing");
    assert.ok(content.includes('"Cleaning"'), "Must include Cleaning");
    assert.ok(content.includes('"HVAC & AC Repair"'), "Must include HVAC & AC Repair");
    assert.ok(content.includes('"Carpentry"'), "Must include Carpentry");
    assert.ok(content.includes('"Painting"'), "Must include Painting");
    assert.ok(content.includes('"Salon & Beauty"'), "Must include Salon & Beauty");
    assert.ok(content.includes('"Automotive"'), "Must include Automotive");
    assert.ok(content.includes('"Security"'), "Must include Security");
    assert.ok(content.includes('"Delivery & Logistics"'), "Must include Delivery & Logistics");
    assert.ok(content.includes('"IT & Tech"'), "Must include IT & Tech");
    assert.ok(content.includes('"Administration"'), "Must include Administration");
    assert.ok(content.includes('"Retail & Sales"'), "Must include Retail & Sales");
    assert.ok(content.includes('"Other"'), "Must include Other");
  });

  test("5) PostJobPanel imports and uses JOB_CATEGORIES ensuring 100% alignment with job search", () => {
    const postJobPath = path.join(rootDir, "frontend/src/components/jobprovider/post-job/PostJobPanel.tsx");
    assert.ok(fs.existsSync(postJobPath), "PostJobPanel.tsx must exist");
    const content = fs.readFileSync(postJobPath, "utf-8");

    assert.ok(
      content.includes('import { JOB_CATEGORIES } from "@/constants/jobs"'),
      "PostJobPanel must import JOB_CATEGORIES"
    );
    assert.ok(
      content.includes("JOB_CATEGORIES.map"),
      "PostJobPanel must render category options dynamically from JOB_CATEGORIES"
    );
    // Hardcoded mismatch like 'HVAC / AC' replaced with shared constant
    assert.strictEqual(
      content.includes('<option value="HVAC / AC">'),
      false,
      "PostJobPanel must not have hardcoded legacy HVAC / AC option"
    );
  });

  test("6) jobs/page.tsx imports and uses JOB_CATEGORIES ensuring search taxonomy matches post form", () => {
    const jobsPath = path.join(rootDir, "frontend/src/app/jobs/page.tsx");
    const content = fs.readFileSync(jobsPath, "utf-8");

    assert.ok(
      content.includes('import { JOB_CATEGORIES } from "@/constants/jobs"'),
      "jobs/page.tsx must import JOB_CATEGORIES"
    );
    assert.ok(
      content.includes("...JOB_CATEGORIES"),
      "jobs/page.tsx categories array must include JOB_CATEGORIES"
    );
  });

  test("7) GET /api/jobs handles category aliases (HVAC, Delivery/Logistics, Salon, Other)", () => {
    const apiPath = path.join(rootDir, "frontend/src/app/api/jobs/route.ts");
    assert.ok(fs.existsSync(apiPath), "api/jobs/route.ts must exist");
    const content = fs.readFileSync(apiPath, "utf-8");

    assert.ok(content.includes("catLower.includes(\"hvac\")"), "Must match HVAC variations");
    assert.ok(content.includes("catLower.includes(\"delivery\")"), "Must match Delivery / Logistics variations");
    assert.ok(content.includes("catLower.includes(\"salon\")"), "Must match Salon variations");
    assert.ok(content.includes('category === "Other"'), "Must handle Other custom categories");
  });
});
