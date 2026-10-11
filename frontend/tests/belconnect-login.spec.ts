
import { test, expect } from '@playwright/test';

test('BelConnect login page UI', async ({ page }) => {

  // Step 1: Open registration page
  await page.goto('http://localhost:3000/register');

  // Step 2: Switch to login form
  const signIn = page.getByRole('button', {
    name: /sign in/i
  });

  await expect(signIn).toBeVisible();
  await signIn.click();

  // Step 3: Verify login identifier field
  // Use the actual placeholder from your diagnostic output
  const identifier = page.getByPlaceholder(
    'aarav.sharma@example.com or +91 98765 43210'
  );

  await expect(identifier).toBeVisible();

  // Step 4: Verify single password input
  const password = page.locator('input[type="password"]');

  await expect(password).toHaveCount(1);
  await expect(password).toBeVisible();

  // Step 5: Verify Remember Me checkbox
  const rememberMe = page.locator('#remember');

  await expect(rememberMe).toBeVisible();

  // Step 6: Verify fields are empty initially
  await expect(identifier).toHaveValue('');
  await expect(password).toHaveValue('');

  // Step 7: Capture screenshot
  await page.screenshot({
    path: 'belconnect-login.png',
    fullPage: true
  });

});


test('BelConnect login password visibility toggle', async ({ page }) => {
  // Open registration page
  await page.goto('http://localhost:3000/register');

  // Identify the Sign In switch inside the registration form.
  // This avoids accidentally selecting a navbar Sign In button.
  const registrationForm = page.locator('form').filter({
    has: page.locator('input[type="tel"]')
  });

  await expect(registrationForm).toBeVisible();

  // Find the Sign In switch immediately after the form
  const signIn = page.getByRole('button', {
    name: /sign in/i
  }).last();

  await expect(signIn).toBeVisible();
  await signIn.click();

  // Confirm the login form actually opened.
  const identifier = page.getByPlaceholder(
    'aarav.sharma@example.com or +91 98765 43210'
  );

  await expect(identifier).toBeVisible();

  // A login form should have one password field.
  const password = page.locator('input[type="password"]');

  await expect(password).toHaveCount(1);
  await expect(password).toBeVisible();

  // Enter a dummy password
  await password.fill('TestPassword123!');

  // Click Show password
  await page.getByRole('button', {
    name: 'Show password'
  }).click();

  // Verify the password is visible.
  // The field changes from type=password to type=text.
  const visiblePassword = page.locator(
    'input[type="text"]'
  ).filter({
    hasNot: page.locator('#navbar-search-input')
  });

  // Use the input containing our test password.
  await expect(
    page.locator('input[value="TestPassword123!"]')
  ).toHaveAttribute('type', 'text');

  // Click Hide password
  await page.getByRole('button', {
    name: 'Hide password'
  }).click();

  // Verify password is hidden again
  await expect(
    page.locator('input[type="password"]')
  ).toHaveValue('TestPassword123!');
});

test('BelConnect Remember Me checkbox', async ({ page }) => {
  await page.goto('http://localhost:3000/register');

  // Switch to login form
  const signIn = page.getByRole('button', {
    name: /sign in/i
  }).last();

  await signIn.click();

  // Verify login form has opened
  await expect(
    page.getByPlaceholder(
      'aarav.sharma@example.com or +91 98765 43210'
    )
  ).toBeVisible();

  // Find Remember Me
  const rememberMe = page.locator('#remember');

  await expect(rememberMe).toBeVisible();

  // Uncheck Remember Me
  await rememberMe.uncheck();
  await expect(rememberMe).not.toBeChecked();

  // Check Remember Me again
  await rememberMe.check();
  await expect(rememberMe).toBeChecked();
});
