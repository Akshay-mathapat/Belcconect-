
import { test, expect } from '@playwright/test';

test('Customer Account requires authentication', async ({ page }) => {

  // Navigate without logging in
  await page.goto('http://localhost:3000/account');

  // Verify redirect to login, preserving returnTo
  await expect(page).toHaveURL(
    /\/auth\?mode=login&returnTo=(%2F|\/)account/,
    { timeout: 15000 }
  );

  // Verify login screen is displayed
  await expect(
    page.getByRole('heading', {
      name: 'Welcome Back'
    })
  ).toBeVisible();

  // Verify identifier input exists
  await expect(
    page.getByPlaceholder(
      'aarav.sharma@example.com or +91 98765 43210'
    )
  ).toBeVisible();

});
