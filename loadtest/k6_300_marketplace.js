import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ─── Metrics ─────────────────────────────────────────────────────────────────
const successfulRegistrations = new Counter("successful_registrations");
const successfulBookings = new Counter("successful_bookings");
const successfulServices = new Counter("successful_services");
const failedRequests = new Rate("failed_requests");
const bookingDuration = new Trend("booking_creation_duration", true);
const registrationDuration = new Trend("registration_duration", true);

// ─── Target Configuration ────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "https://belcconect.vercel.app";

// ─── 300-User Ramp-up Stages (Total: 300 Virtual Users) ───────────────────────
export const options = {
  stages: [
    { duration: "20s", target: 100 },  // Ramp up to 100 users over 20s
    { duration: "30s", target: 300 },  // Ramp up to 300 users over 30s
    { duration: "30s", target: 300 },  // Hold 300 concurrent users for 30s
    { duration: "15s", target: 0 }     // Graceful cooldown
  ],
  thresholds: {
    failed_requests: ["rate<0.02"],            // Failure rate < 2%
    http_req_duration: ["p(95)<2500"],        // 95% of requests finish in < 2.5s
    booking_creation_duration: ["p(95)<2000"] // Booking creation p95 < 2s
  }
};

export default function () {
  const vuId = __VU; // 1 to 300
  const iterId = __ITER;
  const isProvider = vuId > 150;
  const userNum = String(vuId).padStart(3, "0");

  const jsonHeaders = {
    "Content-Type": "application/json",
    // Simulate unique real-world IPs for rate limiter isolation
    "x-forwarded-for": `198.51.100.${(vuId % 250) + 1}`
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // FLOW A: Service Providers (VUs 151 - 300)
  // ═══════════════════════════════════════════════════════════════════════════
  if (isProvider) {
    const provEmail = `k6_prov_${userNum}_${iterId}@belconnect.test`;
    
    // 1. Register Provider
    const regStart = Date.now();
    const regRes = http.post(
      `${BASE_URL}/api/auth/register`,
      JSON.stringify({
        email: provEmail,
        password: "SecurePassword123!",
        name: `K6 Pro ${userNum}`,
        phone: `+919800000${userNum}`,
        role: "provider"
      }),
      { headers: jsonHeaders }
    );
    registrationDuration.add(Date.now() - regStart);

    const regOk = check(regRes, {
      "Provider registered 200": (r) => r.status === 200 && r.json("success") === true
    });

    if (!regOk) {
      failedRequests.add(1);
      return;
    }

    successfulRegistrations.add(1);
    const provToken = regRes.json("token");
    const provId = regRes.json("user.id");

    const authHeaders = {
      ...jsonHeaders,
      "Authorization": `Bearer ${provToken}`,
      "x-user-id": provId
    };

    sleep(1);

    // 2. Set Availability True
    const availRes = http.patch(
      `${BASE_URL}/api/provider/availability`,
      JSON.stringify({ isAvailable: true }),
      { headers: authHeaders }
    );
    check(availRes, {
      "Provider availability active": (r) => r.status === 200
    });

    // 3. Publish Service
    const srvRes = http.post(
      `${BASE_URL}/api/services`,
      JSON.stringify({
        name: "Home Deep Cleaning",
        category: "cleaning",
        price: 999,
        durationMinutes: 60,
        description: "Professional deep cleaning service"
      }),
      { headers: authHeaders }
    );

    const srvOk = check(srvRes, {
      "Service created": (r) => r.status === 200
    });
    if (srvOk) successfulServices.add(1);

    sleep(2);
    return;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FLOW B: Customers (VUs 1 - 150)
  // ═══════════════════════════════════════════════════════════════════════════
  const custEmail = `k6_cust_${userNum}_${iterId}@belconnect.test`;

  // 1. Register Customer
  const regStart = Date.now();
  const regRes = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({
      email: custEmail,
      password: "SecurePassword123!",
      name: `K6 Customer ${userNum}`,
      phone: `+919700000${userNum}`,
      role: "user"
    }),
    { headers: jsonHeaders }
  );
  registrationDuration.add(Date.now() - regStart);

  const regOk = check(regRes, {
    "Customer registered 200": (r) => r.status === 200 && r.json("success") === true
  });

  if (!regOk) {
    failedRequests.add(1);
    return;
  }

  successfulRegistrations.add(1);
  const custToken = regRes.json("token");
  const custId = regRes.json("user.id");

  const authHeaders = {
    ...jsonHeaders,
    "Authorization": `Bearer ${custToken}`,
    "x-user-id": custId
  };

  sleep(1);

  // 2. Create Saved Address
  const addrRes = http.post(
    `${BASE_URL}/api/addresses`,
    JSON.stringify({
      type: "Home",
      text: `House #${userNum}, Main Street, Belagavi 590001`,
      latitude: 15.8497 + (vuId * 0.0001),
      longitude: 74.4977 + (vuId * 0.0001),
      landmark: "Near City Center"
    }),
    { headers: authHeaders }
  );

  const addrOk = check(addrRes, {
    "Address created": (r) => r.status === 200 && r.json("address.id") !== undefined
  });

  const addressId = addrOk ? addrRes.json("address.id") : null;

  sleep(1);

  // 3. Create Atomic Booking (Sequence B-1000x)
  // Target active provider
  const targetProviderId = `prov-1791270969509`;

  const bookStart = Date.now();
  const bookRes = http.post(
    `${BASE_URL}/api/bookings`,
    JSON.stringify({
      customerId: custId,
      providerId: targetProviderId,
      providerName: "Mohit Provider",
      serviceName: "Home Deep Cleaning",
      category: "cleaning",
      date: "2026-10-15",
      time: "11:00 AM – 12:00 PM",
      serviceAddressId: addressId,
      destinationLatitude: 15.8497,
      destinationLongitude: 74.4977,
      destinationAddress: `House #${userNum}, Belagavi`
    }),
    { headers: authHeaders }
  );
  bookingDuration.add(Date.now() - bookStart);

  const bookOk = check(bookRes, {
    "Booking created with B- sequence": (r) => r.status === 200 && /^B-\d+$/.test(r.json("booking.id"))
  });

  if (bookOk) {
    successfulBookings.add(1);
  } else {
    failedRequests.add(1);
  }

  sleep(2);
}

