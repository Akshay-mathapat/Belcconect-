
import { test, expect } from "@playwright/test";

test("BelConnect mobile registration navigation", async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({
    width: 390,
    height: 844,
  });

  // Open BelConnect homepage
  await page.goto("http://localhost:3000/");

  // Locate a visible registration link
  const registerLink = page.locator(
    'a[href="/register"]:visible'
  ).first();

  // If registration link is hidden, open mobile menu
  if (await registerLink.count() === 0) {
    console.log("Opening mobile navigation menu");

    const menu = page.getByRole("button", {
      name: /menu|open navigation/i,
    });

    await expect(menu).toBeVisible({
      timeout: 10000,
    });

    await menu.click();
  }

  // Verify registration link is visible
  await expect(registerLink).toBeVisible({
    timeout: 10000,
  });

  // Click registration
  await registerLink.click();

  // Wait for navigation to complete
  await expect(page).toHaveURL(
    /\/register(?:\/|\?|$)/,
    { timeout: 15000 }
  );

  console.log("Mobile registration URL:", page.url());

  // Verify registration page heading
  await expect(
    page.getByRole("heading", {
      name: "Create Account",
      exact: true,
    })
  ).toBeVisible();

  // Verify registration submit button
  await expect(
    page.getByRole("button", {
      name: "Create Account",
      exact: true,
    })
  ).toBeVisible();

  // Verify mobile number input
  await expect(
    page.locator('input[type="tel"]')
  ).toBeVisible();

  // Verify password input exists
  await expect(
    page.locator('input[type="password"]').first()
  ).toBeVisible();

  console.log("Mobile registration navigation test passed");
});
