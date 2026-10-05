import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// Load test tokens pool (Phase 23)
const pool = JSON.parse(open("./tokens.json"));
const customers = pool.customers || [];
const providers = pool.providers || [];

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const TARGET_STAGE = parseInt(__ENV.TARGET_STAGE || "50", 10);
const TEST_MODE = __ENV.TEST_MODE || "smoke"; // "smoke", "validation", "long_validation"

// Global Status Breakdown Counters (Phase 19)
const res2xx = new Counter("status_2xx");
const res400 = new Counter("status_400");
const res401 = new Counter("status_401");
const res403 = new Counter("status_403");
const res404 = new Counter("status_404");
const res409 = new Counter("status_409");
const res429 = new Counter("status_429");
const res500 = new Counter("status_500");
const res502 = new Counter("status_502");
const res503 = new Counter("status_503");
const res504 = new Counter("status_504");
const resOther = new Counter("status_other");
const netErrors = new Counter("network_errors");
const checkFailures = new Counter("check_failures");

// Strict Acceptance Criteria (Phase 18 & 9)
const unexpectedFailures = new Rate("unexpected_failures");
const serverErrors5xx = new Rate("server_errors_5xx");

// Per-Endpoint Metrics (Phase 10 & 20)
const durServices = new Trend("dur_api_services", true);
const durJobs = new Trend("dur_api_jobs", true);
const durBookingsCust = new Trend("dur_api_bookings_cust", true);
const durBookingsProv = new Trend("dur_api_bookings_prov", true);
const durAvailability = new Trend("dur_api_provider_availability", true);
const durNotifications = new Trend("dur_api_notifications", true);
const durReverseGeocode = new Trend("dur_api_reverse_geocode", true);
const durChat = new Trend("dur_api_chat_conversations", true);
const durCallsActive = new Trend("dur_api_calls_active", true);
const durPages = new Trend("dur_pages", true);

function getStages() {
  return [
    { duration: "1m", target: 400 },
    { duration: "15m", target: 400 },
    { duration: "1m", target: 0 }
  ];
}

export const options = {
  stages: getStages(),
  thresholds: {
    unexpected_failures: ["rate<0.01"],     // < 1% unexpected failures (4xx, 5xx, timeouts, check failures)
    server_errors_5xx: ["rate<0.005"],       // < 0.5% unexpected 5xx
    http_req_duration: ["p(95)<2000", "p(99)<5000"] // p95 < 2s, p99 < 5s
  }
};

export default function () {
  // Rotate test accounts across VUs (Phase 23)
  const custIndex = __VU % customers.length;
  const provIndex = __VU % providers.length;
  const customer = customers[custIndex] || customers[0];
  const provider = providers[provIndex] || providers[0];

  const custHeaders = {
    "Authorization": "Bearer " + customer.token,
    "Content-Type": "application/json"
  };

  const provHeaders = {
    "Authorization": "Bearer " + provider.token,
    "Content-Type": "application/json"
  };

  const rand = Math.random() * 100;
  let res;
  let trend = null;
  let endpointTag = "unknown";
  let expectedShapeCheck = null;

  // Realistic Traffic Mix (Phase 22)
  if (rand < 25) {
    // 25% Browse public pages
    const pages = ["/", "/services", "/about", "/careers", "/contact"];
    const p = pages[Math.floor(Math.random() * pages.length)];
    trend = durPages;
    endpointTag = "pages";
    res = http.get(BASE_URL + p, { tags: { name: endpointTag }, timeout: "15s" });
    expectedShapeCheck = (r) => r.body && r.body.length > 500;
  } else if (rand < 40) {
    // 15% Services catalog
    trend = durServices;
    endpointTag = "api_services";
    res = http.get(BASE_URL + "/api/services", { tags: { name: endpointTag }, timeout: "15s" });
    expectedShapeCheck = (r) => {
      try {
        const d = r.json();
        return Array.isArray(d) || (d && typeof d === "object");
      } catch (e) { return false; }
    };
  } else if (rand < 55) {
    // 15% Provider bookings
    trend = durBookingsProv;
    endpointTag = "api_bookings_prov";
    res = http.get(BASE_URL + "/api/bookings", { headers: provHeaders, tags: { name: endpointTag }, timeout: "15s" });
    expectedShapeCheck = (r) => {
      try {
        const d = r.json();
        return Array.isArray(d) || (d && typeof d === "object");
      } catch (e) { return false; }
    };
  } else if (rand < 65) {
    // 10% Customer bookings
    trend = durBookingsCust;
    endpointTag = "api_bookings_cust";
    res = http.get(BASE_URL + "/api/bookings", { headers: custHeaders, tags: { name: endpointTag }, timeout: "15s" });
    expectedShapeCheck = (r) => {
      try {
        const d = r.json();
        return Array.isArray(d) || (d && typeof d === "object");
      } catch (e) { return false; }
    };
  } else if (rand < 75) {
    // 10% Notifications
    trend = durNotifications;
    endpointTag = "api_notifications";
    res = http.get(BASE_URL + "/api/notifications", { headers: custHeaders, tags: { name: endpointTag }, timeout: "15s" });
    expectedShapeCheck = (r) => {
      try {
        const d = r.json();
        return Array.isArray(d) || (d && typeof d === "object");
      } catch (e) { return false; }
    };
  } else if (rand < 85) {
    // 10% Jobs Portal
    trend = durJobs;
    endpointTag = "api_jobs";
    res = http.get(BASE_URL + "/api/jobs", { tags: { name: endpointTag }, timeout: "15s" });
    expectedShapeCheck = (r) => {
      try {
        const d = r.json();
        return Array.isArray(d) || (d && typeof d === "object");
      } catch (e) { return false; }
    };
  } else if (rand < 90) {
    // 5% Chat conversations
    trend = durChat;
    endpointTag = "api_chat";
    res = http.get(BASE_URL + "/api/chat/conversations", { headers: custHeaders, tags: { name: endpointTag }, timeout: "15s" });
    expectedShapeCheck = (r) => {
      try {
        const d = r.json();
        return Array.isArray(d) || (d && typeof d === "object");
      } catch (e) { return false; }
    };
  } else if (rand < 95) {
    // 5% Provider availability
    trend = durAvailability;
    endpointTag = "api_provider_availability";
    res = http.get(BASE_URL + "/api/provider/availability", { headers: provHeaders, tags: { name: endpointTag }, timeout: "15s" });
    expectedShapeCheck = (r) => {
      try {
        const d = r.json();
        return typeof d === "object" && d !== null;
      } catch (e) { return false; }
    };
  } else if (rand < 98) {
    // 3% Reverse geocode
    trend = durReverseGeocode;
    endpointTag = "api_reverse_geocode";
    const jitterLat = 15.8497 + (Math.random() * 0.004 - 0.002);
    const jitterLng = 74.4977 + (Math.random() * 0.004 - 0.002);
    res = http.get(
      BASE_URL + "/api/location/reverse-geocode?lat=" + jitterLat.toFixed(4) + "&lng=" + jitterLng.toFixed(4),
      { tags: { name: endpointTag }, timeout: "15s" }
    );
    expectedShapeCheck = (r) => {
      try {
        const d = r.json();
        return d && (d.address || d.latitude);
      } catch (e) { return false; }
    };
  } else {
    // 2% Calls active check
    trend = durCallsActive;
    endpointTag = "api_calls_active";
    res = http.get(BASE_URL + "/api/calls/active", { headers: custHeaders, tags: { name: endpointTag }, timeout: "15s" });
    expectedShapeCheck = (r) => {
      try {
        const d = r.json();
        return typeof d === "object" && d !== null;
      } catch (e) { return false; }
    };
  }

  if (res && res.timings && trend) {
    trend.add(res.timings.duration);
  }

  // Error Classification (Phase 9 & 11)
  if (!res || res.status === 0) {
    netErrors.add(1);
    unexpectedFailures.add(1);
    serverErrors5xx.add(1);
  } else {
    if (res.status >= 200 && res.status < 300) res2xx.add(1);
    else if (res.status === 400) res400.add(1);
    else if (res.status === 401) res401.add(1);
    else if (res.status === 403) res403.add(1);
    else if (res.status === 404) res404.add(1);
    else if (res.status === 409) res409.add(1);
    else if (res.status === 429) res429.add(1);
    else if (res.status === 500) res500.add(1);
    else if (res.status === 502) res502.add(1);
    else if (res.status === 503) res503.add(1);
    else if (res.status === 504) res504.add(1);
    else resOther.add(1);

    const is5xx = res.status >= 500;
    serverErrors5xx.add(is5xx);

    // Functional shape verification
    let shapeOk = true;
    if (res.status === 200 && expectedShapeCheck) {
      shapeOk = expectedShapeCheck(res);
      if (!shapeOk) {
        checkFailures.add(1);
      }
    }

    // In a normal authenticated workload:
    // Any 5xx, network error, 401, 403, 404, 409, 429, or shape failure is an UNEXPECTED FAILURE
    const isUnexpected = is5xx || res.status >= 400 || !shapeOk;
    unexpectedFailures.add(isUnexpected);

    check(res, {
      "status is 2xx": (r) => r.status >= 200 && r.status < 300,
      "functional shape valid": () => shapeOk
    });
  }

  // Realistic Think Time: 1 to 5 seconds (Phase 21)
  sleep(1 + Math.random() * 4);
}
