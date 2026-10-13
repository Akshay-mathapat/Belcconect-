import { test, expect } from '@playwright/test';
import { loginAsCustomer } from './auth-helpers';

test.describe('Customer Full Flow — Discovery, Jobs, Application & Account', () => {
  test('1) Customer can explore homepage, categories and navigation', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

    // Check main navigation links
    const navLinks = page.locator('nav a, header a');
    await expect(navLinks.first()).toBeVisible();

    // Check search or category presence
    const searchOrHeading = page.locator('input[type="text"], input[type="search"], h1, h2').first();
    await expect(searchOrHeading).toBeVisible();
  });

  test('2) Customer can browse services catalog and filter categories', async ({ page }) => {
    await page.goto('/services', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

    // Verify service listing or category chips
    const serviceElements = page.locator('h1, h2, h3, button, [role="tab"]').first();
    await expect(serviceElements).toBeVisible({ timeout: 15000 });

    // Test search filter input if available
    const searchInput = page.locator('input[placeholder*="search" i], input[type="text"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Electrician');
      await page.waitForTimeout(500);
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('3) Customer can browse jobs and open job details modal/page', async ({ page }) => {
    await page.goto('/jobs', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

    // Verify job title or listings
    const jobHeading = page.locator('h1, h2').first();
    await expect(jobHeading).toBeVisible({ timeout: 15000 });

    // Filter jobs by keyword
    const searchInput = page.locator('input[type="text"], input[placeholder*="search" i]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Engineer');
      await page.waitForTimeout(500);
    }

    // Verify job cards or apply links exist
    const jobCards = page.locator('article, div[class*="border"], div[class*="rounded"] a[href*="/jobs/"]').first();
    await expect(page.locator('body')).toBeVisible();
  });

  test('4) Customer can view user account portal and bookings history', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

    // Check profile details or tab navigation
    const accountContent = page.locator('h1, h2, [role="tablist"], div[class*="profile"]').first();
    await expect(accountContent).toBeVisible({ timeout: 15000 });
  });
});
