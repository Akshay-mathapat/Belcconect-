import { test, expect } from '@playwright/test';

/**
 * Playwright E2E Test Suite:
 * Validates 100% Opaque Cookie Session Authentication with AUTH_ISSUE_LEGACY_JWT=false
 * Covered Flows:
 * 1. Login (cookie-only, no JWT issued)
 * 2. Account Profile (/api/auth/me & account access)
 * 3. Bookings (/api/bookings)
 * 4. Provider eKYC (/api/ekyc/me)
 * 5. Messages (/api/chat/conversations)
 * 6. A Call (Signaling ephemeral socket ticket via /api/auth/socket-ticket)
 * 7. Logout (/api/auth/logout revocation & session clear)
 */

test.describe('Opaque Server-Side Sessions End-to-End Cutover (AUTH_ISSUE_LEGACY_JWT=false)', () => {
  const originHeader = { Origin: 'http://localhost:3000' };
  let customerSessionCookie = '';
  let providerSessionCookie = '';

  test('1) Customer Login: issues opaque session cookie, never issues JWT token, sets no-store', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      headers: {
        ...originHeader
      },
      data: {
        email: 'e2e.customer@belconnect.test',
        password: 'Password123!'
      }
    });

    expect(res.status()).toBe(200);
    const body = await res.json();

    // Verify user profile is returned
    expect(body.success).toBe(true);
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe('e2e.customer@belconnect.test');

    // CRITICAL: Must NEVER issue a legacy JWT when AUTH_ISSUE_LEGACY_JWT=false
    expect(body.token).toBeUndefined();
    expect(body.user.token).toBeUndefined();

    // Verify Cache-Control: no-store
    const cacheControl = res.headers()['cache-control'] || '';
    expect(cacheControl).toContain('no-store');

    // Extract session cookie from Set-Cookie
    const setCookie = res.headers()['set-cookie'] || '';
    expect(setCookie).toMatch(/(?:belconnect_session|__Host-session)=/);
    customerSessionCookie = setCookie;
  });

  test('2) Account Access: validates session with cookie only without Authorization Bearer header', async ({ request }) => {
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

  test('3) Bookings: retrieves customer bookings list using cookie session', async ({ request }) => {
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

  test('4) Provider eKYC: provider logs in with cookie-only session and accesses eKYC endpoints', async ({ request }) => {
    // Provider login
    const loginRes = await request.post('/api/auth/login', {
      headers: {
        ...originHeader
      },
      data: {
        email: 'e2e.provider@belconnect.test',
        password: 'Password123!'
      }
    });
    expect(loginRes.status()).toBe(200);
    const loginBody = await loginRes.json();
    expect(loginBody.user.role).toBe('provider');
    expect(loginBody.token).toBeUndefined();

    providerSessionCookie = loginRes.headers()['set-cookie'] || '';

    // Access eKYC me endpoint
    const kycRes = await request.get('/api/ekyc/me', {
      headers: {
        ...originHeader,
        Cookie: providerSessionCookie
      }
    });
    expect(kycRes.status()).toBe(200);
    const kycBody = await kycRes.json();
    expect(kycBody).toBeDefined();
  });

  test('5) Messages: accesses provider conversation list using cookie session', async ({ request }) => {
    const res = await request.get('/api/chat/conversations', {
      headers: {
        ...originHeader,
        Cookie: providerSessionCookie
      }
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toBeDefined();
  });

  test('6) A Call: obtains ephemeral 60s socket ticket using cookie session without Bearer token', async ({ request }) => {
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

  test('7) Logout: revokes session in PostgreSQL, clears cookie, and invalidates session check', async ({ request }) => {
    const logoutRes = await request.post('/api/auth/logout', {
      headers: {
        ...originHeader,
        Cookie: customerSessionCookie
      }
    });

    expect(logoutRes.status()).toBe(200);
    const logoutBody = await logoutRes.json();
    expect(logoutBody.success).toBe(true);

    // After logout, subsequent request to /api/auth/me with old cookie MUST return 401 Unauthorized
    const meRes = await request.get('/api/auth/me', {
      headers: {
        ...originHeader,
        Cookie: customerSessionCookie
      }
    });
    expect(meRes.status()).toBe(401);
  });
});
