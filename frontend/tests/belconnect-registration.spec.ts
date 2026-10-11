
import { test, expect } from '@playwright/test';

test('BelConnect registration page UI', async ({ page }) => {

  // Open BelConnect
  await page.goto('http://localhost:3000/');

  // Wait for homepage content
  await expect(page.locator('body')).toBeVisible();

  // Locate Get Started using visible text
  const getStarted = page.getByText('Get Started', {
    exact: true
  }).first();

  await expect(getStarted).toBeVisible();

  // Open registration
  await getStarted.click();

  // Verify registration page
  await expect(
    page.getByRole('heading', {
      name: 'Create Account'
    })
  ).toBeVisible();

  // Verify roles
  await expect(
    page.getByText('Service Provider', {
      exact: true
    })
  ).toBeVisible();

  await expect(
    page.getByText('Job Provider', {
      exact: true
    })
  ).toBeVisible();

  // Save screenshot
  await page.screenshot({
    path: 'belconnect-registration.png',
    fullPage: true
  });

});


test('BelConnect mobile registration UI', async ({ page }) => {

  // Set mobile screen dimensions
  await page.setViewportSize({
    width: 390,
    height: 844
  });

  // Navigate directly to registration page
  await page.goto('http://localhost:3000/register');

  // Verify registration heading
  await expect(
    page.getByRole('heading', {
      name: 'Create Account'
    })
  ).toBeVisible();

  // Verify registration roles
  await expect(
    page.getByText('Service Provider', {
      exact: true
    })
  ).toBeVisible();

  await expect(
    page.getByText('Job Provider', {
      exact: true
    })
  ).toBeVisible();

  // Check whether page overflows horizontally
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1;
  });

  expect(
    overflow,
    'Mobile registration page has horizontal overflow'
  ).toBe(false);

  // Capture mobile screenshot
  await page.screenshot({
    path: 'belconnect-registration-mobile.png',
    fullPage: true
  });
});
