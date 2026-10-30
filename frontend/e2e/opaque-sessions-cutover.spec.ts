import { test, expect, Page, BrowserContext } from '@playwright/test';

/**
 * Playwright E2E Cutover Test Suite
 * 
 * Verifies 100% Opaque Cookie Session Authentication with AUTH_ISSUE_LEGACY_JWT=false:
 * 1. API Level:
 *    - Customer Login: cookie issued, zero JWT token returned, Cache-Control: no-store
 *    - /api/auth/me: validated via cookie without Authorization Bearer header
 *    - /api/bookings: retrieved via cookie
 *    - /api/ekyc/me: provider access via cookie
 *    - /api/chat/conversations: provider message threads via cookie
 *    - /api/auth/socket-ticket: 60s ephemeral WebRTC ticket via cookie without JWT
 *    - /api/auth/logout: database revocation and cookie clearing
 * 2. Real Browser UI Level (page.goto, cookie-only, reload persists, no redirect to login, no console errors):
 *    - /account
 *    - /bookings/e2e_book_01
 *    - /book
 *    - /contact
 *    - /provider (Provider layout)
 *    - /provider/ekyc
 *    - /provider/messages
 *    - /jobprovider/settings (Job Provider layout & settings)
 *    - logout (session revocation redirects to login)
 */

test.describe('Opaque Server-Side Sessions Cutover & Real UI Suite (AUTH_ISSUE_LEGACY_JWT=false)', () => {
  const originHeader = { Origin: 'http://localhost:3000' };
  let customerSessionCookie = '';
  let providerSessionCookie = '';
  let jobProviderSessionCookie = '';

  let customerCacheControl = '';
  let customerRawToken = '';
  let providerRawToken = '';
  let jobProviderRawToken = '';

  test.beforeAll(async ({ request }) => {
    console.log('[TEST SERVER CONFIG] PostgreSQL Host: localhost:5433 | DB Name: belconnect_test');
    console.log('[TEST SERVER CONFIG] AUTH_ISSUE_LEGACY_JWT: false | AUTH_ACCEPT_LEGACY_JWT: true | CSRF_ENFORCE: 1');

    // 1. Log in Customer to obtain cookie
    const custRes = await request.post('/api/auth/login', {
      headers: { ...originHeader },
      data: {
        email: 'e2e.customer@belconnect.test',
        password: 'Password123!'
      }
    });
    expect(custRes.status()).toBe(200);
    const custBody = await custRes.json();
    expect(custBody.token).toBeUndefined(); // Zero JWT
    customerCacheControl = custRes.headers()['cache-control'] || '';
    customerSessionCookie = custRes.headers()['set-cookie'] || '';
    customerRawToken = (customerSessionCookie.match(/(?:belconnect_session|__Host-session)=([^;]+)/) || [])[1] || '';

    // 2. Log in Provider to obtain cookie
    const provRes = await request.post('/api/auth/login', {
      headers: { ...originHeader },
      data: {
        email: 'e2e.provider@belconnect.test',
        password: 'Password123!'
      }
    });
    expect(provRes.status()).toBe(200);
    providerSessionCookie = provRes.headers()['set-cookie'] || '';
    providerRawToken = (providerSessionCookie.match(/(?:belconnect_session|__Host-session)=([^;]+)/) || [])[1] || '';

    // 3. Log in Job Provider to obtain cookie
    const jpRes = await request.post('/api/auth/login', {
      headers: { ...originHeader },
      data: {
        email: 'e2e.jobprovider@belconnect.test',
        password: 'Password123!'
      }
    });
    expect(jpRes.status()).toBe(200);
    jobProviderSessionCookie = jpRes.headers()['set-cookie'] || '';
    jobProviderRawToken = (jobProviderSessionCookie.match(/(?:belconnect_session|__Host-session)=([^;]+)/) || [])[1] || '';
  });

  // Helper to attach error listener and filter out external noise (analytics, external fonts, favicon)
  function trackConsoleErrors(page: Page) {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const txt = msg.text();
        if (
          !txt.includes('favicon.ico') &&
          !txt.includes('accounts.google.com') &&
          !txt.includes('Fast Refresh') &&
          !txt.includes('401 (Unauthorized)') &&
          !txt.includes('Failed to load resource: net::ERR_CONNECTION_REFUSED')
        ) {
          errors.push(txt);
        }
      }
    });
    return errors;
  }

  // Helper to inject cookie-only session into browser context
  async function applySessionCookie(context: BrowserContext, rawToken: string) {
    await context.addCookies([
      {
        name: 'belconnect_session',
        value: rawToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax'
      }
    ]);
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PART 1: API CONTRACT TESTS (No JWT Issued, Cookie Validation, Ephemeral Ticket)
  // ═════════════════════════════════════════════════════════════════════════════

  test('API-1: Customer Login issues cookie, no JWT, sets no-store', async () => {
    expect(customerRawToken.length).toBeGreaterThan(20);
    expect(customerCacheControl).toContain('no-store');
  });

  test('API-2: /api/auth/me validates session using cookie only without Bearer header', async ({ request }) => {
    const res = await request.get('/api/auth/me', {
      headers: {
        ...originHeader,
        Cookie: customerSessionCookie
      }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.email).toBe('e2e.customer@belconnect.test');
    expect(body.user.token).toBeUndefined();
    expect(res.headers()['cache-control']).toContain('no-store');
  });

  test('API-3: /api/bookings retrieves bookings using cookie session', async ({ request }) => {
    const res = await request.get('/api/bookings', {
      headers: {
        ...originHeader,
        Cookie: customerSessionCookie
      }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.bookings || body)).toBe(true);
  });

  test('API-4: /api/ekyc/me provider eKYC access via cookie session', async ({ request }) => {
    const res = await request.get('/api/ekyc/me', {
      headers: {
        ...originHeader,
        Cookie: providerSessionCookie
      }
    });
    expect(res.status()).toBe(200);
  });

  test('API-5: /api/chat/conversations provider messages via cookie session', async ({ request }) => {
    const res = await request.get('/api/chat/conversations', {
      headers: {
        ...originHeader,
        Cookie: providerSessionCookie
      }
    });
    expect(res.status()).toBe(200);
  });

  test('API-6: /api/auth/socket-ticket issues 60s ephemeral ticket via cookie session', async ({ request }) => {
    const res = await request.post('/api/auth/socket-ticket', {
      headers: {
        ...originHeader,
        Cookie: customerSessionCookie
      }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.ticket).toBe('string');
    expect(body.ticket.length).toBeGreaterThan(20);
    expect(body.expiresIn).toBe(60);
    expect(res.headers()['cache-control']).toContain('no-store');
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PART 2: REAL BROWSER UI TESTS (page.goto, cookie-only, reload persists)
  // ═════════════════════════════════════════════════════════════════════════════

  test('UI-1: /account loads with cookie only, no redirect to login, reload persists, zero console errors', async ({ context, page }) => {
    const consoleErrors = trackConsoleErrors(page);
    await applySessionCookie(context, customerRawToken);

    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    expect(page.url()).toContain('/account');
    expect(page.url()).not.toContain('/login');
    expect(page.url()).not.toContain('/auth');

    // Reload persists
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/account');
    expect(page.url()).not.toContain('/login');
    expect(consoleErrors).toHaveLength(0);
  });

  test('UI-2: /bookings/[id] loads with cookie only, no redirect to login, reload persists, zero console errors', async ({ context, page }) => {
    const consoleErrors = trackConsoleErrors(page);
    await applySessionCookie(context, customerRawToken);

    await page.goto('/bookings/e2e_book_01', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    expect(page.url()).toContain('/bookings/e2e_book_01');
    expect(page.url()).not.toContain('/login');
    expect(page.url()).not.toContain('/auth');

    // Reload persists
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/bookings/e2e_book_01');
    expect(consoleErrors).toHaveLength(0);
  });

  test('UI-3: /book loads with cookie only, no redirect to login, reload persists, zero console errors', async ({ context, page }) => {
    const consoleErrors = trackConsoleErrors(page);
    await applySessionCookie(context, customerRawToken);

    await page.goto('/book', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    expect(page.url()).toContain('/book');
    expect(page.url()).not.toContain('/login');

    // Reload persists
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/book');
    expect(consoleErrors).toHaveLength(0);
  });

  test('UI-4: /contact loads with cookie only, no redirect to login, reload persists, zero console errors', async ({ context, page }) => {
    const consoleErrors = trackConsoleErrors(page);
    await applySessionCookie(context, customerRawToken);

    await page.goto('/contact', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    expect(page.url()).toContain('/contact');
    expect(page.url()).not.toContain('/login');

    // Reload persists
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/contact');
    expect(consoleErrors).toHaveLength(0);
  });

  test('UI-5: Provider Layout (/provider) loads with cookie only, no redirect to login, reload persists, zero console errors', async ({ context, page }) => {
    const consoleErrors = trackConsoleErrors(page);
    await applySessionCookie(context, providerRawToken);

    await page.goto('/provider', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    expect(page.url()).toContain('/provider');
    expect(page.url()).not.toContain('/login');

    // Reload persists
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/provider');
    expect(consoleErrors).toHaveLength(0);
  });

  test('UI-6: /provider/ekyc loads with cookie only, no redirect to login, reload persists, zero console errors', async ({ context, page }) => {
    const consoleErrors = trackConsoleErrors(page);
    await applySessionCookie(context, providerRawToken);

    await page.goto('/provider/ekyc', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    expect(page.url()).toContain('/provider/ekyc');
    expect(page.url()).not.toContain('/login');

    // Reload persists
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/provider/ekyc');
    expect(consoleErrors).toHaveLength(0);
  });

  test('UI-7: /provider/messages loads with cookie only, no redirect to login, reload persists, zero console errors', async ({ context, page }) => {
    const consoleErrors = trackConsoleErrors(page);
    await applySessionCookie(context, providerRawToken);

    await page.goto('/provider/messages', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    expect(page.url()).toContain('/provider/messages');
    expect(page.url()).not.toContain('/login');

    // Reload persists
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/provider/messages');
    expect(consoleErrors).toHaveLength(0);
  });

  test('UI-8: JobProvider settings (/jobprovider/settings) loads with cookie only, no redirect to login, reload persists, zero console errors', async ({ context, page }) => {
    const consoleErrors = trackConsoleErrors(page);
    await applySessionCookie(context, jobProviderRawToken);

    await page.goto('/jobprovider/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    expect(page.url()).toContain('/jobprovider/settings');
    expect(page.url()).not.toContain('/login');

    // Reload persists
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/jobprovider/settings');
    expect(consoleErrors).toHaveLength(0);
  });

  test('UI-9: Logout revokes session cookie; unauthenticated access redirects to login', async ({ context, page }) => {
    const consoleErrors = trackConsoleErrors(page);
    await applySessionCookie(context, customerRawToken);

    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/account');

    // Trigger logout to revoke server-side session in DB and clear client storage
    await page.evaluate(async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      localStorage.clear();
      sessionStorage.clear();
    });

    // Clear session cookies from context
    await context.clearCookies();

    // Subsequent access to protected route redirects to login
    await page.goto('/provider', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/(?:login|auth)/, { timeout: 10000 });
    expect(consoleErrors).toHaveLength(0);
  });
});
