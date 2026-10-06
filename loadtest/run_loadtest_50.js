import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ─── Custom Metrics ──────────────────────────────────────────────────────────
const catalogLoads = new Counter("catalog_loads");
const categorySearches = new Counter("category_searches");
const slotChecks = new Counter("provider_slot_checks");
const failedRequests = new Rate("failed_requests");
const responseTime = new Trend("response_time_ms", true);

// ─── Target Configuration ────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "https://belcconect.vercel.app";

// ─── 50 Concurrent Users Real-Traffic Simulation ──────────────────────────────
export const options = {
  stages: [
    { duration: "10s", target: 20 },  // Warmup to 20 users
    { duration: "25s", target: 50 },  // Scale to 50 concurrent users
    { duration: "25s", target: 50 },  // Hold 50 concurrent users at peak
    { duration: "10s", target: 0 }    // Graceful cooldown
  ],
  thresholds: {
    failed_requests: ["rate<0.02"],   // Strict: Less than 2% failure rate
    http_req_duration: ["p(95)<2500"] // 95% of requests under 2.5s
  }
};

export default function () {
  const vuId = __VU;
  const userNum = String(vuId).padStart(3, "0");

  const headers = {
    "Accept": "application/json",
    "User-Agent": `CityConnect-LoadTest-VU-${userNum}`
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Marketplace Discovery: Load Public Services Catalog (Heavy DB Join)
  // ═══════════════════════════════════════════════════════════════════════════
  const t1 = Date.now();
  const catRes = http.get(`${BASE_URL}/api/services`, { headers, timeout: "10s" });
  responseTime.add(Date.now() - t1);

  const catOk = check(catRes, {
    "1. Catalog loaded 200": (r) => r.status === 200
  });

  if (catOk) catalogLoads.add(1);
  else failedRequests.add(1);

  // Realistic human browse reading time
  sleep(1.5);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Filter Marketplace by Category: "salon" (Active Verified Category)
  // ═══════════════════════════════════════════════════════════════════════════
  const t2 = Date.now();
  const salonRes = http.get(`${BASE_URL}/api/services?category=salon`, { headers, timeout: "10s" });
  responseTime.add(Date.now() - t2);

  const salonOk = check(salonRes, {
    "2. Salon category filtered 200": (r) => r.status === 200
  });

  if (salonOk) categorySearches.add(1);
  else failedRequests.add(1);

  sleep(1.5);

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Search Marketplace by Query: "grooming"
  // ═══════════════════════════════════════════════════════════════════════════
  const t3 = Date.now();
  const queryRes = http.get(`${BASE_URL}/api/services?query=grooming`, { headers, timeout: "10s" });
  responseTime.add(Date.now() - t3);

  const queryOk = check(queryRes, {
    "3. Search query filtered 200": (r) => r.status === 200
  });

  if (queryOk) categorySearches.add(1);
  else failedRequests.add(1);

  sleep(2);

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Check Provider Booked Slots Availability (DB Aggregate Check)
  // ═══════════════════════════════════════════════════════════════════════════
  const activeProviderId = "prov-1791270999509";
  const t4 = Date.now();
  const slotRes = http.get(
    `${BASE_URL}/api/bookings/booked-slots?providerId=${activeProviderId}&date=2026-10-25`,
    { headers, timeout: "10s" }
  );
  responseTime.add(Date.now() - t4);

  const slotOk = check(slotRes, {
    "4. Provider booked slots checked 200": (r) => r.status === 200
  });

  if (slotOk) slotChecks.add(1);
  else failedRequests.add(1);

  // Pacing before next loop
  sleep(3);
}
