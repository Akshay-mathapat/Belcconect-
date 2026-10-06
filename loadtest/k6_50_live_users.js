import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ─── Custom Metrics ──────────────────────────────────────────────────────────
const successfulRegistrations = new Counter("successful_registrations");
const successfulAddresses = new Counter("successful_addresses");
const successfulBookings = new Counter("successful_bookings");
const failedRequests = new Rate("failed_requests");
const requestDuration = new Trend("response_time_ms", true);

// ─── Target Configuration ────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "https://belcconect.vercel.app";

// ─── 50 Users: Exactly 1 Complete E2E Creation Flow Per User ─────────────────
export const options = {
  scenarios: {
    users_50_e2e: {
      executor: "per-vu-iterations",
      vus: 50,           // 50 concurrent users
      iterations: 1,     // Each user runs exactly 1 full creation cycle
      maxDuration: "2m"  // Maximum test duration
    }
  },
  thresholds: {
    failed_requests: ["rate<0.05"],   // Less than 5% failure rate
    http_req_duration: ["p(95)<5000"] // 95% latency within 5s under simultaneous cloud writes
  }
};

export default function () {
  const vuId = __VU; // 1 to 50
  const userNum = String(vuId).padStart(3, "0");
  const runId = Date.now().toString().slice(-5);

  const baseHeaders = {
    "Content-Type": "application/json",
    // Authorized load test bypass key to allow 50 accounts from single IP
    "x-load-test-key": "belconnect-loadtest-50",
    "x-forwarded-for": `198.51.100.${(vuId % 200) + 1}`
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. User Registration (Inserts row into customers table in Render DB)
  // ═══════════════════════════════════════════════════════════════════════════
  const custEmail = `k6_user_${userNum}_${runId}@belconnect.test`;
  const t1 = Date.now();
  const regRes = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({
      email: custEmail,
      password: "SecurePassword123!",
      name: `K6 User ${userNum}`,
      phone: `+9197${userNum}${runId}`,
      role: "user"
    }),
    { headers: baseHeaders, timeout: "20s" }
  );
  requestDuration.add(Date.now() - t1);

  const regOk = check(regRes, {
    "1. Customer registered in DB (200)": (r) => r.status === 200 && r.json("success") === true
  });

  if (!regOk) {
    failedRequests.add(1);
    return;
  }

  successfulRegistrations.add(1);
  const token = regRes.json("token");
  const custId = regRes.json("user.id");

  const authHeaders = {
    ...baseHeaders,
    "Authorization": `Bearer ${token}`,
    "x-user-id": custId
  };

  // Human pacing
  sleep(1);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Save GPS Delivery Address (Inserts row into addresses table in Render DB)
  // ═══════════════════════════════════════════════════════════════════════════
  const t2 = Date.now();
  const addrRes = http.post(
    `${BASE_URL}/api/addresses`,
    JSON.stringify({
      type: "Home",
      text: `Flat #${userNum}, Green Heights, Belagavi 590001`,
      latitude: 15.8497 + (vuId * 0.0001),
      longitude: 74.4977 + (vuId * 0.0001),
      landmark: "Near City Park"
    }),
    { headers: authHeaders, timeout: "15s" }
  );
  requestDuration.add(Date.now() - t2);

  const addrOk = check(addrRes, {
    "2. Address inserted in DB (200)": (r) => r.status === 200 && r.json("address.id") !== undefined
  });

  if (addrOk) {
    successfulAddresses.add(1);
  }

  const addressId = addrOk ? addrRes.json("address.id") : null;
  sleep(1);

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Create Atomic Booking (Inserts row into bookings table with B- sequence)
  // ═══════════════════════════════════════════════════════════════════════════
  const activeProviderId = "prov-1791270999509";
  const t3 = Date.now();
  const bookRes = http.post(
    `${BASE_URL}/api/bookings`,
    JSON.stringify({
      customerId: custId,
      providerId: activeProviderId,
      providerName: "Mohit Provider",
      serviceName: "Hair Cutting & Grooming",
      category: "salon",
      date: "2026-10-25",
      time: "10:00 AM – 11:00 AM",
      serviceAddressId: addressId,
      destinationLatitude: 15.8497,
      destinationLongitude: 74.4977,
      destinationAddress: `Flat #${userNum}, Belagavi`
    }),
    { headers: authHeaders, timeout: "20s" }
  );
  requestDuration.add(Date.now() - t3);

  const bookOk = check(bookRes, {
    "3. Booking inserted in DB with B- ID (200)": (r) => r.status === 200 && /^B-\d+$/.test(r.json("booking.id"))
  });

  if (bookOk) {
    successfulBookings.add(1);
  } else {
    failedRequests.add(1);
  }

  sleep(1);

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. View User Bookings Dashboard (Read query from DB)
  // ═══════════════════════════════════════════════════════════════════════════
  const t4 = Date.now();
  const listRes = http.get(`${BASE_URL}/api/bookings`, { headers: authHeaders, timeout: "15s" });
  requestDuration.add(Date.now() - t4);

  check(listRes, {
    "4. User bookings fetched (200)": (r) => r.status === 200
  });
}

