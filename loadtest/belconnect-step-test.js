import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const BASE_URL =
  __ENV.BASE_URL || "https://belcconect.vercel.app";

const VUS = Number(__ENV.VUS || 5);
const DURATION = __ENV.DURATION || "30s";

const ok = new Counter("res_200");
const serverError = new Counter("res_500");
const rateLimited = new Counter("res_429");
const unavailable = new Counter("res_503");
const other = new Counter("res_other");

export const options = {
  vus: VUS,
  duration: DURATION,

  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000"],
    checks: ["rate>0.99"],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/services`, {
    timeout: "30s",
    tags: {
      endpoint: "services",
    },
  });

  if (res.status === 200) {
    ok.add(1);
  } else if (res.status === 429) {
    rateLimited.add(1);
  } else if (res.status === 500) {
    serverError.add(1);
  } else if (res.status === 503) {
    unavailable.add(1);
  } else {
    other.add(1);
  }

  check(res, {
    "services API returned 200": (r) => r.status === 200,
  });

  // Simulate a user waiting before the next request
  sleep(2);
}