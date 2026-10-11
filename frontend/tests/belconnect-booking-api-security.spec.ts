
import { test, expect } from '@playwright/test';

test('Booking API rejects unauthenticated requests', async ({ request }) => {

  // Use the local Next.js API route.
  // First ensure it targets an isolated test backend.
  const response = await request.post(
    'http://localhost:3000/api/bookings',
    {
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        customerId: 'unauthorized-test-user',
        providerId: 'unauthorized-test-provider',
        serviceName: 'Plumbing',
        date: '2099-01-01',
        time: '9:00 AM – 10:00 AM',
        address: 'Test Address'
      }
    }
  );

  console.log('Booking API response:', response.status());

  // Authentication must be enforced before accepting booking creation.
  expect(response.status()).toBe(401);
});
