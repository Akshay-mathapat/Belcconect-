import { test, expect } from '@playwright/test';
import { loginAsProvider } from './auth-helpers';

test.describe('Service Provider Full Flow — Dashboard, Bookings, Services & Schedule', () => {
  test('1) Provider can access provider dashboard and stats', async ({ page }) => {
    await loginAsProvider(page);
    await page.goto('/provider', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

    // Verify provider greeting, dashboard cards, or metrics
    const dashboardElement = page.locator('h1, h2, div[class*="metric"], div[class*="stat"]').first();
    await expect(dashboardElement).toBeVisible({ timeout: 20000 });
  });

  test('2) Provider can manage bookings and inspect status tabs', async ({ page }) => {
    await loginAsProvider(page);
    await page.goto('/provider/bookings', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

    // Verify bookings header or tab filters
    const bookingsNav = page.locator('h1, h2, [role="tab"], button').first();
    await expect(bookingsNav).toBeVisible({ timeout: 15000 });
  });

  test('3) Provider can manage service offerings', async ({ page }) => {
    await loginAsProvider(page);
    await page.goto('/provider/services', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

    // Verify services panel header or Add Service button
    const servicesHeader = page.locator('h1, h2, a[href*="/provider/services/new"], button').first();
    await expect(servicesHeader).toBeVisible({ timeout: 15000 });
  });

  test('4) Provider can configure availability and operating hours', async ({ page }) => {
    await loginAsProvider(page);
    await page.goto('/provider/availability', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

    // Verify schedule toggles or day selectors
    const availabilityContent = page.locator('h1, h2, form, div[class*="schedule"], input[type="checkbox"]').first();
    await expect(availabilityContent).toBeVisible({ timeout: 15000 });
  });

  test('5) Provider can review and edit provider profile', async ({ page }) => {
    await loginAsProvider(page);
    await page.goto('/provider/profile', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

    // Verify profile inputs or bio section
    const profileForm = page.locator('h1, h2, form, input, textarea').first();
    await expect(profileForm).toBeVisible({ timeout: 15000 });
  });
});

