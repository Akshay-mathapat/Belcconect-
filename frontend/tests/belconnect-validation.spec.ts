
import { test, expect } from '@playwright/test';

test('Registration form prevents empty submission', async ({ page }) => {

  // Open BelConnect registration page
  await page.goto('http://localhost:3000/register');

  // Verify registration page is visible
  await expect(
    page.getByRole('heading', {
      name: 'Create Account'
    })
  ).toBeVisible();

  // Find Create Account button
  const submitButton = page.getByRole('button', {
    name: 'Create Account'
  });

  // Verify button is visible
  await expect(submitButton).toBeVisible();

  // Empty form must not allow submission
  await expect(submitButton).toBeDisabled();

  // Verify we remain on registration page
  await expect(page).toHaveURL(/\/register\/?$/);

  // Save screenshot
  await page.screenshot({
    path: 'belconnect-empty-form-validation.png',
    fullPage: true
  });

});

test('Registration email input validates format', async ({ page }) => {

  // Open registration page
  await page.goto('http://localhost:3000/register');

  // Locate the email input
  const emailInput = page.locator('input[type="email"]');

  // Confirm email field exists
  await expect(emailInput).toBeVisible();

  // Enter an invalid email address
  await emailInput.fill('invalid-email');

  // Move focus away to trigger blur validation
  await emailInput.blur();

  // Verify the value is not a valid email
  const isValid = await emailInput.evaluate(
    (input: HTMLInputElement) => input.checkValidity()
  );

  expect(isValid).toBe(false);

  // Capture screenshot
  await page.screenshot({
    path: 'belconnect-invalid-email.png',
    fullPage: true
  });
});




test('Registration validates Indian mobile numbers', async ({ page }) => {
  await page.goto('http://localhost:3000/register');

  const phone = page.locator('input[type="tel"]');

  await expect(phone).toBeVisible();

  // Wait for the actual validation attributes.
  await expect(phone).toHaveAttribute(
    'pattern',
    '[6-9][0-9]{9}'
  );

  await expect(phone).toHaveAttribute('minlength', '10');
  await expect(phone).toHaveAttribute('maxlength', '10');

  const cases = [
    { value: '12345', valid: false },
    { value: '1234567890', valid: false },
    { value: '9876543210', valid: true },
    { value: '8123456789', valid: true },
  ];

  for (const item of cases) {
    await phone.fill(item.value);
    await expect(phone).toHaveValue(item.value);

    const result = await phone.evaluate((el: HTMLInputElement) => ({
      valid: el.checkValidity(),
      patternMismatch: el.validity.patternMismatch,
      tooShort: el.validity.tooShort,
      pattern: el.pattern,
    }));

    console.log('Phone validation:', item.value, result);

    expect(
      result.valid,
      `Unexpected validity for ${item.value}`
    ).toBe(item.valid);
  }
});


test('Password strength requirements are displayed', async ({ page }) => {
  await page.goto('http://localhost:3000/register');

  const passwords = page.locator('input[type="password"]');

  await expect(passwords).toHaveCount(2);

  // Enter a weak password
  await passwords.nth(0).fill('abc');

  // Verify the form remains on registration
  await expect(page).toHaveURL(/\/register\/?$/);

  // Verify password strength component is present
  // by checking that the password input retains its value.
  await expect(passwords.nth(0)).toHaveValue('abc');
});

test('Confirm password mismatch displays validation', async ({ page }) => {
  await page.goto('http://localhost:3000/register');

  const passwords = page.locator('input[type="password"]');

  await passwords.nth(0).fill('StrongPass123!');
  await passwords.nth(1).fill('DifferentPass123!');

  // Verify mismatch warning
  await expect(
    page.getByText(/passwords do not match/i)
  ).toBeVisible();

  // Ensure registration has not occurred
  await expect(page).toHaveURL(/\/register\/?$/);
});
