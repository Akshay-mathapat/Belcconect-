import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "https://belcconect.vercel.app/";
const ENDPOINT = __ENV.ENDPOINT || "/api/services";

const ok = new Counter("res_200");
const serverError = new Counter("res_500");
const rateLimited = new Counter("res_429");
const unavailable = new Counter("res_503");
const other = new Counter("res_other");

export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 50 },
        { duration: "2m", target: 200 },
        { duration: "2m", target: 300 },
        { duration: "2m", target: 300 },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}${ENDPOINT}`, { timeout: "30s" });

  if (res.status === 200) ok.add(1);
  else if (res.status === 500) serverError.add(1);
  else if (res.status === 429) rateLimited.add(1);
  else if (res.status === 503) unavailable.add(1);
  else other.add(1);

  check(res, { "status is 200": (r) => r.status === 200 });
}
