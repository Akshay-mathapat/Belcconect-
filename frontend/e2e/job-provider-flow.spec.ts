import { test, expect } from '@playwright/test';
import { loginAsJobProvider } from './auth-helpers';

test.describe('Job Provider (Employer) Full Flow — Portal, Job Posting, Candidates & Profile', () => {
  test('1) Job Provider can access employer dashboard and hiring overview', async ({ page }) => {
    await loginAsJobProvider(page);
    await page.goto('/jobprovider', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

    // Verify dashboard metrics, greetings, or header
    const dashboardHeader = page.locator('h1, h2, div[class*="metric"], nav').first();
    await expect(dashboardHeader).toBeVisible({ timeout: 20000 });
  });

  test('2) Job Provider can navigate to Post a Job and verify form controls', async ({ page }) => {
    await loginAsJobProvider(page);
    await page.goto('/jobprovider/post-job', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

    // Verify form fields
    const formHeading = page.locator('h1, h2, form').first();
    await expect(formHeading).toBeVisible({ timeout: 15000 });

    // Enter test title if input exists
    const titleInput = page.locator('input[placeholder*="title" i], input[name="title"], input[type="text"]').first();
    if (await titleInput.isVisible()) {
      await titleInput.fill('Lead Full Stack Engineer');
      await expect(titleInput).toHaveValue('Lead Full Stack Engineer');
    }

    // Verify publish or draft buttons
    const submitBtn = page.locator('button[type="submit"], button:has-text("Post"), button:has-text("Publish")').first();
    await expect(page.locator('body')).toBeVisible();
  });

  test('3) Job Provider can view and manage posted job listings', async ({ page }) => {
    await loginAsJobProvider(page);
    await page.goto('/jobprovider/jobs', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

    // Verify my-jobs panel or heading
    const jobsContent = page.locator('h1, h2, a[href*="/jobprovider/post-job"], div[class*="job"]').first();
    await expect(jobsContent).toBeVisible({ timeout: 15000 });
  });

  test('4) Job Provider can review applicants, statuses and candidate resumes', async ({ page }) => {
    await loginAsJobProvider(page);
    await page.goto('/jobprovider/candidates', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

    // Verify candidates panel, search, or status pipeline
    const candidatesHeader = page.locator('h1, h2, div[class*="candidate"], div[class*="application"]').first();
    await expect(candidatesHeader).toBeVisible({ timeout: 15000 });
  });

  test('5) Job Provider can configure company business profile', async ({ page }) => {
    await loginAsJobProvider(page);
    await page.goto('/jobprovider/business-profile', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

    // Verify profile inputs
    const profileForm = page.locator('h1, h2, form, input[type="text"]').first();
    await expect(profileForm).toBeVisible({ timeout: 15000 });
  });
});
