
import { test, expect } from '@playwright/test';

test.describe('BelConnect dashboard authentication guards', () => {

  const protectedRoutes = [
    '/provider',
    '/jobprovider'
  ];

  for (const route of protectedRoutes) {

    test(`Unauthenticated ${route} redirects to login`, async ({ page }) => {

      // Fresh Playwright context without stored login
      await page.goto(`http://localhost:3000${route}`);

      // Wait for redirect instead of using fixed timeouts
      await expect(page).toHaveURL(
        /\/login(?:\/|\?|$)/,
        { timeout: 15000 }
      );

      // Confirm the login page appears
      await expect(
        page.getByRole('heading', {
          name: 'Welcome Back'
        })
      ).toBeVisible();

      // Confirm login input exists
      await expect(
        page.getByPlaceholder(
          'aarav.sharma@example.com or +91 98765 43210'
        )
      ).toBeVisible();

    });
  }

});
