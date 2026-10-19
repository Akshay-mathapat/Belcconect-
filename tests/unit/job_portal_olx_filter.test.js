const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

describe("Job Portal OLX-Style Filter & Marathi Translation Fix", () => {
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
});
