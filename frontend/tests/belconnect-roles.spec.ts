
import { test, expect } from '@playwright/test';

test('BelConnect registration role switching', async ({ page }) => {
  await page.goto('http://localhost:3000/register');

  const roles = [
    'User',
    'Service Provider',
    'Job Provider'
  ];

  for (const role of roles) {
    const roleButton = page.getByRole('button', {
      name: role,
      exact: true
    });

    await expect(roleButton).toBeVisible();
    await roleButton.click();

    // Registration form should stay visible
    await expect(
      page.getByRole('heading', {
        name: 'Create Account'
      })
    ).toBeVisible();

    await expect(
      page.locator('input[type="tel"]')
    ).toBeVisible();

    await expect(
      page.locator('input[type="email"]')
    ).toBeVisible();
  }

  // Verify no account creation was submitted
  await expect(page).toHaveURL(/\/register\/?$/);
});
