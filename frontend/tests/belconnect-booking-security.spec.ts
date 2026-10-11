
import { test, expect } from '@playwright/test';

test('Inspect booking page without login', async ({ page }) => {
  // Use a fresh unauthenticated Playwright browser
  await page.goto(
    'http://localhost:3000/book?pro=test-provider&service=Plumbing'
  );

  await expect(page.locator('body')).toBeVisible();

  // Allow client-side authentication state to initialize
  await page.waitForTimeout(3000);

  console.log('Final URL:', page.url());

  console.log(
    'Headings:',
    await page.locator('h1, h2').allTextContents()
  );

  // Capture the page
  await page.screenshot({
    path: 'belconnect-booking-security.png',
    fullPage: true
  });

  // Check for any visible authentication or booking state
  const body = await page.locator('body').innerText();

  console.log('Page preview:', body.slice(0, 600));
});

test('Inspect unauthenticated booking Continue action', async ({ page }) => {
  await page.goto(
    'http://localhost:3000/book?pro=test-provider&service=Plumbing'
  );

  await expect(
    page.getByRole('heading', { name: 'Service Details' })
  ).toBeVisible();

  const continueButton = page.getByRole('button', {
    name: 'Continue',
    exact: true
  });

  await expect(continueButton).toBeVisible();

  // Record whether the button is enabled
  const enabled = await continueButton.isEnabled();

  console.log('Continue enabled:', enabled);

  // Only click if it is enabled
  if (enabled) {
    await continueButton.click();
  }

  console.log('URL after Continue:', page.url());

  console.log(
    'Headings after Continue:',
    await page.locator('h1, h2').allTextContents()
  );

  console.log(
    'Page preview:',
    (await page.locator('body').innerText()).slice(0, 800)
  );

  await page.screenshot({
    path: 'belconnect-booking-continue-diagnostic.png',
    fullPage: true
  });
});

test('Inspect booking address step validation', async ({ page }) => {
  await page.goto(
    'http://localhost:3000/book?pro=test-provider&service=Plumbing'
  );

  // Step 1: Service Details
  await expect(
    page.getByRole('heading', { name: 'Service Details' })
  ).toBeVisible();

  await page.getByRole('button', {
    name: 'Continue',
    exact: true
  }).click();

  // Step 2: Service Address
  await expect(
    page.getByRole('heading', { name: 'Service Address' })
  ).toBeVisible();

  // Inspect whether Continue is enabled before entering an address
  const continueButton = page.getByRole('button', {
    name: 'Continue',
    exact: true
  });

  const enabled = await continueButton.isEnabled();

  console.log('Address Continue enabled:', enabled);

  // Inspect visible address input controls
  const controls = await page.locator(
    'input, textarea, button'
  ).evaluateAll(elements =>
    elements
      .filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map(el => ({
        tag: el.tagName,
        text: (el.textContent || '').trim().slice(0, 80),
        placeholder: el.getAttribute('placeholder'),
        type: el.getAttribute('type')
      }))
  );

  console.log(
    'ADDRESS STEP CONTROLS:',
    JSON.stringify(controls, null, 2)
  );

  await page.screenshot({
    path: 'belconnect-address-validation.png',
    fullPage: true
  });

  // Do not advance to Step 3 yet.
});

test('Booking address requires location before continuing', async ({ page }) => {
  await page.goto(
    'http://localhost:3000/book?pro=test-provider&service=Plumbing'
  );

  // Step 1: Service Details
  await expect(
    page.getByRole('heading', { name: 'Service Details' })
  ).toBeVisible();

  await page.getByRole('button', {
    name: 'Continue',
    exact: true
  }).click();

  // Step 2: Service Address
  await expect(
    page.getByRole('heading', { name: 'Service Address' })
  ).toBeVisible();

  const continueButton = page.getByRole('button', {
    name: 'Continue',
    exact: true
  });

  // Empty address must prevent continuation
  await expect(continueButton).toBeDisabled();

  // Find manual address input
  const addressInput = page.getByPlaceholder(
    'Enter full address manually...'
  );

  await expect(addressInput).toBeVisible();

  // Enter a sample test address (not a real address)
  await addressInput.fill(
    'Test House 12, Test Street, Belagavi'
  );

  // Print result to understand the form's requirements
  console.log(
    'Continue enabled after address:',
    await continueButton.isEnabled()
  );

  // Verify no booking is submitted
  await expect(page).toHaveURL(/\/book\?/);

  // Screenshot of address form
  await page.screenshot({
    path: 'belconnect-address-filled.png',
    fullPage: true
  });
});

test('Booking navigates from Step 2 to Step 3', async ({ page }) => {
  // Open booking page without authentication
  await page.goto(
    'http://localhost:3000/book?pro=test-provider&service=Plumbing'
  );

  // Step 1 - Service Details
  await expect(
    page.getByRole('heading', { name: 'Service Details' })
  ).toBeVisible();

  await page.getByRole('button', {
    name: 'Continue',
    exact: true
  }).click();

  // Step 2 - Service Address
  await expect(
    page.getByRole('heading', { name: 'Service Address' })
  ).toBeVisible();

  const address = page.getByPlaceholder(
    'Enter full address manually...'
  );

  await address.fill('Test House 12, Test Street, Belagavi');

  const continueButton = page.getByRole('button', {
    name: 'Continue',
    exact: true
  });

  await expect(continueButton).toBeEnabled();
  await continueButton.click();

  // Inspect Step 3
  const headings = await page.locator('h1, h2').allTextContents();

  console.log('Step 3 headings:', headings);

  const text = await page.locator('body').innerText();

  console.log('Step 3 preview:', text.slice(0, 900));

  // Screenshot
  await page.screenshot({
    path: 'belconnect-booking-step3.png',
    fullPage: true
  });

  // No booking submission
});

test('Booking requires a time slot before continuing', async ({ page }) => {
  await page.goto(
    'http://localhost:3000/book?pro=test-provider&service=Plumbing'
  );

  // Step 1: Service Details
  await expect(
    page.getByRole('heading', { name: 'Service Details' })
  ).toBeVisible();

  await page.getByRole('button', {
    name: 'Continue',
    exact: true
  }).click();

  // Step 2: Service Address
  await expect(
    page.getByRole('heading', { name: 'Service Address' })
  ).toBeVisible();

  await page.getByPlaceholder(
    'Enter full address manually...'
  ).fill('Test House 12, Test Street, Belagavi');

  await page.getByRole('button', {
    name: 'Continue',
    exact: true
  }).click();

  // Step 3: Date & Time Slot
  await expect(
    page.getByRole('heading', { name: 'Date & Time Slot' })
  ).toBeVisible();

  // Inspect Continue button before choosing a slot
  const continueButton = page.getByRole('button', {
    name: 'Continue',
    exact: true
  });

  const enabled = await continueButton.isEnabled();

  console.log(
    'Step 3 Continue enabled without selecting slot:',
    enabled
  );

  // Inspect available time slot controls
  const buttons = await page.locator('button').evaluateAll(elements =>
    elements
      .filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map(el => ({
        text: (el.textContent || '').trim().slice(0, 90),
        disabled: (el as HTMLButtonElement).disabled
      }))
      .filter(el =>
        /AM|PM|Continue|Tomorrow|Today/i.test(el.text)
      )
  );

  console.log(
    'TIME SLOT CONTROLS:',
    JSON.stringify(buttons, null, 2)
  );

  await page.screenshot({
    path: 'belconnect-step3-timeslots.png',
    fullPage: true
  });

  // Do not select or confirm a booking.
});

test('Booking time slot selection enables Continue', async ({ page }) => {
  await page.goto(
    'http://localhost:3000/book?pro=test-provider&service=Plumbing'
  );

  // Step 1: Service Details
  await expect(
    page.getByRole('heading', { name: 'Service Details' })
  ).toBeVisible();

  await page.getByRole('button', {
    name: 'Continue',
    exact: true
  }).click();

  // Step 2: Service Address
  await expect(
    page.getByRole('heading', { name: 'Service Address' })
  ).toBeVisible();

  await page.getByPlaceholder(
    'Enter full address manually...'
  ).fill('Test House 12, Test Street, Belagavi');

  await page.getByRole('button', {
    name: 'Continue',
    exact: true
  }).click();

  // Step 3: Date & Time Slot
  await expect(
    page.getByRole('heading', { name: 'Date & Time Slot' })
  ).toBeVisible();

  // Select tomorrow to avoid earlier slots today
  await page.getByRole('button', {
    name: /Tomorrow/i
  }).click();

  const continueButton = page.getByRole('button', {
    name: 'Continue',
    exact: true
  });

  await expect(continueButton).toBeDisabled();

  // Select a visible, enabled time-slot button
  const availableSlot = page.getByRole('button', {
    name: /^\d{1,2}:\d{2}\s*(AM|PM)\s*[–-]\s*\d{1,2}:\d{2}\s*(AM|PM)$/i
  }).filter({ visible: true }).first();

  await expect(availableSlot).toBeEnabled();

  const selectedSlot = await availableSlot.innerText();

  await availableSlot.click();

  // Continue should now be enabled
  await expect(continueButton).toBeEnabled();

  console.log('Selected time slot:', selectedSlot);

  // Capture screenshot without advancing further
  await page.screenshot({
    path: 'belconnect-selected-timeslot.png',
    fullPage: true
  });
});

test('Inspect booking Step 4 safely', async ({ page }) => {
  await page.goto(
    'http://localhost:3000/book?pro=test-provider&service=Plumbing'
  );

  // Step 1 — Service Details
  await expect(
    page.getByRole('heading', { name: 'Service Details' })
  ).toBeVisible();

  await page.getByRole('button', {
    name: 'Continue',
    exact: true
  }).click();

  // Step 2 — Service Address
  await expect(
    page.getByRole('heading', { name: 'Service Address' })
  ).toBeVisible();

  await page.getByPlaceholder(
    'Enter full address manually...'
  ).fill('Test House 12, Test Street, Belagavi');

  await page.getByRole('button', {
    name: 'Continue',
    exact: true
  }).click();

  // Step 3 — Date & Time Slot
  await expect(
    page.getByRole('heading', { name: 'Date & Time Slot' })
  ).toBeVisible();

  // Select tomorrow
  await page.getByRole('button', {
    name: /Tomorrow/i
  }).click();

  // Find available time slot
  const slot = page.getByRole('button', {
    name: /^\d{1,2}:\d{2}\s*(AM|PM)\s*[–-]\s*\d{1,2}:\d{2}\s*(AM|PM)$/i
  }).filter({ visible: true }).first();

  await expect(slot).toBeEnabled();
  await slot.click();

  // Proceed only to Step 4
  const continueButton = page.getByRole('button', {
    name: 'Continue',
    exact: true
  });

  await expect(continueButton).toBeEnabled();
  await continueButton.click();

  // Inspect Step 4
  console.log('Step 4 URL:', page.url());

  console.log(
    'Step 4 headings:',
    await page.locator('h1, h2').allTextContents()
  );

  console.log(
    'Step 4 preview:',
    (await page.locator('body').innerText()).slice(0, 1000)
  );

  await page.screenshot({
    path: 'belconnect-booking-step4.png',
    fullPage: true
  });

  // STOP HERE: no further buttons are clicked.
});
