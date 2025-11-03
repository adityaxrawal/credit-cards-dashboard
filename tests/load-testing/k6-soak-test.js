import http from "k6/http";
import { check, sleep } from "k6";

// Soak test - sustained load over extended period
export const options = {
  stages: [
    { duration: "5m", target: 100 }, // Ramp-up
    { duration: "60m", target: 100 }, // Stay at load for 1 hour
    { duration: "5m", target: 0 }, // Ramp-down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.05"],
  },
};

const BASE_URL = __ENV.API_URL || "http://localhost:4000";

export default function () {
  const res = http.get(`${BASE_URL}/health`);
  check(res, {
    "sustained load OK": (r) => r.status === 200,
  });
  sleep(2);
}
