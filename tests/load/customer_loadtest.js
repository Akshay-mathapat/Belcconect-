import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// Load 100 customer test accounts
const pool = JSON.parse(open("./customer_tokens.json"));
const customers = pool.customers || [];

const BASE_URL = __ENV.BASE_URL || "https://belcconect.vercel.app/";
const TARGET_STAGE = parseInt(__ENV.TARGET_STAGE || "50", 10);
const TEST_MODE = __ENV.TEST_MODE || "smoke"; // "smoke", "validation", "long_validation"

// Status Breakdown Counters
const res2xx = new Counter("status_2xx");
const res400 = new Counter("status_400");
const res401 = new Counter("status_401");
const res403 = new Counter("status_403");
const res404 = new Counter("status_404");
const res429 = new Counter("status_429");
const res500 = new Counter("status_500");
const resOther = new Counter("status_other");
const netErrors = new Counter("network_errors");
const checkFailures = new Counter("check_failures");

// Strict Acceptance Criteria
const unexpectedFailures = new Rate("unexpected_failures");
const serverErrors5xx = new Rate("server_errors_5xx");

// Per-Endpoint Trends
const durServices = new Trend("dur_api_services", true);
const durJobs = new Trend("dur_api_jobs", true);
const durBookingsCust = new Trend("dur_api_bookings_cust", true);
const durNotifications = new Trend("dur_api_notifications", true);
const durReverseGeocode = new Trend("dur_api_reverse_geocode", true);
const durChat = new Trend("dur_api_chat_conversations", true);
const durCallsActive = new Trend("dur_api_calls_active", true);
const durPages = new Trend("dur_pages", true);

function getStages() {
  if (TEST_MODE === "validation") {
    return [
      { duration: "1m", target: TARGET_STAGE },
      { duration: "5m", target: TARGET_STAGE },
      { duration: "1m", target: 0 }
    ];
  } else if (TEST_MODE === "long_validation") {
    return [
      { duration: "1m", target: TARGET_STAGE },
      { duration: "10m", target: TARGET_STAGE },
      { duration: "1m", target: 0 }
    ];
  }
  // Default: smoke test
  return [
    { duration: "10s", target: TARGET_STAGE },
    { duration: "30s", target: TARGET_STAGE },
    { duration: "5s", target: 0 }
  ];
}

export const options = {
  stages: getStages(),
  thresholds: {
    unexpected_failures: ["rate<0.01"],     // < 1% unexpected failures
    server_errors_5xx: ["rate<0.005"],       // < 0.5% 5xx errors
    http_req_duration: ["p(95)<2000", "p(99)<5000"] // p95 < 2s, p99 < 5s
  }
};

export default function () {
  // Rotate customer accounts across VUs
  const custIndex = __VU % customers.length;
  const customer = customers[custIndex] || customers[0];

  const custHeaders = {
    "Authorization": "Bearer " + customer.token,
    "Content-Type": "application/json"
  };

  const rand = Math.random() * 100;
  let res;
  let trend = null;
  let endpointTag = "unknown";
  let expectedShapeCheck = null;

  // Realistic Customer Flow Traffic Mix:
  // 30% Public pages, 20% Services catalog, 15% Customer Bookings,
  // 15% Notifications, 10% Jobs, 5% Chat, 3% Reverse Geocode, 2% Calls Active
  if (rand < 30) {
    const pages = ["/", "/services", "/about", "/careers", "/contact"];
    const p = pages[Math.floor(Math.random() * pages.length)];
    trend = durPages;
    endpointTag = "pages";
    res = http.get(BASE_URL + p, { tags: { name: endpointTag }, timeout: "15s" });
    expectedShapeCheck = (r) => r.body && r.body.length > 500;
  } else if (rand < 50) {
    trend = durServices;
    endpointTag = "api_services";
    res = http.get(BASE_URL + "/api/services", { tags: { name: endpointTag }, timeout: "15s" });
    expectedShapeCheck = (r) => {
      try {
        const d = r.json();
        return Array.isArray(d) || (d && typeof d === "object");
      } catch (e) { return false; }
    };
  } else if (rand < 65) {
    trend = durBookingsCust;
    endpointTag = "api_bookings_cust";
    res = http.get(BASE_URL + "/api/bookings", { headers: custHeaders, tags: { name: endpointTag }, timeout: "15s" });
    expectedShapeCheck = (r) => {
      try {
        const d = r.json();
        return Array.isArray(d) || (d && typeof d === "object");
      } catch (e) { return false; }
    };
  } else if (rand < 80) {
    trend = durNotifications;
    endpointTag = "api_notifications";
    res = http.get(BASE_URL + "/api/notifications", { headers: custHeaders, tags: { name: endpointTag }, timeout: "15s" });
    expectedShapeCheck = (r) => {
      try {
        const d = r.json();
        return Array.isArray(d) || (d && typeof d === "object");
      } catch (e) { return false; }
    };
  } else if (rand < 90) {
    trend = durJobs;
    endpointTag = "api_jobs";
    res = http.get(BASE_URL + "/api/jobs", { tags: { name: endpointTag }, timeout: "15s" });
    expectedShapeCheck = (r) => {
      try {
        const d = r.json();
        return Array.isArray(d) || (d && typeof d === "object");
      } catch (e) { return false; }
    };
  } else if (rand < 95) {
    trend = durChat;
    endpointTag = "api_chat";
    res = http.get(BASE_URL + "/api/chat/conversations", { headers: custHeaders, tags: { name: endpointTag }, timeout: "15s" });
    expectedShapeCheck = (r) => {
      try {
        const d = r.json();
        return Array.isArray(d) || (d && typeof d === "object");
      } catch (e) { return false; }
    };
  } else if (rand < 98) {
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

  // Error Classification & Acceptance Checks
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
    else if (res.status === 429) res429.add(1);
    else if (res.status === 500) res500.add(1);
    else resOther.add(1);

    const is5xx = res.status >= 500;
    serverErrors5xx.add(is5xx);

    let shapeOk = true;
    if (res.status === 200 && expectedShapeCheck) {
      shapeOk = expectedShapeCheck(res);
      if (!shapeOk) {
        checkFailures.add(1);
      }
    }

    const isUnexpected = is5xx || res.status >= 400 || !shapeOk;
    unexpectedFailures.add(isUnexpected);

    check(res, {
      "status is 2xx": (r) => r.status >= 200 && r.status < 300,
      "functional shape valid": () => shapeOk
    });
  }

  // Realistic Think Time: 1 to 5 seconds
  sleep(1 + Math.random() * 4);
}
