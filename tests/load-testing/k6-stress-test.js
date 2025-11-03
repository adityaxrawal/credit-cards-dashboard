import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

// Stress test configuration - push system beyond normal capacity
export const options = {
  stages: [
    { duration: "2m", target: 100 }, // Ramp-up to 100 users
    { duration: "5m", target: 100 }, // Stay at 100
    { duration: "2m", target: 200 }, // Spike to 200
    { duration: "5m", target: 200 }, // Stay at 200
    { duration: "2m", target: 300 }, // Spike to 300
    { duration: "5m", target: 300 }, // Stay at 300
    { duration: "5m", target: 0 }, // Ramp-down
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"], // More lenient thresholds
    http_req_failed: ["rate<0.1"], // Allow up to 10% errors
  },
};

const BASE_URL = __ENV.API_URL || "http://localhost:4000";

export default function () {
  const endpoints = [
    "/health",
    "/api/dashboard/overview",
    "/api/cards",
    "/api/transactions?page=1&limit=50",
    "/api/analytics/summary",
  ];

  // Randomly hit different endpoints
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(`${BASE_URL}${endpoint}`);

  check(res, {
    "status is not 500": (r) => r.status !== 500,
  });

  errorRate.add(res.status >= 500);
  sleep(0.5); // Shorter sleep for stress test
}
