import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const TEST_TOKEN = __ENV.TEST_TOKEN || "";

const unexpectedErrors = new Rate("unexpected_errors");

export const options = {
  stages: [
    { duration: "1m", target: 400 },
    { duration: "15m", target: 400 },
    { duration: "2m", target: 0 },
  ],

  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000"],
    unexpected_errors: ["rate<0.005"],
  },
};

function protectedHeaders() {
  return {
    headers: {
      Authorization: `Bearer ${TEST_TOKEN}`,
      "Content-Type": "application/json",
    },
  };
}

function track(res) {
  const unexpected = res.status >= 500 || res.status === 0;

  unexpectedErrors.add(unexpected);

  check(res, {
    "no unexpected 5xx": (r) => r.status < 500,
  });
}

export default function () {
  const choice = Math.random();

  let res;

  if (choice < 0.25) {
    res = http.get(`${BASE_URL}/api/services`);
  } else if (choice < 0.40) {
    res = http.get(
      `${BASE_URL}/api/bookings`,
      protectedHeaders()
    );
  } else if (choice < 0.52) {
    res = http.get(
      `${BASE_URL}/api/notifications`,
      protectedHeaders()
    );
  } else if (choice < 0.62) {
    res = http.get(
      `${BASE_URL}/api/calls/active`,
      protectedHeaders()
    );
  } else if (choice < 0.72) {
    res = http.get(
      `${BASE_URL}/api/provider/availability`,
      protectedHeaders()
    );
  } else if (choice < 0.82) {
    res = http.get(`${BASE_URL}/api/jobs`);
  } else if (choice < 0.92) {
    res = http.get(
      `${BASE_URL}/api/chat/conversations`,
      protectedHeaders()
    );
  } else {
    res = http.get(
      `${BASE_URL}/api/location/reverse-geocode?lat=15.8497&lng=74.4977`
    );
  }

  track(res);

  sleep(Math.random() * 4 + 1);
}