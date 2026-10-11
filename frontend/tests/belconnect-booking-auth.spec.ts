
import { test, expect, type Page } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

const mockProvider = {
  id: "test-service-001",
  providerId: "test-provider-001",
  providerName: "Playwright Test Plumber",
  name: "Pipe Repair",
  description: "Test plumbing service",
  rating: 4.5,
  reviewsCount: 10,
  bookingsCount: 15,
  exp: 5,
  verificationStatus: "verified",
};

// Intercept only the plumbing service API.
// No database records are inserted or modified.
async function mockPlumbingProvider(page: Page) {
  await page.route("**/api/services?category=plumbing", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([mockProvider]),
    });
  });
}

// Open the plumbing page with mocked service data.
async function openPlumbingPage(page: Page) {
  await mockPlumbingProvider(page);

  await page.goto(`${BASE_URL}/services/plumbing`);

  const bookButton = page
    .locator('[data-tour-book-button="true"]')
    .first();

  await expect(bookButton).toBeVisible({
    timeout: 15000,
  });

  return bookButton;
}

// Ensure each authentication-flow test begins logged out.
test.beforeEach(async ({ page }) => {
  await page.context().clearCookies();
});

// TEST 1: Unauthenticated users must log in.
test("Unauthenticated booking requires login", async ({ page }) => {
  const bookButton = await openPlumbingPage(page);

  await bookButton.click();

  await expect(
    page.getByText("Log In to Book Service")
  ).toBeVisible();

  await expect(
    page.getByRole("button", {
      name: "Log In",
      exact: true,
    })
  ).toBeVisible();

  await expect(
    page.getByRole("button", {
      name: "Create Account",
    })
  ).toBeVisible();

  await page.screenshot({
    path: "belconnect-booking-auth.png",
    fullPage: true,
  });
});

// TEST 2: Login dialog navigates to login.

test("Booking login dialog navigates to login", async ({ page }) => {
  const bookButton = await openPlumbingPage(page);

  await bookButton.click();

  await expect(
    page.getByText("Log In to Book Service")
  ).toBeVisible();

  await page.getByRole("button", {
    name: "Log In",
    exact: true,
  }).click();

  // Confirm navigation to the login route.
  await expect(page).toHaveURL(/\/auth\?/);

  const url = new URL(page.url());

  expect(url.searchParams.get("mode")).toBe("login");
  expect(url.searchParams.get("returnTo")).toBeTruthy();

  // Inspect the actual login screen.
  console.log("Login destination:", page.url());

  console.log(
    "Login headings:",
    await page.locator("h1, h2, h3").allTextContents()
  );

  console.log(
    "Login inputs:",
    await page.locator("input").evaluateAll((elements) =>
      elements.map((el) => ({
        type: el.getAttribute("type"),
        placeholder: el.getAttribute("placeholder"),
      }))
    )
  );

  await page.screenshot({
    path: "belconnect-booking-login.png",
    fullPage: true,
  });

  // Verify that a visible credential field is present.
  await expect(
    page.locator(
      'input[type="email"], input[type="tel"], input[type="password"], input[type="text"]'
    ).filter({ visible: true }).first()
  ).toBeVisible();
});


// TEST 3: Selected booking destination must be preserved.
test("Booking login preserves selected service destination", async ({ page }) => {
  const bookButton = await openPlumbingPage(page);

  await bookButton.click();

  await expect(
    page.getByText("Log In to Book Service")
  ).toBeVisible();

  await page.getByRole("button", {
    name: "Log In",
    exact: true,
  }).click();

  await expect(page).toHaveURL(/\/auth\?/);

  const url = new URL(page.url());

  expect(url.searchParams.get("mode")).toBe("login");

  const returnTo = url.searchParams.get("returnTo");

  expect(returnTo).not.toBeNull();

  // Booking destination must be a relative internal path.
  expect(returnTo!.startsWith("/")).toBe(true);
  expect(returnTo!.startsWith("//")).toBe(false);

  const bookingUrl = new URL(returnTo!, BASE_URL);

  expect(bookingUrl.pathname).toBe("/book");

  // Confirm the original mock provider is preserved.
  expect(bookingUrl.searchParams.get("pro")).toBe(
    mockProvider.providerId
  );

  expect(bookingUrl.searchParams.get("service")).toBe(
    mockProvider.name
  );

  expect(bookingUrl.searchParams.get("proName")).toBe(
    mockProvider.providerName
  );

  console.log("Preserved booking destination:", returnTo);
});

// TEST 4: No providers shows the correct empty state.
test("Plumbing shows empty state when no providers are available", async ({ page }) => {
  await page.route("**/api/services?category=plumbing", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.goto(`${BASE_URL}/services/plumbing`);

  await expect(
    page.getByText(
      "No service provider is available in your area right now."
    )
  ).toBeVisible();

  await expect(
    page.locator('[data-tour-book-button="true"]')
  ).toHaveCount(0);

  await expect(
    page.getByRole("button", { name: "Try Again" })
  ).toBeVisible();
});
