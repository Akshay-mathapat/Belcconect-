import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ─── Custom Metrics ──────────────────────────────────────────────────────────
const successfulCatalogReads = new Counter("successful_catalog_reads");
const successfulRegistrations = new Counter("successful_registrations");
const successfulAddresses = new Counter("successful_addresses");
const successfulBookings = new Counter("successful_bookings");
const failedRequests = new Rate("failed_requests");
const bookingDuration = new Trend("booking_creation_duration", true);
const requestDuration = new Trend("response_time_ms", true);

// ─── Target Configuration ────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "https://belcconect.vercel.app";

// ─── 50 Concurrent Users Configuration (Calibrated for Render DB Pool) ──────
export const options = {
  stages: [
    { duration: "10s", target: 15 },  // Gentle warmup to 15 users
    { duration: "20s", target: 50 },  // Scale to 50 concurrent users
    { duration: "25s", target: 50 },  // Sustain 50 concurrent users at peak
    { duration: "10s", target: 0 }    // Graceful cooldown
  ],
  thresholds: {
    failed_requests: ["rate<0.05"],   // Error rate target < 5%
    http_req_duration: ["p(95)<3500"] // 95% latency within 3.5s
  }
};

export default function () {
  const vuId = __VU; // 1 to 50
  const userPad = String(vuId).padStart(3, "0");
  const uniqueTag = `${userPad}_${Date.now().toString().slice(-4)}`;

  const headers = {
    "Content-Type": "application/json",
    "x-forwarded-for": `198.51.100.${(vuId % 200) + 1}`
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Marketplace Catalog Discovery (Public Read)
  // ═══════════════════════════════════════════════════════════════════════════
  const t1 = Date.now();
  const catRes = http.get(`${BASE_URL}/api/services`, { headers, timeout: "10s" });
  requestDuration.add(Date.now() - t1);

  const catOk = check(catRes, {
    "Catalog loaded 200": (r) => r.status === 200
  });

  if (catOk) {
    successfulCatalogReads.add(1);
  } else {
    failedRequests.add(1);
  }

  // Realistic human reading pause
  sleep(2);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. User Authentication (Customer Registration)
  // ═══════════════════════════════════════════════════════════════════════════
  const custEmail = `k6_cust_${uniqueTag}@belconnect.test`;
  const t2 = Date.now();
  const regRes = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({
      email: custEmail,
      password: "SecurePassword123!",
      name: `Customer ${userPad}`,
      phone: `+9197${userPad}${uniqueTag.slice(-4)}`,
      role: "user"
    }),
    { headers, timeout: "15s" }
  );
  requestDuration.add(Date.now() - t2);

  const regOk = check(regRes, {
    "Customer registered 200": (r) => r.status === 200 && r.json("success") === true
  });

  if (!regOk) {
    failedRequests.add(1);
    sleep(4);
    return;
  }

  successfulRegistrations.add(1);
  const token = regRes.json("token");
  const custId = regRes.json("user.id");

  const authHeaders = {
    ...headers,
    "Authorization": `Bearer ${token}`,
    "x-user-id": custId
  };

  sleep(2);

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Save Delivery GPS Address (Database Insert)
  // ═══════════════════════════════════════════════════════════════════════════
  const t3 = Date.now();
  const addrRes = http.post(
    `${BASE_URL}/api/addresses`,
    JSON.stringify({
      type: "Home",
      text: `House #${userPad}, Tilakwadi, Belagavi 590006`,
      latitude: 15.8497 + (vuId * 0.0001),
      longitude: 74.4977 + (vuId * 0.0001),
      landmark: "Near Congress Road"
    }),
    { headers: authHeaders, timeout: "10s" }
  );
  requestDuration.add(Date.now() - t3);

  const addrOk = check(addrRes, {
    "Address created 200": (r) => r.status === 200 && r.json("address.id") !== undefined
  });

  if (addrOk) {
    successfulAddresses.add(1);
  }

  const addressId = addrOk ? addrRes.json("address.id") : null;
  sleep(2);

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Dynamic Provider Selection from Catalog
  // ═══════════════════════════════════════════════════════════════════════════
  let targetProviderId = "prov-1791270969509";
  let targetServiceName = "Home Deep Cleaning";
  let targetCategory = "cleaning";

  try {
    const catalogData = catRes.json();
    const serviceList = Array.isArray(catalogData) ? catalogData : (catalogData?.services || []);
    if (serviceList.length > 0) {
      const selected = serviceList[vuId % serviceList.length];
      if (selected && selected.provider_id) {
        targetProviderId = selected.provider_id;
        targetServiceName = selected.name || targetServiceName;
        targetCategory = selected.category || targetCategory;
      }
    }
  } catch (e) {
    // fallback
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Create Real Atomic Booking (Sequence B-1000x)
  // ═══════════════════════════════════════════════════════════════════════════
  const t4 = Date.now();
  const bookRes = http.post(
    `${BASE_URL}/api/bookings`,
    JSON.stringify({
      customerId: custId,
      providerId: targetProviderId,
      providerName: "Verified Specialist",
      serviceName: targetServiceName,
      category: targetCategory,
      date: "2026-10-25",
      time: "10:00 AM – 11:00 AM",
      serviceAddressId: addressId,
      destinationLatitude: 15.8497,
      destinationLongitude: 74.4977,
      destinationAddress: `House #${userPad}, Tilakwadi, Belagavi`
    }),
    { headers: authHeaders, timeout: "15s" }
  );
  const bookMs = Date.now() - t4;
  bookingDuration.add(bookMs);
  requestDuration.add(bookMs);

  const bookOk = check(bookRes, {
    "Booking created with B- sequence": (r) => r.status === 200 && /^B-\d+$/.test(r.json("booking.id"))
  });

  if (bookOk) {
    successfulBookings.add(1);
  } else {
    failedRequests.add(bookRes.status >= 500 ? 1 : 0);
  }

  sleep(2);

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. View My Bookings Dashboard (Protected Read)
  // ═══════════════════════════════════════════════════════════════════════════
  const t5 = Date.now();
  const listRes = http.get(`${BASE_URL}/api/bookings`, { headers: authHeaders, timeout: "10s" });
  requestDuration.add(Date.now() - t5);

  check(listRes, {
    "Dashboard bookings 200": (r) => r.status === 200
  });

  // Pacing between loops
  sleep(4);
}
